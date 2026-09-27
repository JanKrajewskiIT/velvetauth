import { User } from 'oidc-client-ts';

import { isBrowserRuntime } from './runtime';

const getSessionStorage = (): Storage | null => {
  if (!isBrowserRuntime()) return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const buildStoredUserStorageKey = (authority: string, clientId: string): string => {
  if (clientId.includes(':')) {
    throw new TypeError('The OIDC client identifier must not contain ":".');
  }
  return `oidc.user:${authority}:${clientId}`;
};

export const getStoredUser = (authority: string, clientId: string): User | null => {
  const store = getSessionStorage();
  if (!store) return null;

  try {
    const serialized = store.getItem(buildStoredUserStorageKey(authority, clientId));
    return serialized ? User.fromStorageString(serialized) : null;
  } catch {
    return null;
  }
};

export const writeReturnUrl = (key: string, returnUrl: string): void => {
  const store = getSessionStorage();
  if (store) store.setItem(key, returnUrl);
};

export const takeReturnUrl = (key: string): string | null => {
  const store = getSessionStorage();
  if (!store) return null;
  const value = store.getItem(key);
  store.removeItem(key);
  return value;
};

export const removeReturnUrl = (key: string): void => {
  const store = getSessionStorage();
  if (store) store.removeItem(key);
};

export const removeStoredUser = (authority: string, clientId: string): void => {
  const store = getSessionStorage();
  if (store) store.removeItem(buildStoredUserStorageKey(authority, clientId));
};
