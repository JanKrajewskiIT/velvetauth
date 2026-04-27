# @jankrajewskiit/auth

Headless OIDC authentication primitives extracted from `@jankrajewskiit/ui`.

Provides framework-agnostic helpers around `oidc-client-ts`:

- `OidcAuthConfig`, `OidcAuthUserManagerFactoryConfig`
- `getUserManager`, `setAuthUserManagerFactory`
- `handleAuthRedirectCallback`, `getAuthAccessToken`
- `getReturnUrlStorageKey`, `getTimeoutMs`
- Browser/runtime utilities: `isBrowserRuntime`, `withTimeout`,
  `normalizePathname`, `normalizeReturnUrl`, `getCurrentReturnUrl`,
  `isOidcCallbackReturnUrl`, `resolveCallbackReturnUrl`
- Token utilities: `decodeAccessTokenPayload`, `extractRolesFromAccessToken`,
  `matchesRole`, `matchesAnyRole`
- Stored user helpers: `buildStoredUserStorageKey`, `getStoredUser`,
  `resolveProfileValue`

## Peer dependencies

- `oidc-client-ts`

## Notes

UI-bound pieces (`AuthProvider`, `AuthGuard`, `AuthActionButton`) remain in
`@jankrajewskiit/ui` since they depend on theme components and i18n. This
package contains only the headless layer that any Solid/React/vanilla app can
consume.
