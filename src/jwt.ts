export interface AccessTokenPayload {
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [claim: string]: unknown;
}

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeAccessTokenPayload(token: string): AccessTokenPayload {
  const segments = token.split('.');
  if (segments.length < 2 || !segments[1]) {
    throw new Error('Malformed access token: missing payload segment.');
  }
  return JSON.parse(decodeBase64Url(segments[1])) as AccessTokenPayload;
}

export function extractRolesFromAccessToken(token: string | undefined): string[] {
  if (!token) {
    return [];
  }

  let payload: AccessTokenPayload;
  try {
    payload = decodeAccessTokenPayload(token);
  } catch {
    return [];
  }

  const roles = new Set<string>();

  const realmRoles = payload.realm_access?.roles;
  if (Array.isArray(realmRoles)) {
    for (const role of realmRoles) {
      if (typeof role === 'string') {
        roles.add(role);
      }
    }
  }

  const resourceAccess = payload.resource_access;
  if (resourceAccess && typeof resourceAccess === 'object') {
    for (const resource of Object.values(resourceAccess)) {
      const resourceRoles = resource.roles;
      if (Array.isArray(resourceRoles)) {
        for (const role of resourceRoles) {
          if (typeof role === 'string') {
            roles.add(role);
          }
        }
      }
    }
  }

  return [...roles];
}

export function matchesRole(roles: string[], role: string): boolean {
  const target = role.toLowerCase();
  return roles.some((entry) => entry.toLowerCase() === target);
}

export function matchesAnyRole(roles: string[], ...requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => matchesRole(roles, role));
}
