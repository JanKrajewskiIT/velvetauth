import { ACCOUNT_URL_SUFFIX, DEFAULT_RETURN_URL_STORAGE_KEY, DEFAULT_SCOPE, DEFAULT_TIMEOUT_MS } from './constants';

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

export function getRedirectUri(config: OidcAuthConfig): string {
  return config.redirectUri ?? config.appUrl;
}

export function getPostLogoutRedirectUri(config: OidcAuthConfig): string {
  return config.postLogoutRedirectUri ?? config.appUrl;
}

export function getSilentRedirectUri(config: OidcAuthConfig): string | undefined {
  return config.silentRedirectUri;
}

export function getScope(config: OidcAuthConfig): string {
  return config.scope ?? DEFAULT_SCOPE;
}

export function getTimeoutMs(config: OidcAuthConfig): number {
  return config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

export function getReturnUrlStorageKey(config: OidcAuthConfig): string {
  return config.returnUrlStorageKey ?? DEFAULT_RETURN_URL_STORAGE_KEY;
}

export function getAccountUrl(config: OidcAuthConfig): string {
  if (config.accountUrl !== undefined) {
    return config.accountUrl;
  }
  return `${config.authority.replace(/\/+$/u, '')}${ACCOUNT_URL_SUFFIX}`;
}

export function getConfigIdentityKey(config: OidcAuthConfig): string {
  return JSON.stringify([
    config.authority,
    config.clientId,
    config.appUrl,
    getRedirectUri(config),
    getPostLogoutRedirectUri(config),
    getSilentRedirectUri(config) ?? null,
    getScope(config),
  ]);
}
