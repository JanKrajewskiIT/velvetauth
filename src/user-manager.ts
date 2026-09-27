import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

import { getConfigIdentity, resolveOidcAuthConfig } from './config';
import { isBrowserRuntime } from './runtime';
import type {
  AuthUserManager,
  OidcAuthConfig,
  OidcAuthUserManagerFactory,
  OidcAuthUserManagerFactoryConfig,
} from './types';

type ManagerCacheEntry = { status: 'resolved'; manager: AuthUserManager } | { status: 'rejected'; error: unknown };

const managers = new Map<string, ManagerCacheEntry>();
let activeFactory: OidcAuthUserManagerFactory | null = null;

export const setAuthUserManagerFactory = (factory: OidcAuthUserManagerFactory | null): void => {
  activeFactory = factory;
  managers.clear();
};

const createFactoryConfig = (config: OidcAuthConfig): OidcAuthUserManagerFactoryConfig => {
  const resolved = resolveOidcAuthConfig(config);
  return {
    authority: resolved.authority,
    clientId: resolved.clientId,
    redirectUri: resolved.redirectUri,
    postLogoutRedirectUri: resolved.postLogoutRedirectUri,
    silentRedirectUri: resolved.silentRedirectUri,
    automaticSilentRenew: true,
    scope: resolved.scope,
  };
};

const createDefaultManager = (config: OidcAuthUserManagerFactoryConfig): AuthUserManager =>
  new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    silent_redirect_uri: config.silentRedirectUri,
    response_type: 'code',
    scope: config.scope,
    automaticSilentRenew: true,
    loadUserInfo: false,
    monitorSession: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });

export const getAuthUserManager = (config: OidcAuthConfig): AuthUserManager => {
  if (!isBrowserRuntime()) {
    throw new Error('The OIDC user manager can only be resolved in a browser runtime.');
  }

  const identity = getConfigIdentity(config);
  const existing = managers.get(identity);
  if (existing?.status === 'resolved') return existing.manager;
  if (existing?.status === 'rejected') throw existing.error;

  try {
    const factoryConfig = createFactoryConfig(config);
    const manager = activeFactory ? activeFactory(factoryConfig) : createDefaultManager(factoryConfig);
    managers.set(identity, { status: 'resolved', manager });
    return manager;
  } catch (error: unknown) {
    managers.set(identity, { status: 'rejected', error });
    throw error;
  }
};
