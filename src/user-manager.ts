import type { SigninRedirectArgs, SignoutRedirectArgs, User } from 'oidc-client-ts';
import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

import type { OidcAuthUserManagerFactoryConfig, ResolvedAuthConfig } from './config.ts';
import { toUserManagerFactoryConfig } from './config.ts';
import { AUTH_ERROR_MESSAGES } from './errors.ts';
import { isBrowserRuntime } from './runtime.ts';

export interface AuthUserManager {
  readonly events: {
    readonly addUserLoaded: (callback: (user: User) => void) => void;
    readonly removeUserLoaded: (callback: (user: User) => void) => void;
    readonly addUserUnloaded: (callback: () => void) => void;
    readonly removeUserUnloaded: (callback: () => void) => void;
    readonly addSilentRenewError: (callback: (error: Error) => void) => void;
    readonly removeSilentRenewError: (callback: (error: Error) => void) => void;
    readonly addAccessTokenExpired: (callback: () => void) => void;
    readonly removeAccessTokenExpired: (callback: () => void) => void;
  };
  readonly getUser: () => Promise<User | null>;
  readonly signinRedirect: (args?: SigninRedirectArgs) => Promise<void>;
  readonly signinRedirectCallback: (url?: string) => Promise<User>;
  readonly signinSilent: () => Promise<User | null>;
  readonly signoutRedirect: (args?: SignoutRedirectArgs) => Promise<void>;
}

export type OidcAuthUserManagerFactory = (config: OidcAuthUserManagerFactoryConfig) => AuthUserManager;

const createDefaultUserManager: OidcAuthUserManagerFactory = (config) =>
  new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    silent_redirect_uri: config.silentRedirectUri,
    response_type: 'code',
    scope: config.scope,
    automaticSilentRenew: config.automaticSilentRenew,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });

let registeredFactory: OidcAuthUserManagerFactory | null = null;

type ManagerEntry = { readonly manager: AuthUserManager } | { readonly failure: unknown };

/**
 * One entry per identity for the module lifetime; replacing the factory discards every entry.
 * A factory failure is cached too, so the factory is never retried for the same identity.
 */
const entries = new Map<string, ManagerEntry>();

const createEntry = (config: ResolvedAuthConfig): ManagerEntry => {
  try {
    return { manager: (registeredFactory ?? createDefaultUserManager)(toUserManagerFactoryConfig(config)) };
  } catch (failure) {
    return { failure };
  }
};

export const setAuthUserManagerFactory = (factory: OidcAuthUserManagerFactory | null): void => {
  registeredFactory = factory;
  entries.clear();
};

export const getAuthUserManager = (config: ResolvedAuthConfig): AuthUserManager => {
  if (!isBrowserRuntime()) {
    throw new Error(AUTH_ERROR_MESSAGES.browserRequired);
  }
  const entry = entries.get(config.identityKey) ?? createEntry(config);
  entries.set(config.identityKey, entry);
  if ('failure' in entry) {
    throw entry.failure;
  }
  return entry.manager;
};
