import { parseUrl, trimTrailingSlash } from './url.ts';

const FALLBACK_ORIGIN = 'http://localhost';
const RESULT_PARAMETERS = ['code', 'error'] as const;
const CONTEXT_PARAMETERS = ['state', 'session_state', 'iss'] as const;

const resolveDefaultOrigin = (): string => (typeof window === 'undefined' ? FALLBACK_ORIGIN : window.location.origin);

const hasAnyParameter = (parameters: URLSearchParams, names: readonly string[]): boolean =>
  names.some((name) => parameters.has(name));

export const isOidcCallbackReturnUrl = (
  value: string | undefined,
  redirectUri: string,
  origin: string = resolveDefaultOrigin(),
): boolean => {
  if (!value) {
    return false;
  }
  const url = parseUrl(value, origin);
  const redirect = parseUrl(redirectUri, origin);
  if (url === null || redirect === null) {
    return false;
  }
  return (
    trimTrailingSlash(url.pathname) === trimTrailingSlash(redirect.pathname) &&
    hasAnyParameter(url.searchParams, RESULT_PARAMETERS) &&
    hasAnyParameter(url.searchParams, CONTEXT_PARAMETERS)
  );
};
