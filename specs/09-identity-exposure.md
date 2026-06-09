# Spec 09 — Identity Exposure (Roles, Profile, Account URL)

## Step 1 — Profile fields

The framework exposes reactive profile accessors derived from the OIDC user record. All profile accessors MUST return empty string when the user accessor is null-equivalent. All profile accessors MUST be reactive (memoized derivations) so reads are cheap and re-renders are scoped.

- **First name** — the first non-empty string among the user's `given_name` and `first_name` profile claims; empty string when none are present.
- **Last name** — the first non-empty among `family_name` and `last_name`; empty string fallback.
- **Email** — the `email` profile claim or empty string.
- **Username** — the first non-empty among `preferred_username`, `name`, `sub`; empty string fallback.

Whitespace-only profile field values (e.g. `"   "`) are treated as non-empty by the "first non-empty" rule — consumers may trim if needed.

## Step 2 — Account URL

The account-URL accessor MUST return the configured account console URL when set. When unset, the accessor MUST return the IdP authority URL with a trailing `/account` segment appended. The framework MUST NOT navigate to the account URL; it is consumer-rendered only.

## Step 3 — Roles

The roles accessor MUST decode the access-token JWT payload and return the de-duplicated union of:

- Realm-level roles under a `realm_access.roles` claim.
- Per-resource roles — the union of `roles` arrays under every entry of a `resource_access` claim object.

When the access token is unset, the roles accessor MUST return an empty array. When the access-token payload is unparseable, the roles accessor MUST return an empty array (no throw).

Role membership helpers:

- **Single-role helper** — returns true when at least one entry in the roles accessor matches the supplied role case-insensitively.
- **Any-role helper** — returns true when at least one of the supplied roles matches case-insensitively. Returns true when called with zero required roles.
- **Is admin** — equivalent to checking membership in the role `admin`.
- **Is moderator** — equivalent to checking membership in the role `moderator`.
- **Is admin or moderator** — the logical OR of the previous two.

JWT payload decoding MUST use platform primitives (base64 decoding plus JSON parsing). No external crypto dependency. Decoding MUST tolerate URL-safe base64 by translating its substitutions before standard decoding. The framework MUST NOT verify JWT signatures — signature verification is a backend responsibility.

Role and profile derivation MUST NOT mutate the underlying user record. Role membership MUST be evaluated against the current access token. Role changes from the IdP take effect on the next renewed token.

Role checks at the framework level are UI hints, not authorization. The backend MUST validate every request against its own role policy.

## Step 4 — Stand-alone identity helpers

The framework MUST expose a set of pure helpers from its public surface, callable outside the SolidJS reactive scope. These mirror the in-context accessors but operate on raw inputs the caller provides.

- **`extractRolesFromAccessToken(token: string | undefined): string[]`** — decodes the access token and returns the same de-duplicated role union the in-context roles accessor would produce. Returns an empty array for null, undefined, malformed, and missing-claim inputs.
- **`matchesRole(roles: string[], role: string): boolean`** — returns true iff at least one entry in the supplied array matches the role case-insensitively.
- **`matchesAnyRole(roles: string[], ...requiredRoles: string[]): boolean`** — returns true iff at least one of the required roles matches case-insensitively. Returns true when called with zero required roles.
- **`decodeAccessTokenPayload(token: string): AccessTokenPayload`** — decodes the JWT payload segment (base64url → JSON). Returns the parsed payload object. Throws when the token is malformed or the payload segment is missing. MUST tolerate URL-safe base64. MUST NOT verify the signature.

The stand-alone helpers MUST NOT depend on the SolidJS reactive scope, the auth provider, or any framework singleton. They MUST be safely callable in any runtime (browser, SSR, worker, test).
