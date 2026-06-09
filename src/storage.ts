import { User } from 'oidc-client-ts';

import { STORED_USER_KEY_PREFIX } from './constants';
import { isBrowserRuntime } from './runtime';

export function buildStoredUserStorageKey(authority: string, clientId: string): string {
  return `${STORED_USER_KEY_PREFIX}${authority}:${clientId}`;
}

export function buildBroadcastChannelName(authority: string, clientId: string): string {
  return `velvet-auth:signal:${authority}:${clientId}`;
}

export function getStoredUser(authority: string, clientId: string): User | null {
  if (!isBrowserRuntime()) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(buildStoredUserStorageKey(authority, clientId));
    if (!raw) {
      return null;
    }
    return User.fromStorageString(raw);
  } catch {
    return null;
  }
}

export function writeReturnUrlFallback(storageKey: string, value: string): void {
  if (!isBrowserRuntime()) {
    return;
  }
  window.sessionStorage.setItem(storageKey, value);
}

export function takeReturnUrlFallback(storageKey: string): string | null {
  if (!isBrowserRuntime()) {
    return null;
  }
  try {
    const value = window.sessionStorage.getItem(storageKey);
    if (value !== null) {
      window.sessionStorage.removeItem(storageKey);
    }
    return value;
  } catch {
    return null;
  }
}

export function removeReturnUrlFallback(storageKey: string): void {
  if (!isBrowserRuntime()) {
    return;
  }
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    /* no-op */
  }
}

export function removeStoredUser(authority: string, clientId: string): void {
  if (!isBrowserRuntime()) {
    return;
  }
  try {
    window.sessionStorage.removeItem(buildStoredUserStorageKey(authority, clientId));
  } catch {
    /* no-op */
  }
}
