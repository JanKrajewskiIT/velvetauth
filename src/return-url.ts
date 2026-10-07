import { isOidcCallbackReturnUrl } from './callback-detection.ts';
import { APP_ROOT_PATH, parseUrl } from './url.ts';

/** Fixed base used only to prove that a path resolves on the same origin. */
const SAME_ORIGIN_BASE = 'http://return-url.invalid';
const LAST_CONTROL_CHARACTER_CODE = 0x1f;
const DELETE_CHARACTER_CODE = 0x7f;
const BACKSLASH_CHARACTER_CODE = 0x5c;

export interface ReturnUrlState {
  readonly returnUrl: string;
}

const isUnsafeCharacterCode = (code: number): boolean =>
  code <= LAST_CONTROL_CHARACTER_CODE || code === DELETE_CHARACTER_CODE || code === BACKSLASH_CHARACTER_CODE;

const containsUnsafeCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    if (isUnsafeCharacterCode(value.charCodeAt(index))) {
      return true;
    }
  }
  return false;
};

const isReturnUrlState = (state: unknown): state is ReturnUrlState =>
  typeof state === 'object' && state !== null && 'returnUrl' in state && typeof state.returnUrl === 'string';

export const normalizeReturnUrl = (value: string | null | undefined): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || containsUnsafeCharacter(value)) {
    return APP_ROOT_PATH;
  }
  return parseUrl(value, SAME_ORIGIN_BASE)?.origin === SAME_ORIGIN_BASE ? value : APP_ROOT_PATH;
};

/** Normalizes a return URL and discards it when it would re-enter the callback handler. */
export const resolveSafeReturnUrl = (value: string, redirectUri: string): string | undefined => {
  const normalized = normalizeReturnUrl(value);
  return isOidcCallbackReturnUrl(normalized, redirectUri) ? undefined : normalized;
};

export const createReturnUrlState = (returnUrl: string): ReturnUrlState => ({ returnUrl });

export const resolveCallbackReturnUrl = (state: unknown, redirectUri: string): string | undefined =>
  isReturnUrlState(state) ? resolveSafeReturnUrl(state.returnUrl, redirectUri) : undefined;
