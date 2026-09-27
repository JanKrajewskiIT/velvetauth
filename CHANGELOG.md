# Changelog

## 3.0.0

### Breaking

- Standalone callback failures reject instead of resolving `false`.
- Return-URL handling rejects malformed, backslash-containing, and control-character paths.

### Added

- Clean-room SolidJS OIDC authentication package implementation.
- Per-identity OIDC client caching and cross-tab sign-out invalidation.
- ESM package, provenance release workflow, and typed public API.

### Changed

- Every framework-invoked OIDC operation is bounded by the configured timeout.
- Factory and browser storage failures follow explicit API-specific error contracts.

### Fixed

- Late renewal results cannot restore authenticated state or return a token after cross-tab sign-out.

## 2.0.1

### Breaking

- Historical release details are outside the clean-room brief.

### Added

- Historical release details are outside the clean-room brief.

### Changed

- Historical release details are outside the clean-room brief.

### Fixed

- Historical release details are outside the clean-room brief.

## 0.1.0

### Breaking

- None — initial release.

### Added

- `AuthProvider` and `useAuth` reactive auth context for SolidJS.
- `getAuthAccessToken` off-component access-token getter with on-demand silent renewal.
- `handleAuthRedirectCallback` standalone callback handler.
- `setAuthUserManagerFactory` custom OIDC client factory escape hatch.
- Identity, URL, storage, configuration-default, and runtime helpers.

### Changed

- None — initial release.

### Fixed

- None — initial release.
