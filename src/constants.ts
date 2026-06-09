export const DEFAULT_TIMEOUT_MS = 8_000;

export const DEFAULT_SCOPE = 'openid profile email';

export const DEFAULT_RETURN_URL_STORAGE_KEY = 'velvet-auth:return-url';

export const STORED_USER_KEY_PREFIX = 'oidc.user:';

export const ACCOUNT_URL_SUFFIX = '/account';

export const INITIALIZATION_TIMEOUT_MESSAGE = 'Authentication initialization timed out.';

export const CALLBACK_TIMEOUT_MESSAGE = 'Authentication callback timed out.';

export const SILENT_RENEW_TIMEOUT_MESSAGE = 'Silent token renewal timed out.';

export const ACCESS_TOKEN_LOOKUP_TIMEOUT_MESSAGE = 'Access token lookup timed out.';

export const NON_BROWSER_RUNTIME_MESSAGE = 'Cannot resolve the OIDC client outside a browser runtime.';

export const HOOK_OUTSIDE_PROVIDER_MESSAGE = 'useAuth must be called within an AuthProvider.';

export const ADMIN_ROLE = 'admin';

export const MODERATOR_ROLE = 'moderator';

export const INTERACTION_REQUIRED_CODES = [
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
] as const;
