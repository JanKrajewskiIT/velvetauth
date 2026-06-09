import { isBrowserRuntime } from './runtime';

const PLACEHOLDER_ORIGIN = 'http://localhost';

function resolveOrigin(origin?: string): string {
  if (origin) {
    return origin;
  }
  if (isBrowserRuntime()) {
    return window.location.origin;
  }
  return PLACEHOLDER_ORIGIN;
}

function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function normalizeReturnUrl(value: string | undefined | null): string {
  if (!value) {
    return '/';
  }
  if (!value.startsWith('/')) {
    return '/';
  }
  if (value.startsWith('//')) {
    return '/';
  }
  return value;
}

export function isOidcCallbackReturnUrl(value: string | undefined, appUrl: string, origin?: string): boolean {
  if (!value) {
    return false;
  }

  const baseOrigin = resolveOrigin(origin);

  let url: URL;
  let redirect: URL;
  try {
    url = new URL(value, baseOrigin);
    redirect = new URL(appUrl, baseOrigin);
  } catch {
    return false;
  }

  if (stripTrailingSlash(url.pathname) !== stripTrailingSlash(redirect.pathname)) {
    return false;
  }

  const params = url.searchParams;
  const hasOutcome = params.has('code') || params.has('error');
  const hasState = params.has('state') || params.has('session_state') || params.has('iss');

  return hasOutcome && hasState;
}

export function getCurrentReturnUrl(): string {
  if (!isBrowserRuntime()) {
    return '/';
  }
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

export function resolveCallbackReturnUrl(state: unknown, appUrl: string): string | undefined {
  if (!state || typeof state !== 'object') {
    return undefined;
  }

  const returnUrl = (state as { returnUrl?: unknown }).returnUrl;
  if (typeof returnUrl !== 'string') {
    return undefined;
  }

  const normalized = normalizeReturnUrl(returnUrl);
  if (isOidcCallbackReturnUrl(normalized, appUrl)) {
    return undefined;
  }

  return normalized;
}
