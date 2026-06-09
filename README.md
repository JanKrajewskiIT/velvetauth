# @jankrajewskiit/auth

Browser-side OIDC authentication framework for SolidJS applications, wrapping
[`oidc-client-ts`](https://github.com/authts/oidc-client-ts). Centralizes the redirect flow,
callback handling, silent renewal, role parsing, return-URL preservation, and open-redirect
defense behind a single provider.

## Install

```sh
npm install @jankrajewskiit/auth
```

Add the scope-to-registry entry to your `.npmrc`:

```ini
@jankrajewskiit:registry=https://npm.pkg.github.com
```

### Peer dependencies

| Peer             | Minimum version |
| ---------------- | --------------- |
| `solid-js`       | `>=1.9`         |
| `oidc-client-ts` | `>=3.1`         |

## Integration overview

```tsx
import { render } from 'solid-js/web';
import { AuthProvider, getAuthAccessToken, useAuth, type OidcAuthConfig } from '@jankrajewskiit/auth';

export const authConfig: OidcAuthConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
  appUrl: window.location.origin,
  redirectUri: `${window.location.origin}/auth/callback`,
  silentRedirectUri: `${window.location.origin}/auth/silent`,
};

function Toolbar() {
  const auth = useAuth();
  return (
    <>
      {auth.isAuthenticated() ? (
        <button onClick={() => void auth.signOut()}>Sign out {auth.firstName()}</button>
      ) : (
        <button onClick={() => void auth.signIn(location.pathname + location.search)}>Sign in</button>
      )}
    </>
  );
}

render(
  () => (
    <AuthProvider config={authConfig}>
      <Toolbar />
    </AuthProvider>
  ),
  document.getElementById('root')!,
);

export async function fetchWithAuth(url: string, options?: RequestInit) {
  const token = await getAuthAccessToken(authConfig);
  const headers = token ? { ...options?.headers, Authorization: `Bearer ${token}` } : options?.headers;
  return fetch(url, { ...options, headers });
}
```

The consumer hosts the silent-renew callback static asset at the configured `silentRedirectUri`
(same origin as the SPA). The framework does not ship it.

## Public surface

| Export                                                                                                                                            | Description                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `AuthProvider`                                                                                                                                    | Root SolidJS provider; mount once at the tree root, parameterized by the config record. |
| `useAuth`                                                                                                                                         | Hook returning the reactive auth context (throws outside the provider subtree).         |
| `getAuthAccessToken(config)`                                                                                                                      | Off-component async access-token getter with on-demand silent renewal.                  |
| `handleAuthRedirectCallback(config)`                                                                                                              | Standalone callback handler; returns whether a navigation was issued.                   |
| `setAuthUserManagerFactory(factory \| null)`                                                                                                      | Registers (or clears) a custom OIDC client factory; call before mount.                  |
| `extractRolesFromAccessToken(token)`                                                                                                              | De-duplicated realm + resource role union from an access token.                         |
| `matchesRole(roles, role)`                                                                                                                        | Case-insensitive single-role membership check.                                          |
| `matchesAnyRole(roles, ...roles)`                                                                                                                 | Case-insensitive any-role check; `true` for zero required roles.                        |
| `decodeAccessTokenPayload(token)`                                                                                                                 | Decodes the JWT payload segment (throws on malformed input).                            |
| `normalizeReturnUrl(value)`                                                                                                                       | Produces a safe in-app path; `"/"` for unsafe or absent input.                          |
| `isOidcCallbackReturnUrl(value, appUrl, origin?)`                                                                                                 | True iff the URL matches the callback shape and path.                                   |
| `getCurrentReturnUrl()`                                                                                                                           | Current `pathname + search + hash`; `"/"` outside a browser.                            |
| `buildStoredUserStorageKey(authority, clientId)`                                                                                                  | Canonical persisted-user storage key.                                                   |
| `getStoredUser(authority, clientId)`                                                                                                              | Synchronous persisted-user read; `null` when absent or unparseable.                     |
| `getRedirectUri` / `getPostLogoutRedirectUri` / `getSilentRedirectUri` / `getScope` / `getAccountUrl` / `getReturnUrlStorageKey` / `getTimeoutMs` | Configuration-defaults resolvers.                                                       |
| `isBrowserRuntime()`                                                                                                                              | True when `window` and `sessionStorage` are available.                                  |
| `withTimeout(promise, timeoutMs, message)`                                                                                                        | Wraps a promise with a timeout rejection.                                               |

The auth context exposes reactive accessors `user`, `isLoading`, `isAuthenticated`, `error`,
`accessToken`, `roles`, `firstName`, `lastName`, `email`, `username`, `accountUrl`, `isAdmin`,
`isModerator`, `isAdminOrModerator`, the helpers `hasRole` / `hasAnyRole`, and the operations
`signIn(returnUrl?, options?)`, `signOut()`, `signInSilent()`.

## Upgrading

See [CHANGELOG.md](./CHANGELOG.md). Breaking changes ship in a major version with a migration note.

## Provenance verification

Every release is published with an OIDC-signed provenance attestation. Verify it:

```sh
npm audit signatures @jankrajewskiit/auth
```

A passing audit attests that the published tarball was built and signed by this repository's
release workflow via sigstore, not tampered with after publish.

## Release workflow

1. Bump `version` in `package.json` and add the matching `CHANGELOG.md` section.
2. Commit, then tag: `git tag v<semver>`.
3. Push the tag: `git push origin v<semver>`.

The `publish` workflow verifies, checks the tag matches `package.json#version`, and publishes
with provenance. For a broken release, publish a superseding patch and run
`npm deprecate @jankrajewskiit/auth@<version> "<reason>"`. Never `npm unpublish`.

## Branch protection

Re-establish on a fresh fork:

- Require a passing `verify` status check.
- Require a passing audit status check.
- Require at least one approving CODEOWNERS review.
- Require the branch to be up to date before merge.
- Disable force pushes and non-administrative direct pushes to `main`.
