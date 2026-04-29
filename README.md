# @jankrajewskiit/auth

OIDC authentication package for `SolidJS` applications extracted from `@jankrajewskiit/ui`.

Provides `SolidJS` auth primitives and helpers around `oidc-client-ts`:

- `OidcAuthConfig`, `OidcAuthUserManagerFactoryConfig`
- `AuthProvider`, `useAuth`
- `getUserManager`, `setAuthUserManagerFactory`
- `handleAuthRedirectCallback`, `getAuthAccessToken`
- `getRedirectUri`, `getPostLogoutRedirectUri`, `getReturnUrlStorageKey`, `getTimeoutMs`
- Browser/runtime utilities: `isBrowserRuntime`, `withTimeout`,
  `normalizePathname`, `normalizeReturnUrl`, `getCurrentReturnUrl`,
  `isOidcCallbackReturnUrl`, `resolveCallbackReturnUrl`
- Token utilities: `decodeAccessTokenPayload`, `extractRolesFromAccessToken`,
  `matchesRole`, `matchesAnyRole`
- Stored user helpers: `buildStoredUserStorageKey`, `getStoredUser`,
  `resolveProfileValue`

## Peer dependencies

- `oidc-client-ts`
- `solid-js`

## Notes

This package is intentionally opinionated for `SolidJS` apps and includes the
authentication provider surface together with lower-level OIDC helpers.
