# Spec 13 — Consumer Integration Contract

## Step 1 — Required capabilities

The framework MUST support each of the following integration capabilities. The "How" column describes the consumer-observable shape.

| # | Capability | How it MUST be available |
| --- | --- | --- |
| 1 | Single root provider mount | A SolidJS component the consumer mounts once at the root of its tree, parameterized by the consumer configuration record. |
| 2 | Reactive auth context access | A SolidJS hook readable inside the provider's subtree that returns the reactive auth context. |
| 3 | Off-component access-token access | An asynchronous getter callable from any module, taking the configuration as an argument. |
| 4 | Sign-in trigger | An asynchronous operation on the auth context that initiates the IdP redirect, accepting an optional return URL. |
| 5 | Sign-out trigger | An asynchronous operation on the auth context that initiates the IdP logout. |
| 6 | Manual silent renewal | An asynchronous operation on the auth context that triggers a silent token renewal. |
| 7 | Role-membership checks | Reactive boolean accessors (`is admin`, `is moderator`, `is admin or moderator`) and helper functions (`has role`, `has any role`) on the auth context. |
| 8 | Identity exposure | Reactive accessors for first name, last name, email, username, account console URL on the auth context. |
| 9 | Custom OIDC client factory | A registration operation callable before the provider mounts; takes a factory or a null-equivalent. |
| 10 | Standalone callback handler | An asynchronous operation callable from a dedicated route component; returns whether a navigation was issued. |
| 11 | Stand-alone identity & URL helpers | Pure functions exposed from the public surface, callable outside the reactive scope. See table in Step 6. |
| 12 | Configuration-defaults inspection | Resolver functions (`getRedirectUri`, `getPostLogoutRedirectUri`, `getReturnUrlStorageKey`, `getTimeoutMs`) and storage utilities (`buildStoredUserStorageKey`, `getStoredUser`) exposed from the public surface so consumers can construct fetch wrappers and diagnostics without re-implementing the framework's defaulting logic. |

## Step 2 — Required integration ordering

| Rule | Rationale |
| --- | --- |
| The provider MUST wrap any consumer code that calls the auth hook. | Predictable failure during development. |
| The provider MUST be mounted before any router that has authenticated route guards. | Route guards depend on initial auth state. |
| The custom OIDC client factory, if used, MUST be registered before the provider mounts. | Factory registration after mount leaves the provider bound to the previous OIDC client. |
| Sign-in invocations that wish to preserve location MUST pass the current in-app path explicitly. | The framework cannot infer intent; the return URL must be supplied. |
| Consumers using the standalone callback handler MUST NOT also rely on inline callback processing for the same URL. | Double processing causes one of the two to error. |

## Step 3 — Configuration provisioning

The consumer MUST be able to construct the configuration record from environment-supplied values (such as a build-time env file). The framework MUST NOT impose a specific provisioning mechanism. To keep the OIDC client cache stable, consumers SHOULD hoist the configuration record to module scope so that every consumer of the framework references the same identity.

## Step 4 — Required ergonomics

### Fetch wrapper

Consumers MUST be able to build a fetch wrapper that calls the off-component access-token getter, attaches the resulting token as an `Authorization: Bearer` header when present, and sends the request without the header when no token is available. The wrapper MUST NOT subscribe to any SolidJS signal and MUST be callable from non-component contexts. The framework MUST NOT require consumers to access the reactive access-token accessor from a fetch wrapper.

### Route guard

Consumers MUST be able to build a SolidJS route guard component that reads `is loading`, `is authenticated`, and role helpers from the auth context, defers any decision until `is loading` is false, initiates sign-in with the current in-app path when the user is unauthenticated, and redirects to a forbidden-state page when authenticated but lacking required roles. The framework exposes the accessors needed; it MUST NOT ship the guard component itself.

### Sign-out

The sign-out trigger MUST be wirable to any consumer-supplied control. The framework handles local state cleanup via its event subscriptions without consumer intervention.

### Standalone callback handler

