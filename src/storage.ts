import { User } from 'oidc-client-ts';

import { assertValidClientId } from './config.ts';
import { AUTH_ERROR_MESSAGES } from './errors.ts';
import { getSessionStorage } from './runtime.ts';

/** Matches the key `oidc-client-ts` derives from its default `oidc.` store prefix and `user:<authority>:<client_id>`. */
const STORED_USER_KEY_PREFIX = 'oidc.user:';

export type ReturnUrlFallback =
  { readonly ok: true; readonly value: string | null } | { readonly ok: false; readonly error: Error };

export interface StagedReturnUrl {
  readonly rollback: () => void;
}

export const buildStoredUserStorageKey = (authority: string, clientId: string): string => {
  assertValidClientId(clientId);
  return `${STORED_USER_KEY_PREFIX}${authority}:${clientId}`;
};

/** Stored JSON is untrusted: `fromStorageString` accepts any object, so the token must be checked here. */
const hasAccessToken = (user: { readonly access_token?: unknown }): boolean =>
  typeof user.access_token === 'string' && user.access_token !== '';

export const getStoredUser = (authority: string, clientId: string): User | null => {
  const key = buildStoredUserStorageKey(authority, clientId);
  const storage = getSessionStorage();
  if (storage === null) {
    return null;
  }
  try {
    const serialized = storage.getItem(key);
    const user = serialized === null ? null : User.fromStorageString(serialized);
    return user !== null && hasAccessToken(user) ? user : null;
  } catch {
    // An unreadable or corrupted entry must hydrate as unauthenticated rather than crash the provider.
    return null;
  }
};

export const removeStoredUser = (authority: string, clientId: string): void => {
  const key = buildStoredUserStorageKey(authority, clientId);
  try {
    getSessionStorage()?.removeItem(key);
  } catch {
    // Applying a cross-tab sign-out must still move the tab to the unauthenticated state.
  }
};

const restoreReturnUrl = (storage: Storage, key: string, staged: string, previous: string | null): void => {
  try {
    if (storage.getItem(key) !== staged) {
      return;
    }
    if (previous === null) {
      storage.removeItem(key);
    } else {
      storage.setItem(key, previous);
    }
  } catch {
    // A failed rollback must not replace the sign-in failure that triggered it.
  }
};

/** Persists the fallback and returns a rollback that only undoes this write, never a newer one. */
export const stageReturnUrl = (key: string, value: string): StagedReturnUrl => {
  const storage = getSessionStorage();
  if (storage === null) {
    throw new Error(AUTH_ERROR_MESSAGES.browserRequired);
  }
  let previous: string | null;
  try {
    previous = storage.getItem(key);
    storage.setItem(key, value);
  } catch (cause) {
    throw new Error(AUTH_ERROR_MESSAGES.returnUrlPersist, { cause });
  }
  return { rollback: () => restoreReturnUrl(storage, key, value, previous) };
};

/** Reads and removes the fallback; a value is only reported when its removal succeeded. */
export const consumeReturnUrl = (key: string): ReturnUrlFallback => {
  const storage = getSessionStorage();
  if (storage === null) {
    return { ok: true, value: null };
  }
  try {
    const value = storage.getItem(key);
    storage.removeItem(key);
    return { ok: true, value };
  } catch (cause) {
    return { ok: false, error: new Error(AUTH_ERROR_MESSAGES.returnUrlCleanup, { cause }) };
  }
};
