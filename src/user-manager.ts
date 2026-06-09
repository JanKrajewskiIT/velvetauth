import {
  type SigninRedirectArgs,
  type SignoutRedirectArgs,
  User,
  UserManager,
  type UserManagerSettings,
  WebStorageStateStore,
} from 'oidc-client-ts';

import {
  getConfigIdentityKey,
  getPostLogoutRedirectUri,
  getRedirectUri,
  getScope,
  getSilentRedirectUri,
  type OidcAuthConfig,
} from './config';
import { NON_BROWSER_RUNTIME_MESSAGE } from './constants';
import { isBrowserRuntime } from './runtime';

export interface OidcAuthUserManagerFactoryConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentRedirectUri?: string;
  automaticSilentRenew: boolean;
  scope: string;
}

export interface AuthUserManager {
  events: {
    addUserLoaded(callback: (user: User) => void): void;
    removeUserLoaded(callback: (user: User) => void): void;
    addUserUnloaded(callback: () => void): void;
    removeUserUnloaded(callback: () => void): void;
    addSilentRenewError(callback: (error: Error) => void): void;
    removeSilentRenewError(callback: (error: Error) => void): void;
    addAccessTokenExpired(callback: () => void): void;
    removeAccessTokenExpired(callback: () => void): void;
  };
  getUser(): Promise<User | null>;
  signinRedirect(args?: SigninRedirectArgs): Promise<void>;
  signinRedirectCallback(url?: string): Promise<User>;
  signinSilent(): Promise<User | null>;
  signoutRedirect(args?: SignoutRedirectArgs): Promise<void>;
}

export type OidcAuthUserManagerFactory = (config: OidcAuthUserManagerFactoryConfig) => AuthUserManager;

let registeredFactory: OidcAuthUserManagerFactory | null = null;
let cachedManager: AuthUserManager | null = null;
let cachedIdentityKey: string | null = null;

function toFactoryConfig(config: OidcAuthConfig): OidcAuthUserManagerFactoryConfig {
  return {
    authority: config.authority,
    clientId: config.clientId,
    redirectUri: getRedirectUri(config),
    postLogoutRedirectUri: getPostLogoutRedirectUri(config),
    silentRedirectUri: getSilentRedirectUri(config),
    automaticSilentRenew: true,
    scope: getScope(config),
  };
}

function defaultFactory(config: OidcAuthUserManagerFactoryConfig): AuthUserManager {
  const settings: UserManagerSettings = {
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    silent_redirect_uri: config.silentRedirectUri,
    response_type: 'code',
    scope: config.scope,
    automaticSilentRenew: config.automaticSilentRenew,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  };
  return new UserManager(settings);
}

export function setAuthUserManagerFactory(factory: OidcAuthUserManagerFactory | null): void {
  registeredFactory = factory ?? null;
  cachedManager = null;
  cachedIdentityKey = null;
}

export function resolveUserManager(config: OidcAuthConfig): AuthUserManager {
  if (!isBrowserRuntime()) {
    throw new Error(NON_BROWSER_RUNTIME_MESSAGE);
  }

  const identityKey = getConfigIdentityKey(config);
  if (cachedManager && cachedIdentityKey === identityKey) {
    return cachedManager;
  }

  const factory = registeredFactory ?? defaultFactory;
  const manager = factory(toFactoryConfig(config));
  cachedManager = manager;
  cachedIdentityKey = identityKey;
  return manager;
}
