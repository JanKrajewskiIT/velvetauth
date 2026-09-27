# Spec 07 — Sign-Out Flow

## Step 1 — Originating-tab flow

Sign-out terminates three parts of a session:

1. **IdP side** — calls the IdP's logout endpoint so the SSO cookie is cleared.
2. **Local tab** — clears the persisted user from tab-scoped storage and resets the provider's reactive state.
3. **Other tabs** — propagates the sign-out so concurrent tabs do not keep showing authenticated UI with an invalidated token.

The sign-out operation MUST be a no-op when invoked outside a browser runtime; it MUST resolve without throwing.

The sign-out operation MUST invoke the OIDC client's logout redirect, bounded by the configured timeout. Errors raised by OIDC client resolution or the logout redirect, including timeout, MUST be captured and surfaced via the error accessor. The operation MUST resolve (no exception propagation to the caller). A timeout does not cancel the redirect; a late navigation side effect may still occur.

The sign-out operation MUST NOT manually clear tab-scoped storage — the OIDC client (and the subsequent `userUnloaded` event) handle local cleanup. The framework translates the `userUnloaded` event into "no user, not loading, no error" per [03-bootstrap-hydration](03-bootstrap-hydration.md).

The operation MUST be idempotent at the intent level — a double click MUST NOT corrupt state. After a successful sign-out, no IdP-issued credential MUST remain in framework-owned storage entries.

## Step 2 — Cross-tab propagation

When the framework processes the `userUnloaded` event triggered by a sign-out, it MUST publish a sign-out notification to a same-origin broadcast channel scoped to the configuration identity. The notification carries no token material or PII — its payload conveys only the event kind (`signed-out`).

The broadcast channel name MUST disambiguate by the same identity-bearing configuration fields used for the user-record storage key ([02-storage-contract](02-storage-contract.md)). Two SPAs on the same origin with different OIDC client identifiers or different authorities MUST NOT receive each other's notifications.

Cross-tab notifications MUST be same-origin. The framework MUST NOT use cookies, `postMessage` to other windows, or any cross-origin transport for this signal. Cross-tab signaling MUST NOT require additional consumer configuration.

When the framework receives a sign-out notification from another tab, it MUST perform the same local state transition as the `userUnloaded` handler: commit "no user, not loading, no error" and attempt to remove the persisted-user storage entry if still present. Removal failure MUST be swallowed. It MUST NOT invoke the OIDC client's logout redirect. A received sign-out notification MUST NOT set the error accessor — cross-tab sign-out is a normal lifecycle event.

A receiving tab observing a sign-out notification MUST reach the unauthenticated state in a single reactive update. The receiver MUST NOT re-broadcast after applying the cross-tab transition; otherwise N tabs produce O(N²) traffic.

The framework MUST subscribe to the broadcast channel on provider mount and MUST unsubscribe on provider unmount, with no residual subscription leaks. A broadcast sent before a second tab has mounted its provider is lost. Because the default user store is `sessionStorage`, which is isolated per tab, a later tab cannot discover the earlier tab's logout through the default persisted-user entry. Cross-tab logout is guaranteed only for tabs subscribed when the notification is sent; the framework does not persist a logout marker.

When a sign-out notification arrives in a tab that is currently executing a silent renewal, the renewal-in-flight MUST be abandoned, the tab MUST transition to unauthenticated, and no error MUST be surfaced for the abandoned renewal. The underlying OIDC operation is not cancelled; its late result MUST NOT restore provider state or produce a token from an off-component getter. Implementations MUST use a per-identity sign-out generation or equivalent invalidation mechanism to reject results started before the notification.

When sign-out is invoked while no user is signed in, the OIDC client still issues the logout redirect. The flow is idempotent. A sign-out notification is still broadcast; receiving tabs already in the unauthenticated state treat it as a no-op. The framework MUST detect the absence of a working broadcast mechanism and degrade silently: the originating-tab flow MUST proceed unaffected and the receive path MUST become a no-op. The framework MUST NOT throw, log, or surface an error in this case.
