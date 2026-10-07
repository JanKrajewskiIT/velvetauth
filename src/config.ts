import { trimTrailingSlash } from './url.ts';

export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_SCOPE = 'openid profile email';
export const DEFAULT_RETURN_URL_STORAGE_KEY = 'velvet-auth:return-url';

const ACCOUNT_PATH = '/account';
const CLIENT_ID_FORBIDDEN_CHARACTER = ':';
const REQUIRED_TEXT_FIELDS = ['authority', 'clientId', 'appUrl'] as const;

export interface OidcAuthConfig {
  readonly authority: string;
  readonly clientId: string;
  readonly appUrl: string;
  readonly redirectUri?: string;
  readonly postLogoutRedirectUri?: string;
  readonly silentRedirectUri?: string;
  readonly accountUrl?: string;
  readonly timeoutMs?: number;
  readonly returnUrlStorageKey?: string;
  readonly scope?: string;
}

export interface OidcAuthUserManagerFactoryConfig {
  readonly authority: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  readonly silentRedirectUri?: string;
  readonly automaticSilentRenew: boolean;
  readonly scope: string;
}

interface ResolvedFields {
  readonly authority: string;
  readonly clientId: string;
  readonly appUrl: string;
  readonly redirectUri: string;
  readonly postLogoutRedirectUri: string;
  readonly silentRedirectUri: string | undefined;
  readonly accountUrl: string;
  readonly timeoutMs: number;
  readonly returnUrlStorageKey: string;
  readonly scope: string;
}

export interface ResolvedAuthConfig extends ResolvedFields {
  readonly identityKey: string;
}

/** Fields that select an OIDC client. Order is part of the identity encoding. */
const IDENTITY_FIELDS = [
  'authority',
  'clientId',
  'appUrl',
  'redirectUri',
  'postLogoutRedirectUri',
  'silentRedirectUri',
  'scope',
] as const satisfies readonly (keyof ResolvedFields)[];

export const getRedirectUri = (config: OidcAuthConfig): string => config.redirectUri ?? config.appUrl;

export const getPostLogoutRedirectUri = (config: OidcAuthConfig): string =>
  config.postLogoutRedirectUri ?? config.appUrl;

export const getSilentRedirectUri = (config: OidcAuthConfig): string | undefined => config.silentRedirectUri;

export const getAccountUrl = (config: OidcAuthConfig): string =>
  config.accountUrl ?? `${trimTrailingSlash(config.authority)}${ACCOUNT_PATH}`;

export const getTimeoutMs = (config: OidcAuthConfig): number => config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

export const getReturnUrlStorageKey = (config: OidcAuthConfig): string =>
  config.returnUrlStorageKey ?? DEFAULT_RETURN_URL_STORAGE_KEY;

export const getScope = (config: OidcAuthConfig): string => config.scope ?? DEFAULT_SCOPE;

export const assertValidClientId = (clientId: string): void => {
  if (clientId.includes(CLIENT_ID_FORBIDDEN_CHARACTER)) {
    throw new Error(`OidcAuthConfig.clientId must not contain "${CLIENT_ID_FORBIDDEN_CHARACTER}".`);
  }
};

const assertValidConfig = (config: OidcAuthConfig): void => {
  for (const field of REQUIRED_TEXT_FIELDS) {
    const value: unknown = config[field];
    if (typeof value !== 'string' || value === '') {
      throw new Error(`OidcAuthConfig.${field} must be a non-empty string.`);
    }
  }
  assertValidClientId(config.clientId);
  const timeoutMs = getTimeoutMs(config);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('OidcAuthConfig.timeoutMs must be a positive, finite number of milliseconds.');
  }
};

const buildIdentityKey = (fields: ResolvedFields): string =>
  JSON.stringify(IDENTITY_FIELDS.map((field) => fields[field] ?? null));

export const resolveAuthConfig = (config: OidcAuthConfig): ResolvedAuthConfig => {
  assertValidConfig(config);
  const fields: ResolvedFields = {
    authority: config.authority,
    clientId: config.clientId,
    appUrl: config.appUrl,
    redirectUri: getRedirectUri(config),
    postLogoutRedirectUri: getPostLogoutRedirectUri(config),
    silentRedirectUri: getSilentRedirectUri(config),
    accountUrl: getAccountUrl(config),
    timeoutMs: getTimeoutMs(config),
    returnUrlStorageKey: getReturnUrlStorageKey(config),
    scope: getScope(config),
  };
  return { ...fields, identityKey: buildIdentityKey(fields) };
};

export const toUserManagerFactoryConfig = (resolved: ResolvedAuthConfig): OidcAuthUserManagerFactoryConfig => ({
  authority: resolved.authority,
  clientId: resolved.clientId,
  redirectUri: resolved.redirectUri,
  postLogoutRedirectUri: resolved.postLogoutRedirectUri,
  silentRedirectUri: resolved.silentRedirectUri,
  automaticSilentRenew: true,
  scope: resolved.scope,
});
