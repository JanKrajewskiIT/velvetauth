import type { User } from 'oidc-client-ts';

import { getReturnUrlStorageKey, getTimeoutMs } from './config';
import { getConfigIdentity } from './config';
import { getSafeErrorMessage } from './errors';
import { beginManagedRenewal } from './renewal-state';
import { isOidcCallbackReturnUrl, normalizeReturnUrl, resolveCallbackReturnUrl } from './return-url';
import { isBrowserRuntime, withTimeout } from './runtime';
import { removeReturnUrl, takeReturnUrl } from './storage';
import type { OidcAuthConfig } from './types';
import { getAuthUserManager } from './user-manager';

export interface AuthCallbackResult {
  user: User;
  navigated: boolean;
  cleanupError?: unknown;
}

const cleanCallbackUrl = (): void => {
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`);
};

const navigateAfterCallback = (target: string): boolean => {
  const currentWithoutQuery = `${window.location.pathname}${window.location.hash}`;
  if (target === currentWithoutQuery) {
    cleanCallbackUrl();
    return false;
  }

  window.location.replace(target);
  return true;
};

export const cleanupFailedAuthCallback = (config: OidcAuthConfig): unknown => {
  let cleanupError: unknown;
  try {
    takeReturnUrl(getReturnUrlStorageKey(config));
  } catch (error: unknown) {
    cleanupError = error;
  }
  cleanCallbackUrl();
  return cleanupError;
};

export const processAuthRedirectCallback = async (
  config: OidcAuthConfig,
  canNavigate: () => boolean = () => true,
): Promise<AuthCallbackResult> => {
  const callbackUrl = window.location.href;
  const callbackPath = config.redirectUri ?? config.appUrl;
  let user: User | null = null;
  let exchangeError: unknown;

  try {
    const manager = getAuthUserManager(config);
    const finishCallback = beginManagedRenewal(getConfigIdentity(config));
    let callbackExchange: ReturnType<typeof manager.signinRedirectCallback>;
    try {
      callbackExchange = manager.signinRedirectCallback(callbackUrl);
    } catch (error: unknown) {
      finishCallback();
      throw error;
    }
    callbackExchange.then(finishCallback, finishCallback);
    user = await withTimeout(callbackExchange, getTimeoutMs(config), 'Authentication callback timed out.');
  } catch (error: unknown) {
    exchangeError = error;
  }

  let fallback: string | null = null;
  let cleanupError: unknown;
  try {
    fallback = takeReturnUrl(getReturnUrlStorageKey(config));
  } catch (error: unknown) {
    cleanupError = error;
  } finally {
    cleanCallbackUrl();
  }
  if (exchangeError !== undefined) throw new Error(getSafeErrorMessage(exchangeError));
  if (!user) throw new Error('The OIDC callback completed without a user.');

  const stateTarget = resolveCallbackReturnUrl(user.state, callbackPath, window.location.origin);
  const normalizedFallback = normalizeReturnUrl(fallback ?? undefined);
  const fallbackTarget =
    !cleanupError && !isOidcCallbackReturnUrl(normalizedFallback, callbackPath, window.location.origin)
      ? normalizedFallback
      : undefined;
  const target = stateTarget ?? fallbackTarget ?? '/';
  const navigated = canNavigate() ? navigateAfterCallback(target) : false;

  return { user, navigated, cleanupError };
};

export const handleAuthRedirectCallback = async (config: OidcAuthConfig): Promise<boolean> => {
  if (!isBrowserRuntime()) return false;
  const callbackPath = config.redirectUri ?? config.appUrl;
  if (!isOidcCallbackReturnUrl(window.location.href, callbackPath, window.location.origin)) {
    return false;
  }

  try {
    const result = await processAuthRedirectCallback(config);
    if (result.cleanupError !== undefined) {
      throw new Error('The callback return-URL fallback could not be removed.');
    }
    return result.navigated;
  } catch (error: unknown) {
    try {
      removeReturnUrl(getReturnUrlStorageKey(config));
    } catch {
      // Preserve the callback failure while still attempting URL cleanup.
    }
    cleanCallbackUrl();
    throw error;
  }
};
