import { APP_ROOT_PATH } from './url.ts';

export const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const { sessionStorage }: { readonly sessionStorage?: Storage } = window;
    return sessionStorage ?? null;
  } catch {
    // Blocked storage throws SecurityError on access; the storage contract treats it as a non-browser runtime.
    return null;
  }
};

export const isBrowserRuntime = (): boolean => getSessionStorage() !== null;

export const getCurrentReturnUrl = (): string => {
  if (typeof window === 'undefined') {
    return APP_ROOT_PATH;
  }
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
};
