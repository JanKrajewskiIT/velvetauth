# Spec 03 — Bootstrap and Hydration

## Step 1 — Initial state (synchronous hydration)

On mount, the provider's initial reactive state MUST be derived synchronously: user from persisted storage ([02-storage-contract](02-storage-contract.md)), `isLoading` true only if the current URL is detected as a callback ([05-callback](05-callback.md)), error null.

Initial-state derivation MUST NOT use any asynchronous primitive (no microtask, no promise). It MUST snapshot the configuration once at mount time — the values needed for storage-key derivation and callback detection MUST be captured up front and not re-read reactively.

This eliminates the flash of "Sign in" before swapping to "Hello, Alice" for users whose session is still valid in tab-scoped storage.

## Step 2 — Asynchronous bootstrap

On mount in a browser runtime, the provider MUST execute an asynchronous bootstrap after the synchronous hydration. The provider MUST render its children without waiting for the bootstrap to complete.

When the current URL is detected as a callback, the bootstrap MUST process it per [05-callback](05-callback.md). When the current URL is not a callback, the bootstrap MUST perform an OIDC client user lookup and commit the result.

Every operation inside the bootstrap MUST be bounded by the configured timeout. If the bootstrap rejects (including via timeout), the framework MUST set state to "no user, not loading, error message present".

The asynchronous bootstrap MUST honor a disposed flag set in cleanup: setters MUST be skipped and post-callback navigation MUST be skipped when the provider was unmounted before the awaited operation settled.

## Step 3 — Event subscriptions

On mount in a browser runtime, the provider MUST subscribe to the OIDC client's `userLoaded`, `userUnloaded`, `silentRenewError`, and `accessTokenExpired` events.

- A `userLoaded` event MUST set state to "user present, not loading, error null".
- A `userUnloaded` event MUST set state to "no user, not loading, error null".
- A `silentRenewError` event MUST set the error surface to the event message and MUST leave user and loading flags unchanged.
- An `accessTokenExpired` event MUST set the user to a null-equivalent value and MUST leave the error surface and loading flag unchanged.

On unmount, every subscription MUST be removed. No event handler may run after unmount. A handler that races with disposal (fires after unmount has begun) MUST NOT commit reactive state, MUST NOT publish cross-tab notifications, and MUST NOT initiate navigation. The framework guards these effects with a disposed flag set in cleanup.

Event subscriptions MUST persist across re-renders of the configuration. If the provider's configuration changes, subscriptions MUST track the currently active OIDC client. Event handler references MUST be stable for the lifetime of the subscription so cleanup symmetrically removes them.

## Step 4 — Reactive context surface

The provider MUST expose a reactive context that consumer code reads through a hook (suggested name: `useAuth`). The context exposes the values below as reactive accessors so SolidJS components automatically re-render on change.

| Accessor                                            | Type                      | Semantics                                                                      |
| --------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| User                                                | object or null-equivalent | Last known OIDC user record.                                                   |
| Is loading                                          | boolean                   | True only between the start of callback processing and the first state commit. |
| Is authenticated                                    | boolean                   | True iff a user is present and not expired.                                    |
| Error                                               | string or null-equivalent | Last error message; null after any successful operation.                       |
| Access token                                        | string or unset           | Convenience accessor over the current user.                                    |
| Roles                                               | array of strings          | See [09-identity-exposure](09-identity-exposure.md).                           |
| First name, last name, email, username, account URL | strings                   | See [09-identity-exposure](09-identity-exposure.md).                           |
| Role helpers                                        | functions                 | See [09-identity-exposure](09-identity-exposure.md).                           |
| Sign-in, sign-out, manual silent renewal            | async functions           | See [04](04-sign-in.md), [06](06-silent-renewal.md), [07](07-sign-out.md).     |

All accessors MUST be safe to read inside SolidJS JSX without manual untracking; they MUST be implemented as memoized derivations over the underlying signal state. Initial hydration MUST be synchronous; the consumer's first render MUST observe the hydrated user.

The hook MUST throw a descriptive error when called outside the provider's subtree.

## Step 5 — Configuration mutation after mount

Non-identity fields (account console URL, timeout, return-URL storage key) are reactive and take effect immediately when the configuration prop changes.

Identity-bearing fields (authority, client identifier, redirect URIs, scope) rebuild the OIDC client on next access when changed. The previously bound event subscriptions stay attached to the old client and effectively go silent. This MUST be documented as a **require-remount scenario**: consumers changing identity-bearing fields MUST unmount and remount the provider to pick up the new OIDC client and fresh subscriptions.

A switch of authority between mounts changes the user-record storage key; the new mount hydrates from the new key (typically empty). The stale entry from the old key is left behind in storage and is wiped on tab close.

## Step 6 — Non-browser runtime

In a non-browser runtime, the provider MUST set state to "no user, not loading, error null" and MUST render children. No event subscriptions and no asynchronous OIDC operations MUST be initiated.
