# Changelog

## 0.1.0

### Breaking

- None — initial release.

### Added

- `AuthProvider` and `useAuth` reactive auth context for SolidJS.
- `getAuthAccessToken` off-component access-token getter with on-demand silent renewal.
- `handleAuthRedirectCallback` standalone callback handler.
- `setAuthUserManagerFactory` custom OIDC client factory escape hatch.
- Identity helpers: `extractRolesFromAccessToken`, `matchesRole`, `matchesAnyRole`, `decodeAccessTokenPayload`.
- URL helpers: `normalizeReturnUrl`, `isOidcCallbackReturnUrl`, `getCurrentReturnUrl`.
- Storage helpers: `buildStoredUserStorageKey`, `getStoredUser`.
- Configuration resolvers: `getRedirectUri`, `getPostLogoutRedirectUri`, `getReturnUrlStorageKey`, `getTimeoutMs`, `getScope`, `getSilentRedirectUri`, `getAccountUrl`.
- Runtime helpers: `isBrowserRuntime`, `withTimeout`.

### Changed

- None — initial release.

### Fixed

- None — initial release.
