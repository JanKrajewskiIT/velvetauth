# Spec 02 — Storage Contract

## Step 1 — Storage backend and ownership

By default, the framework persists the OIDC user record in tab-scoped storage (`sessionStorage`). Closing the tab signs the user out — no zombie sessions, no cross-tab token leakage on shared computers. This is the deliberate default. Consumers that need cross-tab persistence MUST opt in via [12-user-manager-factory](12-user-manager-factory.md).

The framework owns exactly two storage entries of its own plus whatever the underlying OIDC client persists for its own protocol state. Adding a third framework-owned entry requires a spec update.

All storage reads and writes MUST be guarded against non-browser runtimes and MUST become no-ops outside a browser. Reading the persisted user MUST be synchronous, MUST return a null-equivalent value when the entry is missing or unparseable, and MUST NOT throw.

Storage MUST NOT contain personally identifiable information beyond what is already encoded in the OIDC user profile. Stored values MUST survive a tab reload but MUST NOT survive a tab close under the default storage backend.

## Step 2 — Storage entries

| Entry | Owner | Written on | Removed on | Contents |
| --- | --- | --- | --- | --- |
| Persisted user record | Underlying OIDC client (via tab-scoped storage) | Successful callback exchange, successful silent renew, OIDC client load | Successful sign-out; OIDC client unload event | Serialized user: tokens, profile, expiry, state. |
| Return-URL fallback | Framework | Sign-in operation when a return URL is supplied and considered safe ([10-return-url-safety](10-return-url-safety.md)) | The callback handler, on first read | A normalized, in-app path. |
| OIDC protocol state | Underlying OIDC client | During the sign-in redirect (PKCE / nonce / state) | During the callback handler | PKCE state, nonce, code verifier. The framework MUST NOT read or write these entries directly. |

The user-record storage key MUST disambiguate by IdP authority and OIDC client identifier so that two configurations cannot collide. Default storage keys MUST be discoverable by name in the framework's source.

The framework MUST expose a deterministic way for consumers to compute the canonical user-record storage key for a given authority + client identifier pair, so that consumer code can read the persisted user without re-implementing the lookup.

## Step 3 — Lifecycle invariants

The framework MUST maintain the following lifecycle invariants:

1. **On mount**, the framework reads the persisted user synchronously to seed initial state.
2. **On sign-in with return URL**, the framework writes the return-URL fallback before the OIDC client begins the redirect.
3. **On callback**, the framework reads and removes the return-URL fallback as the first step of return-URL resolution.
4. **On silent renewal**, the persisted user is rewritten by the OIDC client; no framework storage activity occurs.
5. **On sign-out**, the persisted user is removed by the OIDC client.
6. **On tab close**, all framework-owned storage is wiped by the browser under the default storage backend.

The return-URL entry MUST be removed when the OIDC callback is processed, regardless of whether a redirect ultimately occurs.

When storage quota is exceeded, writes throw synchronously inside the OIDC client; the error surfaces via the operation's promise rejection through the documented error surface. When storage is disabled (third-party context, privacy mode), the framework treats this as a non-browser runtime: storage operations no-op and the framework remains in an unauthenticated state.
