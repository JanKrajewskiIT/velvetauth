import type { User } from 'oidc-client-ts';

export const ADMIN_ROLE = 'admin';
export const MODERATOR_ROLE = 'moderator';

const FIRST_NAME_CLAIMS = ['given_name', 'first_name'] as const;
const LAST_NAME_CLAIMS = ['family_name', 'last_name'] as const;
const USERNAME_CLAIMS = ['preferred_username', 'name', 'sub'] as const;
const BASE64_BLOCK_LENGTH = 4;
const JWT_SEGMENT_COUNT = 3;
const BASE64_URL_PATTERN = /^[\w-]+$/u;

export interface AccessTokenPayload {
  readonly realm_access?: { readonly roles?: readonly string[] };
  readonly resource_access?: Readonly<Record<string, { readonly roles?: readonly string[] }>>;
  readonly [claim: string]: unknown;
}

const utf8Decoder = new TextDecoder();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAccessTokenPayload = (value: unknown): value is AccessTokenPayload => isRecord(value);

const decodeBase64Url = (segment: string): string => {
  const base64 = segment.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / BASE64_BLOCK_LENGTH) * BASE64_BLOCK_LENGTH, '=');
  return utf8Decoder.decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
};

/** Decodes the payload segment only; signature verification is a backend responsibility. */
export const decodeAccessTokenPayload = (token: string): AccessTokenPayload => {
  const segments = token.split('.');
  const payloadSegment = segments[1];
  if (segments.length !== JWT_SEGMENT_COUNT || !payloadSegment) {
    throw new Error('Access token is not a JWT: expected three segments with a payload.');
  }
  if (!BASE64_URL_PATTERN.test(payloadSegment)) {
    throw new Error('Access token payload is not valid base64url.');
  }
  const payload: unknown = JSON.parse(decodeBase64Url(payloadSegment));
  if (!isAccessTokenPayload(payload)) {
    throw new Error('Access token payload is not a JSON object.');
  }
  return payload;
};

const readRoles = (claim: unknown): string[] => {
  if (!isRecord(claim) || !Array.isArray(claim.roles)) {
    return [];
  }
  return claim.roles.filter((role): role is string => typeof role === 'string');
};

export const extractRolesFromAccessToken = (token: string | null | undefined): string[] => {
  if (!token) {
    return [];
  }
  let payload: AccessTokenPayload;
  try {
    payload = decodeAccessTokenPayload(token);
  } catch {
    // A malformed token must never crash the UI; it simply carries no roles.
    return [];
  }
  const resourceAccess: unknown = payload.resource_access;
  const resourceRoles = isRecord(resourceAccess) ? Object.values(resourceAccess).flatMap(readRoles) : [];
  return [...new Set([...readRoles(payload.realm_access), ...resourceRoles])];
};

export const matchesRole = (roles: readonly string[], role: string): boolean => {
  const expected = role.toLowerCase();
  return roles.some((candidate) => candidate.toLowerCase() === expected);
};

export const matchesAnyRole = (roles: readonly string[], ...requiredRoles: string[]): boolean =>
  requiredRoles.length === 0 || requiredRoles.some((role) => matchesRole(roles, role));

const readFirstNonEmptyClaim = (user: User | null, claims: readonly string[]): string => {
  for (const claim of claims) {
    const value = user?.profile[claim];
    if (typeof value === 'string' && value !== '') {
      return value;
    }
  }
  return '';
};

export const getFirstName = (user: User | null): string => readFirstNonEmptyClaim(user, FIRST_NAME_CLAIMS);

export const getLastName = (user: User | null): string => readFirstNonEmptyClaim(user, LAST_NAME_CLAIMS);

export const getEmail = (user: User | null): string => {
  const email = user?.profile.email;
  return typeof email === 'string' ? email : '';
};

export const getUsername = (user: User | null): string => readFirstNonEmptyClaim(user, USERNAME_CLAIMS);

export const getAccessToken = (user: User | null | undefined): string | undefined => user?.access_token;
