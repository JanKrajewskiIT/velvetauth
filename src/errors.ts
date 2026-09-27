const SECRET_ASSIGNMENT =
  /\b(access_token|refresh_token|id_token|client_secret|code_verifier|authorization_code|code)=([^&\s]+)/giu;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/gu;

export const getSafeErrorMessage = (error: unknown, fallback = 'Authentication failed.'): string => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
  return message.replace(SECRET_ASSIGNMENT, '$1=[redacted]').replace(JWT_PATTERN, '[redacted token]');
};

export const getInteractionErrorMessage = (error: Error): string => {
  const code =
    typeof error === 'object' && 'error' in error && typeof error.error === 'string' ? error.error : undefined;
  const interactionCodes = new Set([
    'login_required',
    'interaction_required',
    'consent_required',
    'account_selection_required',
  ]);
  const message = getSafeErrorMessage(error);
  return code && interactionCodes.has(code) && !message.includes(code) ? `${message} (${code})` : message;
};
