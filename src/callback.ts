import type { User } from 'oidc-client-ts';

import { isOidcCallbackReturnUrl } from './callback-detection.ts';
import type { OidcAuthConfig, ResolvedAuthConfig } from './config.ts';
import { resolveAuthConfig } from './config.ts';
import { AUTH_TIMEOUT_MESSAGES } from './errors.ts';
import { resolveCallbackReturnUrl, resolveSafeReturnUrl } from './return-url.ts';
import { getCurrentReturnUrl, isBrowserRuntime } from './runtime.ts';
import type { ReturnUrlFallback } from './storage.ts';
import { consumeReturnUrl } from './storage.ts';
import { withTimeout } from './timeout.ts';
import { APP_ROOT_PATH } from './url.ts';
import type { AuthUserManager } from './user-manager.ts';
import { getAuthUserManager } from './user-manager.ts';

export interface CallbackOutcome {
  readonly user: User;
  readonly navigated: boolean;
  readonly fallbackError: Error | undefined;
}

export interface CallbackOptions {
  /** Return false once the owner is gone so the callback no longer navigates. */
  readonly isActive?: () => boolean;
}

const alwaysActive = (): boolean => true;

export const isCurrentUrlCallback = (config: ResolvedAuthConfig): boolean =>
  isOidcCallbackReturnUrl(getCurrentReturnUrl(), config.redirectUri);

const stripCallbackQuery = (): void => {
  const { pathname, hash } = window.location;
  window.history.replaceState(window.history.state, '', `${pathname}${hash}`);
};

/** Cleans the callback URL and drops the return-URL fallback after a failure that the caller reports. */
export const discardCallback = (config: ResolvedAuthConfig): void => {
  stripCallbackQuery();
  // The caller surfaces the primary failure; a cleanup failure here must not replace it.
  consumeReturnUrl(config.returnUrlStorageKey);
};

const resolveCallbackTarget = (config: ResolvedAuthConfig, state: unknown, fallback: ReturnUrlFallback): string => {
  const fromState = resolveCallbackReturnUrl(state, config.redirectUri);
  const fromFallback =
    fallback.ok && fallback.value !== null ? resolveSafeReturnUrl(fallback.value, config.redirectUri) : undefined;
  return fromState ?? fromFallback ?? APP_ROOT_PATH;
};

/** Returns true only when a full navigation was issued. */
const navigateToTarget = (target: string): boolean => {
  const { pathname, hash } = window.location;
  if (target === `${pathname}${hash}`) {
    stripCallbackQuery();
    return false;
  }
  window.location.replace(target);
  return true;
};

/**
 * Exchanges the current callback URL and moves the user to their return URL.
 * Rejects after cleaning the URL when resolution or the exchange fails.
 */
export const completeRedirectCallback = async (
  config: ResolvedAuthConfig,
  getManager: () => AuthUserManager,
  { isActive = alwaysActive }: CallbackOptions = {},
): Promise<CallbackOutcome> => {
  let user: User;
  try {
    user = await withTimeout(
      getManager().signinRedirectCallback(window.location.href),
      config.timeoutMs,
      AUTH_TIMEOUT_MESSAGES.callback,
    );
  } catch (error) {
    discardCallback(config);
    throw error;
  }

  const fallback = consumeReturnUrl(config.returnUrlStorageKey);
  const target = resolveCallbackTarget(config, user.state, fallback);
  const navigated = isActive() ? navigateToTarget(target) : false;
  return { user, navigated, fallbackError: fallback.ok ? undefined : fallback.error };
};

export const handleAuthRedirectCallback = async (config: OidcAuthConfig): Promise<boolean> => {
  if (!isBrowserRuntime()) {
    return false;
  }
  const resolved = resolveAuthConfig(config);
  if (!isCurrentUrlCallback(resolved)) {
    return false;
  }
  const outcome = await completeRedirectCallback(resolved, () => getAuthUserManager(resolved));
  if (outcome.fallbackError !== undefined) {
    throw outcome.fallbackError;
  }
  return outcome.navigated;
};
