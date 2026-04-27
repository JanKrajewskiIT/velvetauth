import { User } from 'oidc-client-ts';

interface AccessTokenPayload {
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

interface AuthSignInState {
  returnUrl?: string;
}

export const normalizePathname = (value: string): string => {
  if (!value) {
    return '/';
  }

  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value;
};

export const isBrowserRuntime = (): boolean => typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';

export const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then((value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error(message));
      });
  });

export const decodeAccessTokenPayload = (token: string): AccessTokenPayload => {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('Invalid access token payload');
  }

  const base64 = payload.replace(/-/gu, '+').replace(/_/gu, '/');
  const json = atob(base64);
  return JSON.parse(json) as AccessTokenPayload;
};

export const normalizeReturnUrl = (value: string | undefined): string => {
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
};

export const extractRolesFromAccessToken = (token: string | undefined): string[] => {
  if (!token) {
    return [];
  }

  try {
    const payload = decodeAccessTokenPayload(token);
    const realmRoles = payload.realm_access?.roles ?? [];
    const resourceRoles = payload.resource_access
      ? Object.values(payload.resource_access).flatMap((entry) => entry.roles ?? [])
      : [];

    return [...new Set([...realmRoles, ...resourceRoles])];
  } catch {
    return [];
  }
};

export const getCurrentReturnUrl = (): string => {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

export const isOidcCallbackReturnUrl = (value: string | undefined, appUrl: string, origin?: string): boolean => {
  if (!value) {
    return false;
  }

  try {
    const resolvedOrigin = origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    const currentUrl = new URL(value, resolvedOrigin);
    const authAppUrl = new URL(appUrl, resolvedOrigin);
    const hasAuthQuery = currentUrl.searchParams.has('code') || currentUrl.searchParams.has('error');
    const hasAuthState =
      currentUrl.searchParams.has('state') ||
      currentUrl.searchParams.has('session_state') ||
      currentUrl.searchParams.has('iss');

    return (
      normalizePathname(currentUrl.pathname) === normalizePathname(authAppUrl.pathname) && hasAuthQuery && hasAuthState
    );
  } catch {
    return false;
  }
};

export const resolveCallbackReturnUrl = (state: unknown, appUrl: string): string | undefined => {
  if (!state || typeof state !== 'object') {
    return undefined;
  }

  const stateReturnUrl = (state as AuthSignInState).returnUrl;
  if (typeof stateReturnUrl !== 'string') {
    return undefined;
  }

  const normalized = normalizeReturnUrl(stateReturnUrl);
  return isOidcCallbackReturnUrl(normalized, appUrl) ? undefined : normalized;
};

export const buildStoredUserStorageKey = (authority: string, clientId: string): string =>
  `user:${authority}:${clientId}`;

export const getStoredUser = (authority: string, clientId: string): User | null => {
  if (!isBrowserRuntime()) {
    return null;
  }

  const storedValue = sessionStorage.getItem(buildStoredUserStorageKey(authority, clientId));
  if (!storedValue) {
    return null;
  }

  try {
    return User.fromStorageString(storedValue);
  } catch {
    return null;
  }
};

export const resolveProfileValue = (user: User | null | undefined, keys: string[]): string => {
  const profile = user?.profile as Record<string, unknown> | undefined;
  if (!profile) {
    return '';
  }

  for (const key of keys) {
    const value = profile[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return '';
};

export const matchesRole = (roles: string[], role: string): boolean =>
  roles.some((entry) => entry.toLowerCase() === role.toLowerCase());

export const matchesAnyRole = (roles: string[], ...requiredRoles: string[]): boolean => {
  if (requiredRoles.length === 0) {
    return true;
  }

  return requiredRoles.some((requiredRole) => matchesRole(roles, requiredRole));
};
