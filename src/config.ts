import type { OidcAuthConfig } from './types';

export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_SCOPE = 'openid profile email';
export const DEFAULT_RETURN_URL_STORAGE_KEY = 'velvet-auth:return-url';

export interface ResolvedOidcAuthConfig {
  authority: string;
  clientId: string;
  appUrl: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  silentRedirectUri?: string;
  accountUrl: string;
  timeoutMs: number;
  returnUrlStorageKey: string;
  scope: string;
}

export const getRedirectUri = (config: OidcAuthConfig): string => config.redirectUri ?? config.appUrl;

export const getPostLogoutRedirectUri = (config: OidcAuthConfig): string =>
  config.postLogoutRedirectUri ?? config.appUrl;

export const getSilentRedirectUri = (config: OidcAuthConfig): string | undefined => config.silentRedirectUri;

export const getScope = (config: OidcAuthConfig): string => config.scope ?? DEFAULT_SCOPE;

export const getTimeoutMs = (config: OidcAuthConfig): number => {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
};

export const getReturnUrlStorageKey = (config: OidcAuthConfig): string =>
  config.returnUrlStorageKey ?? DEFAULT_RETURN_URL_STORAGE_KEY;

export const getAccountUrl = (config: OidcAuthConfig): string =>
  config.accountUrl ?? `${config.authority.replace(/\/+$/u, '')}/account`;

export const resolveOidcAuthConfig = (config: OidcAuthConfig): ResolvedOidcAuthConfig => {
  if (config.clientId.includes(':')) {
    throw new TypeError('The OIDC client identifier must not contain ":".');
  }

  return {
    authority: config.authority,
    clientId: config.clientId,
    appUrl: config.appUrl,
    redirectUri: getRedirectUri(config),
    postLogoutRedirectUri: getPostLogoutRedirectUri(config),
    silentRedirectUri: config.silentRedirectUri,
    accountUrl: getAccountUrl(config),
    timeoutMs: getTimeoutMs(config),
    returnUrlStorageKey: getReturnUrlStorageKey(config),
    scope: getScope(config),
  };
};

export const getConfigIdentity = (config: OidcAuthConfig): string => {
  const resolved = resolveOidcAuthConfig(config);
  return JSON.stringify([
    resolved.authority,
    resolved.clientId,
    resolved.appUrl,
    resolved.redirectUri,
    resolved.postLogoutRedirectUri,
    resolved.silentRedirectUri ?? null,
    resolved.scope,
  ]);
};
