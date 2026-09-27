# Spec 08 — Access Token Retrieval (off-component)

## Step 1 — Getter behavior

The off-component access-token getter (suggested name: `getAuthAccessToken`) is an asynchronous function for use outside the SolidJS component tree — fetch wrappers, interceptors, background jobs.

The getter MUST NOT join the SolidJS reactive graph. It MUST work in any JavaScript context without requiring a provider to be mounted. The getter MUST NOT consult the provider's reactive state; calling it before any provider mounts MUST be valid and MUST return a token if persisted storage holds a valid one.

OIDC user-loaded and silent-renew-error events caused by a lookup or renewal initiated by this getter MUST NOT mutate any mounted provider's reactive state. This remains true until the underlying OIDC renewal settles, even if the getter's timeout has already elapsed.

The getter MUST be safe to invoke concurrently from many parallel requests. The underlying OIDC client serializes silent renewals; the getter MUST NOT add additional caching or debouncing.

The getter MUST observe same-origin sign-out notifications for its configuration identity. It MUST capture the current sign-out generation before lookup/renewal and return no token if that generation changes before the result is returned. This invalidates late results without attempting to cancel the underlying OIDC operation.

The getter accepts the auth configuration as an argument so a single fetch wrapper can be parameterized for the consumer's configuration identity.

## Step 2 — Behavior matrix

| User lookup outcome | Cached user expired | Renewal outcome                               | Resolved value                 |
| ------------------- | ------------------- | --------------------------------------------- | ------------------------------ |
| Times out           | —                   | —                                             | rejection propagates to caller |
| Null-equivalent     | —                   | —                                             | "no token"                     |
| User present        | false               | —                                             | user's current access token    |
| User present        | true                | Resolves with a user carrying an access token | renewed access token           |
| User present        | true                | Resolves with a null-equivalent user          | "no token"                     |
| User present        | true                | Rejects (including via timeout)               | "no token"                     |

The getter MUST resolve to "no token" when invoked outside a browser runtime. OIDC client resolution failures MUST reject to the caller. It MUST perform an OIDC client user lookup, bounded by the configured timeout; a timeout rejection MUST propagate to the caller.

If the user lookup returns null-equivalent, the getter resolves to "no token". If the user is present and not expired, the getter resolves to the user's access token. If the user is present and expired, the getter MUST attempt silent renewal, bounded by the configured timeout, and resolve to the renewed access token on success. If the renewal attempt rejects (including via timeout), the getter resolves to "no token" — the renewal error MUST NOT propagate to the caller.

This is the only framework API that proactively renews on demand. Component-side, expiry is handled passively via the `accessTokenExpired` event ([03-bootstrap-hydration](03-bootstrap-hydration.md)).

## Step 3 — Integration shape

Consumers MUST be able to wire the getter into a fetch wrapper with no SolidJS dependency:

```
async function fetchWithAuth(url, options) {
  const token = await getAuthAccessToken(config);
  const headers = token
    ? { ...options?.headers, Authorization: `Bearer ${token}` }
    : options?.headers;
  return fetch(url, { ...options, headers });
}
```

The getter completes within the configured timeout or rejects via the documented timeout error for the lookup step. It does not modify the reactive provider state, so concurrent reactive consumers do not observe artifacts from a fetch wrapper's calls.

When the user lookup rejects with a non-timeout error, the rejection propagates to the caller; the fetch wrapper SHOULD treat this as a transport error. When many concurrent calls occur during expiry, the underlying OIDC client deduplicates silent renewals so only one iframe is opened; the framework MUST NOT add additional throttling.
