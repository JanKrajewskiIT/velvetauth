# Changelog

## 3.5.5

- Handle unexpected detached authentication bootstrap failures in observable session state.
- Require Configs 3.6 development tooling and add architecture, duplication and blocking unused-code checks.

## 3.4.2

- Add shared source/image security gates, CycloneDX SBOMs, pinned CI tooling, periodic security scans and Knip reports without changing the package version.

- Enforce the shared toolchain/editor/lint gates, validate published NodeNext declarations, and publish verified archives.

- Use Configs 3.5, CSS-free staged tasks and consistent formatting/ESLint gates.

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