A consumer that prefers a dedicated `/auth/callback`-style route MUST be able to implement the callback handler as a single route component that calls the standalone handler and renders an idle placeholder while it runs.

## Step 5 — Public stand-alone function surface

All functions below MUST be safely callable in any runtime (browser, SSR, worker, test) with no dependency on the SolidJS reactive scope or the auth provider.

### Identity helpers (see [09-identity-exposure](09-identity-exposure.md))

| Function | Signature | Description |
| --- | --- | --- |
| `extractRolesFromAccessToken` | `(token: string \| undefined) → string[]` | Decodes the access token and returns the de-duplicated realm + resource role union. Returns `[]` for null/undefined/malformed inputs. |
| `matchesRole` | `(roles: string[], role: string) → boolean` | Case-insensitive membership check for a single role. |
| `matchesAnyRole` | `(roles: string[], ...requiredRoles: string[]) → boolean` | Case-insensitive membership check for any of the supplied roles. Returns `true` for zero required roles. |
| `decodeAccessTokenPayload` | `(token: string) → AccessTokenPayload` | Decodes the JWT payload segment. Throws when malformed. |

### URL helpers (see [10-return-url-safety](10-return-url-safety.md) and [05-callback](05-callback.md))

| Function | Signature | Description |
| --- | --- | --- |
| `normalizeReturnUrl` | `(value: string \| undefined) → string` | Produces a safe in-app path; returns `"/"` for unsafe or absent inputs. |
| `isOidcCallbackReturnUrl` | `(value: string \| undefined, appUrl: string, origin?: string) → boolean` | Returns true iff the URL matches the callback shape and path. |
| `getCurrentReturnUrl` | `() → string` | Returns the current `pathname + search + hash`. Returns `"/"` outside a browser. |

### Storage helpers (see [02-storage-contract](02-storage-contract.md))

| Function | Signature | Description |
| --- | --- | --- |
| `buildStoredUserStorageKey` | `(authority: string, clientId: string) → string` | Computes the canonical storage key for the persisted user record. |
| `getStoredUser` | `(authority: string, clientId: string) → User \| null` | Reads and deserializes the persisted OIDC user synchronously. Returns `null` when absent, unparseable, or called outside a browser. |

### Runtime & timing helpers

| Function | Signature | Description |
| --- | --- | --- |
| `isBrowserRuntime` | `() → boolean` | Returns true when `window` and `sessionStorage` are available. |
| `withTimeout` | `<T>(promise: Promise<T>, timeoutMs: number, message: string) → Promise<T>` | Wraps a promise with a timeout; rejects with the given message when elapsed. |

## Step 6 — Anti-patterns the framework MUST make difficult

| Anti-pattern | Why wrong | How the framework helps |
| --- | --- | --- |
| Reading the reactive access-token accessor from a fetch wrapper | Couples fetch to SolidJS reactivity; breaks outside components | Provide a separate off-component getter. |
| Mounting the provider more than once | Duplicate event subscriptions on the shared OIDC client; doubled UI updates | Cache the OIDC client per identity so multiple mounts surface inconsistencies in tests. |
| Registering the OIDC client factory after mount | Provider subscriptions point at the previous instance | Document the ordering requirement; invalidate the cache on registration. |
| Ignoring `is loading` in route guards | Flashes the wrong branch on reload during callback | Expose `is loading` as a distinct accessor. |
| Manually storing tokens | Duplicate state; storage drift; security review failure | Provide the persisted-user reader and the off-component getter. |
| Passing user-controlled URLs to sign-in unsanitized | Open redirect | The framework normalizes return URLs. |
| Wrapping the provider with the router on the inside | Route guards mount before the auth hook is available | Documentation enforces the ordering. |
| Hosting the silent-callback resource on a different origin than the SPA | Iframe message exchange fails | Document the same-origin requirement. |
| Custom 401 handler that calls sign-in synchronously on every 401 | Redirect loop on persistent 401 | Document a backoff or single-attempt guard requirement. |
