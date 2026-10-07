export const AUTH_TIMEOUT_MESSAGES = {
  bootstrap: 'Authentication initialization timed out.',
  callback: 'Authentication callback timed out.',
  signIn: 'Sign-in redirect timed out.',
  signOut: 'Sign-out redirect timed out.',
  silentRenewal: 'Silent renewal timed out.',
  accessTokenLookup: 'Access-token user lookup timed out.',
} as const;

export const AUTH_ERROR_MESSAGES = {
  unknown: 'Authentication failed.',
  browserRequired: 'The OIDC client can only be resolved in a browser runtime with sessionStorage available.',
  providerRequired: 'useAuth must be called inside an AuthProvider.',
  returnUrlPersist: 'Failed to store the return URL.',
  returnUrlCleanup: 'Failed to remove the stored return URL.',
} as const;

export const INTERACTION_REQUIRED_CODES = [
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
] as const;

const SECRET_PARAMETERS = 'access_token|refresh_token|id_token|client_secret|code_verifier|code';
const SECRET_ASSIGNMENT = new RegExp(`\\b(${SECRET_PARAMETERS})=[^&\\s]+`, 'giu');
const SECRET_JSON_FIELD = new RegExp(`"(${SECRET_PARAMETERS})"\\s*:\\s*"[^"]*"`, 'giu');
const BEARER_CREDENTIAL = /\bBearer\s+[\w.~+/=-]+/giu;
const JWT_SHAPED_TOKEN = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/gu;

/** Best-effort redaction of token-shaped values in dependency error text; it is not a complete sanitizer. */
const redactSecrets = (message: string): string =>
  message
    .replace(SECRET_ASSIGNMENT, '$1=[redacted]')
    .replace(SECRET_JSON_FIELD, '"$1":"[redacted]"')
    .replace(BEARER_CREDENTIAL, 'Bearer [redacted]')
    .replace(JWT_SHAPED_TOKEN, '[redacted token]');

const readErrorCode = (error: Error): string | undefined =>
  'error' in error && typeof error.error === 'string' ? error.error : undefined;

const isInteractionRequiredCode = (code: string): boolean => INTERACTION_REQUIRED_CODES.some((known) => known === code);

const describeError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  if (!(error instanceof Error)) {
    return '';
  }
  const code = readErrorCode(error);
  const exposesCode = code !== undefined && isInteractionRequiredCode(code) && !error.message.includes(code);
  return exposesCode ? `${code}: ${error.message}` : error.message;
};

export const toErrorMessage = (error: unknown): string => {
  const message = redactSecrets(describeError(error));
  return message === '' ? AUTH_ERROR_MESSAGES.unknown : message;
};
