import { APP_ROOT_PATH } from './url.ts';

const readSessionStorage = ({ sessionStorage }: { readonly sessionStorage?: Storage }): Storage | null =>
  sessionStorage ?? null;

export const getSessionStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return readSessionStorage(window);
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
