# @jankrajewskiit/auth

Browser-side OIDC authentication for SolidJS, backed by `oidc-client-ts`.

## Install

```sh
npm install @jankrajewskiit/auth solid-js oidc-client-ts
```

Add the GitHub Packages scope and a locally configured token to `.npmrc`:

```ini
@jankrajewskiit:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GHCR_TOKEN}
```

Peer dependency minimums: `solid-js >=1.9` and `oidc-client-ts >=3.1`.

## Integration

```tsx
import { render } from 'solid-js/web';
import { AuthProvider, getAuthAccessToken, getCurrentReturnUrl, useAuth } from '@jankrajewskiit/auth';
import type { OidcAuthConfig } from '@jankrajewskiit/auth';

const config: OidcAuthConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
  appUrl: window.location.origin,
  redirectUri: `${window.location.origin}/auth/callback`,
  silentRedirectUri: `${window.location.origin}/auth/silent-callback.html`,
};

const Account = () => {
  const auth = useAuth();
  return (
    <>
      <span>{auth.isAuthenticated() ? auth.username() : 'Signed out'}</span>
      <button onClick={() => void auth.signIn(getCurrentReturnUrl())}>Sign in</button>
      <button onClick={() => void auth.signOut()}>Sign out</button>
    </>
  );
};

export const App = () => (
  <AuthProvider config={config}>
    <Account />
  </AuthProvider>
);

export const fetchWithAuth = async (url: string, init?: RequestInit) => {
  const token = await getAuthAccessToken(config);
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
};

render(() => <App />, document.getElementById('root')!);
```

Register a custom OIDC user-manager factory before mounting `AuthProvider`. Identity-bearing configuration changes require unmounting and remounting the provider. The callback may be handled inline by the provider or by `handleAuthRedirectCallback(config)` on a dedicated route; use exactly one mode. Host the silent callback HTML at the configured URI on the SPA origin. The library does not ship that deployment asset.

## Public API

| Export                                                                                                                                      | Description                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `AuthProvider`, `AuthProviderProps`                                                                                                         | Root provider and its props.                    |
| `useAuth`, `AuthContextValue`                                                                                                               | Reactive authentication context.                |
| `getAuthAccessToken`                                                                                                                        | Token getter for non-component code.            |
| `handleAuthRedirectCallback`                                                                                                                | Standalone callback processor.                  |
| `setAuthUserManagerFactory`, `OidcAuthUserManagerFactory`, `OidcAuthUserManagerFactoryConfig`, `AuthUserManager`                            | OIDC manager factory extension point and types. |
| `OidcAuthConfig`, `SignInOptions`                                                                                                           | Consumer configuration and per-sign-in options. |
| `AccessTokenPayload`                                                                                                                        | Decoded JWT payload type.                       |
| `decodeAccessTokenPayload`, `extractRolesFromAccessToken`, `matchesRole`, `matchesAnyRole`                                                  | Token and role helpers.                         |
| `normalizeReturnUrl`, `isOidcCallbackReturnUrl`, `getCurrentReturnUrl`                                                                      | URL helpers.                                    |
| `buildStoredUserStorageKey`, `getStoredUser`                                                                                                | Synchronous persisted-user helpers.             |
| `getRedirectUri`, `getPostLogoutRedirectUri`, `getSilentRedirectUri`, `getScope`, `getAccountUrl`, `getReturnUrlStorageKey`, `getTimeoutMs` | Resolved configuration accessors.               |
| `DEFAULT_TIMEOUT_MS`, `DEFAULT_SCOPE`, `DEFAULT_RETURN_URL_STORAGE_KEY`                                                                     | Discoverable default values.                    |
| `isBrowserRuntime`, `withTimeout`                                                                                                           | Runtime and timing helpers.                     |

## Upgrading

This is the clean-room 3.x contract. The previous major's last recorded release is [2.0.1](CHANGELOG.md). See [CHANGELOG.md](CHANGELOG.md) for versioned changes.

## Verify provenance

```sh
npm audit signatures @jankrajewskiit/auth
```

A passing audit confirms npm's provenance attestation and signature metadata for the package version being inspected.

## Release

Update `package.json` and `CHANGELOG.md`, run `npm run verify`, create a `v<semver>` tag matching the manifest version, then push the tag. If a release is broken, publish a superseding patch and run `npm deprecate @jankrajewskiit/auth@<version>`; do not unpublish or advance the original tag.

## Branch protection

Protect the default branch with required passing `verify` and `audit` checks, at least one approving CODEOWNERS review, and up-to-date branches. Disable force pushes and non-administrative direct pushes.
