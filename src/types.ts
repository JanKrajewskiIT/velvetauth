import type { SigninRedirectArgs, SignoutRedirectArgs, User } from 'oidc-client-ts';
import type { Accessor, JSX } from 'solid-js';

export interface OidcAuthConfig {
  authority: string;
  clientId: string;
  appUrl: string;
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  silentRedirectUri?: string;
  accountUrl?: string;
  timeoutMs?: number;
  returnUrlStorageKey?: string;
  scope?: string;
}

export interface AuthProviderProps {
  config: OidcAuthConfig;
  children?: JSX.Element;
}

export interface SignInOptions {
  acrValues?: string;
  prompt?: string;
  loginHint?: string;
  uiLocales?: string;
  extraQueryParams?: Record<string, string>;
}

export interface AccessTokenPayload {
  realm_access?: { roles?: unknown };
  resource_access?: Record<string, { roles?: unknown }>;
  [claim: string]: unknown;
}

export interface OidcAuthUserManagerFactoryConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentRedirectUri?: string;
  automaticSilentRenew: true;
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

export interface AuthContextValue {
  user: Accessor<User | null>;
  isLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  error: Accessor<string | null>;
  accessToken: Accessor<string | undefined>;
  roles: Accessor<string[]>;
  firstName: Accessor<string>;
  lastName: Accessor<string>;
  email: Accessor<string>;
  username: Accessor<string>;
  accountUrl: Accessor<string>;
  isAdmin: Accessor<boolean>;
  isModerator: Accessor<boolean>;
  isAdminOrModerator: Accessor<boolean>;
  hasRole(role: string): boolean;
  hasAnyRole(...roles: string[]): boolean;
  signIn(returnUrl?: string, options?: SignInOptions): Promise<void>;
  signOut(): Promise<void>;
  signInSilent(): Promise<void>;
}
