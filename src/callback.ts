import type { User } from 'oidc-client-ts';

import { getRedirectUri, getReturnUrlStorageKey, getTimeoutMs, type OidcAuthConfig } from './config';
import { CALLBACK_TIMEOUT_MESSAGE } from './constants';
import { messageOf } from './errors';
import {
  getCurrentReturnUrl,
  isOidcCallbackReturnUrl,
  normalizeReturnUrl,
  resolveCallbackReturnUrl,
} from './return-url';
import { isBrowserRuntime, withTimeout } from './runtime';
import { takeReturnUrlFallback } from './storage';
import { type AuthUserManager, resolveUserManager } from './user-manager';

export interface CallbackOutcome {
  user: User | null;
  error: string | null;
  navigated: boolean;
}

function cleanCurrentUrl(): void {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
}

function navigateAfterCallback(target: string): boolean {
  const currentMinusQuery = `${window.location.pathname}${window.location.hash}`;
  if (target === currentMinusQuery) {
    window.history.replaceState(null, '', currentMinusQuery);
    return false;
  }
  window.location.replace(target);
  return true;
}

function resolvePostCallbackTarget(state: unknown, config: OidcAuthConfig): string {
  const redirectUri = getRedirectUri(config);
  const storedRaw = takeReturnUrlFallback(getReturnUrlStorageKey(config));

  const fromState = resolveCallbackReturnUrl(state, redirectUri);
  if (fromState) {
    return fromState;
  }

  if (storedRaw != null) {
    const normalized = normalizeReturnUrl(storedRaw);
    if (!isOidcCallbackReturnUrl(normalized, redirectUri)) {
      return normalized;
    }
  }

  return '/';
}

export async function exchangeCallback(manager: AuthUserManager, config: OidcAuthConfig): Promise<CallbackOutcome> {
  let user: User;
  try {
    user = await withTimeout(manager.signinRedirectCallback(), getTimeoutMs(config), CALLBACK_TIMEOUT_MESSAGE);
  } catch (error) {
    takeReturnUrlFallback(getReturnUrlStorageKey(config));
    cleanCurrentUrl();
    return { user: null, error: messageOf(error), navigated: false };
  }

  const target = resolvePostCallbackTarget(user.state, config);
  const navigated = navigateAfterCallback(target);
  return { user, error: null, navigated };
}

export async function handleAuthRedirectCallback(config: OidcAuthConfig): Promise<boolean> {
  if (!isBrowserRuntime()) {
    return false;
  }
  if (!isOidcCallbackReturnUrl(getCurrentReturnUrl(), getRedirectUri(config))) {
    return false;
  }

  const manager = resolveUserManager(config);
  const outcome = await exchangeCallback(manager, config);
  return outcome.navigated;
}
