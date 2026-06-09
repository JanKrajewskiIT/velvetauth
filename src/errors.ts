import { INTERACTION_REQUIRED_CODES } from './constants';

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown authentication error.';
}

export function formatSilentRenewError(error: unknown): string {
  const message = messageOf(error);
  const code = (error as { error?: unknown } | null)?.error;
  if (
    typeof code === 'string' &&
    (INTERACTION_REQUIRED_CODES as readonly string[]).includes(code) &&
    !message.includes(code)
  ) {
    return `${message} (${code})`;
  }
  return message;
}
