import { isBrowserRuntime } from './runtime';

const PLACEHOLDER_ORIGIN = 'https://velvet-auth.invalid';

const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint < 0x20 || codePoint === 0x7f);
  });

export const normalizeReturnUrl = (value: string | undefined): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.includes('\\') || hasControlCharacter(value)) return '/';

  try {
    const resolved = new URL(value, PLACEHOLDER_ORIGIN);
    return resolved.origin === PLACEHOLDER_ORIGIN ? value : '/';
  } catch {
    return '/';
  }
};

export const isOidcCallbackReturnUrl = (value: string | undefined, appUrl: string, origin?: string): boolean => {
  if (!value) return false;
  const baseOrigin = origin ?? (isBrowserRuntime() ? window.location.origin : PLACEHOLDER_ORIGIN);

  try {
    const callbackPath = new URL(appUrl, baseOrigin).pathname.replace(/\/$/u, '') || '/';
    const candidate = new URL(value, baseOrigin);
    const candidatePath = candidate.pathname.replace(/\/$/u, '') || '/';
    const hasResponse = candidate.searchParams.has('code') || candidate.searchParams.has('error');
    const hasCorrelation =
      candidate.searchParams.has('state') ||
      candidate.searchParams.has('session_state') ||
      candidate.searchParams.has('iss');
    return callbackPath === candidatePath && hasResponse && hasCorrelation;
  } catch {
    return false;
  }
};

export const getCurrentReturnUrl = (): string => {
  if (!isBrowserRuntime()) return '/';
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

export const resolveCallbackReturnUrl = (state: unknown, appUrl: string, origin?: string): string | undefined => {
  if (typeof state !== 'object' || state === null || !('returnUrl' in state)) return undefined;
  const value = state.returnUrl;
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeReturnUrl(value);
  return isOidcCallbackReturnUrl(normalized, appUrl, origin) ? undefined : normalized;
};
