# Changelog

## Unreleased

### Breaking

- Not assessed. Compare the public surface and behavior against the last published version (2.0.7) before choosing the version bump.

### Added

- Clean-room implementation of the contract in `specs/00-15` v1.2: `AuthProvider`, `useAuth`, `getAuthAccessToken`, `handleAuthRedirectCallback`, `setAuthUserManagerFactory`, and the stand-alone identity, URL, storage, and timing helpers.
- Cross-tab sign-out through a same-origin `BroadcastChannel` scoped to the configuration identity, with per-identity invalidation of late renewal results.
- Return-URL fallback rollback that undoes only the failing sign-in's own write.

### Changed

- Every OIDC operation, including sign-in and sign-out redirects, is bounded by the configured timeout.
- Client identifiers containing `:` are rejected with a descriptive error.
- The configuration identity is the JSON encoding of the ordered, resolved identity tuple.

### Fixed

- Return-URL normalization rejects backslashes, ASCII control characters, and values that do not resolve on the same origin.
