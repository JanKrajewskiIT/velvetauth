import type { AccessTokenPayload } from './types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const decodeAccessTokenPayload = (token: string): AccessTokenPayload => {
  const segments = token.split('.');
  const encoded = segments[1];
  if (segments.length !== 3 || !encoded) {
    throw new TypeError('The access token is not a valid JWT.');
  }

  if (!/^[A-Za-z0-9_-]+$/u.test(encoded)) {
    throw new TypeError('The access token payload is not valid base64url.');
  }

  const base64 = encoded.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(payload)) {
    throw new TypeError('The access token payload must be a JSON object.');
  }

  return payload;
};

const roleArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((role): role is string => typeof role === 'string') : [];

export const extractRolesFromAccessToken = (token: string | undefined): string[] => {
  if (!token) return [];

  try {
    const payload = decodeAccessTokenPayload(token);
    const roles = new Set<string>();
    const realmAccess = payload.realm_access;
    if (isRecord(realmAccess)) {
      roleArray(realmAccess.roles).forEach((role) => roles.add(role));
    }

    const resources = payload.resource_access;
    if (isRecord(resources)) {
      Object.values(resources).forEach((resource) => {
        if (isRecord(resource)) roleArray(resource.roles).forEach((role) => roles.add(role));
      });
    }

    return [...roles];
  } catch {
    return [];
  }
};

export const matchesRole = (roles: string[], role: string): boolean =>
  roles.some((candidate) => candidate.toLowerCase() === role.toLowerCase());

export const matchesAnyRole = (roles: string[], ...requiredRoles: string[]): boolean =>
  requiredRoles.length === 0 || requiredRoles.some((role) => matchesRole(roles, role));
