import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

import {
  isBrowserRuntime,
  isOidcCallbackReturnUrl,
  normalizeReturnUrl,
  resolveCallbackReturnUrl,
  withTimeout,
} from './utils';

interface OidcAuthConfig {
  authority: string;
  clientId: string;
  appUrl: string;
  silentRedirectUri?: string;
  accountUrl?: string;
  timeoutMs?: number;
  returnUrlStorageKey?: string;
}

interface OidcAuthUserManagerFactoryConfig {
  authority: string;
  clientId: string;
  appUrl: string;
  silentRedirectUri?: string;
  automaticSilentRenew?: boolean;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETURN_URL_STORAGE_KEY = 'velvet-auth-return-url';

const userManagerCache = {
  instance: null as UserManager | null,
  cacheKey: null as string | null,
  factory: null as ((config: OidcAuthUserManagerFactoryConfig) => UserManager) | null,
};

const getResolvedFactory = (): ((config: OidcAuthUserManagerFactoryConfig) => UserManager) => {
  if (userManagerCache.factory) {
    return userManagerCache.factory;
  }

  return (config) =>
    new UserManager({
      authority: config.authority,
      client_id: config.clientId,
      redirect_uri: config.appUrl,
      post_logout_redirect_uri: config.appUrl,
      silent_redirect_uri: config.silentRedirectUri,
      userStore: new WebStorageStateStore({ store: sessionStorage }),
      automaticSilentRenew: config.automaticSilentRenew ?? true,
    });
};

const setAuthUserManagerFactory = (
  factory: ((config: OidcAuthUserManagerFactoryConfig) => UserManager) | null,
): void => {
  userManagerCache.factory = factory;
  userManagerCache.instance = null;
  userManagerCache.cacheKey = null;
};

const buildCacheKey = (config: OidcAuthConfig): string =>
  `${config.authority}::${config.clientId}::${config.appUrl}::${config.silentRedirectUri ?? ''}`;

const getUserManager = (config: OidcAuthConfig): UserManager => {
  if (!isBrowserRuntime()) {
    throw new Error('AuthProvider requires browser runtime.');
  }

  const cacheKey = buildCacheKey(config);
  if (!userManagerCache.instance || userManagerCache.cacheKey !== cacheKey) {
    userManagerCache.instance = getResolvedFactory()({
      authority: config.authority,
      clientId: config.clientId,
      appUrl: config.appUrl,
      silentRedirectUri: config.silentRedirectUri,
      automaticSilentRenew: true,
    });
    userManagerCache.cacheKey = cacheKey;
  }

  return userManagerCache.instance;
};

const getTimeoutMs = (config: OidcAuthConfig): number => config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

const getReturnUrlStorageKey = (config: OidcAuthConfig): string =>
  config.returnUrlStorageKey ?? DEFAULT_RETURN_URL_STORAGE_KEY;

const handleAuthRedirectCallback = async (config: OidcAuthConfig): Promise<boolean> => {
  if (!isBrowserRuntime()) {
    return false;
  }

  if (!isOidcCallbackReturnUrl(window.location.href, config.appUrl)) {
    return false;
  }

  const callbackUser = await getUserManager(config).signinRedirectCallback(window.location.href);
  const stateReturnUrl = resolveCallbackReturnUrl(callbackUser.state, config.appUrl);
  const storageKey = getReturnUrlStorageKey(config);
  const storedReturnUrl = sessionStorage.getItem(storageKey) ?? undefined;
  sessionStorage.removeItem(storageKey);

  const safeStoredReturnUrl =
    storedReturnUrl && !isOidcCallbackReturnUrl(storedReturnUrl, config.appUrl)
      ? normalizeReturnUrl(storedReturnUrl)
      : undefined;
  const targetUrl = stateReturnUrl ?? safeStoredReturnUrl ?? '/';
  const currentReturnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (currentReturnUrl !== targetUrl) {
    window.location.replace(targetUrl);
    return true;
  }

  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
  return false;
};

const getAuthAccessToken = async (config: OidcAuthConfig): Promise<string | undefined> => {
  if (!isBrowserRuntime()) {
    return undefined;
  }

  const manager = getUserManager(config);
  const timeout = getTimeoutMs(config);
  const user = await withTimeout(manager.getUser(), timeout, 'Access token lookup timed out');

  if (!user) {
    return undefined;
  }

  if (user.expired) {
    try {
      const renewedUser = await withTimeout(manager.signinSilent(), timeout, 'Silent token renew timed out');
      return renewedUser?.access_token;
    } catch {
      return undefined;
    }
  }

  return user.access_token;
};

export type { OidcAuthConfig, OidcAuthUserManagerFactoryConfig };
export {
  getAuthAccessToken,
  getReturnUrlStorageKey,
  getTimeoutMs,
  getUserManager,
  handleAuthRedirectCallback,
  setAuthUserManagerFactory,
};
