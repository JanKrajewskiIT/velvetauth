# @jankrajewskiit/auth

Browser-side OIDC authentication for SolidJS, wrapping [`oidc-client-ts`](https://github.com/authts/oidc-client-ts). It covers the redirect flow, callback handling, silent renewal, cross-tab sign-out, role parsing, and open-redirect protection behind one provider and one hook.

## Install

Route the package scope to the registry in your `.npmrc` (credentials are supplied by your environment, never committed):

```ini
@jankrajewskiit:registry=https://npm.pkg.github.com
```

```sh
npm install @jankrajewskiit/auth oidc-client-ts solid-js
```

| Peer dependency  | Minimum |
| ---------------- | ------- |
| `solid-js`       | 1.9     |
| `oidc-client-ts` | 3.1     |

The package is ESM-only and ships its own types.

## Integration overview

```tsx
// auth.ts — hoist the configuration to module scope so every consumer shares one identity
import type { OidcAuthConfig } from '@jankrajewskiit/auth';

export const authConfig: OidcAuthConfig = {
  authority: 'https://idp.example.com/realms/main',
  clientId: 'my-spa',
  appUrl: window.location.origin,
  redirectUri: `${window.location.origin}/auth/callback`,
  silentRedirectUri: `${window.location.origin}/silent-callback.html`,
};
```

```tsx
// index.tsx — the provider wraps the router, never the other way round
import { AuthProvider } from '@jankrajewskiit/auth';
import { render } from 'solid-js/web';

render(
  () => (
    <AuthProvider config={authConfig}>
      <App />
    </AuthProvider>
  ),
  document.getElementById('root')!,
);
```

```tsx
// Anywhere inside the provider
import { getCurrentReturnUrl, useAuth } from '@jankrajewskiit/auth';

const auth = useAuth();

<Show
  when={auth.isAuthenticated()}
  fallback={<button onClick={() => auth.signIn(getCurrentReturnUrl())}>Sign in</button>}
>
  <p>Hello, {auth.firstName()}</p>
  <button onClick={() => auth.signOut()}>Sign out</button>
</Show>;
```

```ts
// Anywhere else (fetch wrappers, interceptors): no provider and no SolidJS reactivity required
import { getAuthAccessToken } from '@jankrajewskiit/auth';

export const fetchWithAuth = async (url: string, options?: RequestInit): Promise<Response> => {
  const token = await getAuthAccessToken(authConfig);
  const headers = token ? { ...options?.headers, Authorization: `Bearer ${token}` } : options?.headers;
  return fetch(url, { ...options, headers });
};
```

### Behavior to know before integrating

- **Tab-scoped sessions.** The user is stored in `sessionStorage`; closing the tab signs the user out. Anything else (cross-tab persistence, extra scopes, session monitoring, userinfo) goes through `setAuthUserManagerFactory`, which must be called **before** the provider mounts. When the factory moves the user store off `sessionStorage`, hydration cannot read it synchronously; the asynchronous bootstrap resolves the user instead.
- **Require-remount.** Identity-bearing fields (`authority`, `clientId`, `appUrl`, the redirect URIs, `scope`) are captured at mount. Changing them, or registering a factory after mount, requires unmounting and remounting the provider. `accountUrl`, `timeoutMs`, and `returnUrlStorageKey` are read live.
- **Pick one callback mode.** Either let the provider process the callback inline, or call `handleAuthRedirectCallback(config)` from a dedicated route. Using both makes one of them fail with a "code already consumed" error.
- **Silent renewal needs a hosted page.** The package does not ship the silent-callback asset. Serve a same-origin static page at `silentRedirectUri` that calls `new UserManager(...).signinSilentCallback()` (or the equivalent for your factory).
- **Timeouts bound the wait, not the work.** Every OIDC operation is bounded by `timeoutMs` (default 8 s). A timeout does not cancel the underlying operation; a late redirect or renewal can still happen.
- **Getter and provider are isolated.** Renewals started by `getAuthAccessToken` never update a mounted provider, so a fetch wrapper cannot cause UI churn. While such a renewal is pending (including after its timeout, for at most 60 s), `userLoaded` and `silentRenewError` events from the shared client are not applied to the provider.
- **Roles are UI hints.** The access token is decoded, not verified. The backend must authorize every request.
- **No console output.** Diagnostics are surfaced only through the `error` accessor and rejected promises.

## Public surface

| Export                                                                                                  | Description                                                                                  |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `AuthProvider`                                                                                          | Root provider; takes `config` and renders children immediately.                              |
| `useAuth`                                                                                               | Returns the reactive `AuthContextValue`; throws outside the provider.                        |
| `getAuthAccessToken(config)`                                                                            | Off-component token getter; renews an expired token on demand, resolves `undefined` if none. |
| `handleAuthRedirectCallback(config)`                                                                    | Standalone callback handler; resolves whether a navigation was issued, rejects on failure.   |
| `setAuthUserManagerFactory(factory \| null)`                                                            | Registers or clears the custom OIDC client factory and invalidates cached clients.           |
| `extractRolesFromAccessToken`, `matchesRole`, `matchesAnyRole`, `decodeAccessTokenPayload`              | Pure role and JWT-payload helpers (no signature verification).                               |
| `normalizeReturnUrl`, `isOidcCallbackReturnUrl`, `getCurrentReturnUrl`                                  | Pure URL helpers for return-URL safety and callback detection.                               |
| `buildStoredUserStorageKey`, `getStoredUser`                                                            | Compute the persisted-user key and read the persisted user synchronously.                    |
| `getRedirectUri`, `getPostLogoutRedirectUri`, `getSilentRedirectUri`, `getAccountUrl`, `getScope`       | Resolve a configuration field with its default applied.                                      |
| `getTimeoutMs`, `getReturnUrlStorageKey`                                                                | Resolve the timeout and return-URL storage key with defaults applied.                        |
| `DEFAULT_TIMEOUT_MS`, `DEFAULT_SCOPE`, `DEFAULT_RETURN_URL_STORAGE_KEY`                                 | Default values as discoverable constants.                                                    |
| `isBrowserRuntime`, `withTimeout`                                                                       | Runtime detection and a timeout wrapper that bounds the wait only.                           |
| Types: `OidcAuthConfig`, `AuthProviderProps`, `AuthContextValue`, `SignInOptions`, `AccessTokenPayload` | Configuration, provider, context, sign-in options, and token payload.                        |
| Types: `OidcAuthUserManagerFactoryConfig`, `AuthUserManager`, `OidcAuthUserManagerFactory`              | Contracts for custom OIDC client factories.                                                  |

## Errors

The `error` accessor holds the last error message and is `null` after any successful operation. Framework-defined timeout messages are `Authentication initialization timed out.`, `Authentication callback timed out.`, `Sign-in redirect timed out.`, `Sign-out redirect timed out.`, `Silent renewal timed out.`, and `Access-token user lookup timed out.`. Token-shaped values, bearer credentials, and authorization codes are redacted from dependency error text on a best-effort basis. `getAuthAccessToken` and `handleAuthRedirectCallback` reject instead of using the accessor.

## Upgrading

See [CHANGELOG.md](CHANGELOG.md) for every published version. When a new major ships, this section will name the last supported release of the previous major.

## Provenance verification

Releases are published with npm provenance. Verify an installed copy with:

```sh
npm audit signatures @jankrajewskiit/auth
```

A passing audit attests that the tarball was built and published by this repository's release workflow from the tagged commit, and that its registry signature is valid.

## Release workflow

1. Update `version` in `package.json` and add the matching `CHANGELOG.md` section in the same commit.
2. Tag that commit `v<version>` and push the tag. Only a tag push publishes.
3. The workflow verifies, checks the tag against `package.json#version`, then publishes with `npm publish --provenance --access public`.

A published version is never unpublished. For a broken release, publish a superseding patch and run `npm deprecate @jankrajewskiit/auth@<broken-version> "<reason>"`. If sigstore is unreachable, re-run the workflow for the same tag; do not move the tag.

## Branch protection

Configure the default branch to require:

- a passing `verify` status check;
- a passing `audit` status check;
- at least one approving review from a CODEOWNER;
- an up-to-date branch before merging;
- no force pushes and no direct pushes by non-administrators.

The `@jankrajewskiit/configs` package must also grant this repository Actions access with at least the `Read` role, otherwise `npm ci` fails with `403 Forbidden`.
