# Spec 06 — Silent Token Renewal

## Step 1 — Automatic renewal

The default OIDC client construction MUST enable automatic silent renewal and MUST pass through the configured silent redirect URI.

A successful automatic renewal translates to a `userLoaded` event whose handling is specified in [03-bootstrap-hydration](03-bootstrap-hydration.md). A failed automatic renewal translates to a `silentRenewError` event with the same handling.

The framework MUST NOT ship the silent-callback static asset. Hosting it is the consumer's deployment responsibility. The consumer MUST host a static HTML resource at the configured silent redirect URI that:

- Is served from the same origin as the SPA.
- Runs a small piece of code that completes the OIDC client's silent callback for the parent window.
- Does not require user interaction.

The silent renewal iframe MUST execute against the same origin as the SPA. Failure to host the resource is a deployment defect that manifests as `silentRenewError` after the first scheduled renewal.

## Step 2 — Manual renewal

A manual silent-renewal operation MUST exist on the auth context (suggested name: `signInSilent`).

The manual operation MUST be a no-op in a non-browser runtime. It MUST invoke the OIDC client's silent sign-in, bounded by the configured timeout. The manual operation MUST NOT throw to the caller — failures surface via the error accessor.

On success, the framework MUST commit "user present, not loading, no error". On failure, the framework MUST update only the error surface and the loading flag; user state MUST remain as it was. This ensures transient renewal failures do not flip the UI when the existing token is still valid.

## Step 3 — Renewal failure isolation

The framework MUST NOT clear the user accessor as a direct consequence of any silent renewal failure — neither automatic, nor manual, nor on-demand. The user accessor transitions to null only when the `accessTokenExpired` event fires (or when sign-out runs).

This invariant allows a still-valid token to keep working under Safari ITP, transient IdP errors, and `interaction_required` / `login_required` responses. A browser background timer may throttle scheduled renewal past the access token's expiry; the on-demand renewal in the off-component access-token getter ([08-access-token-retrieval](08-access-token-retrieval.md)) compensates.

When the underlying OIDC client emits a `silentRenewError` whose error code identifies an interaction-required outcome (`login_required`, `interaction_required`, `consent_required`, `account_selection_required`), the framework MUST surface the underlying error message via the error accessor with the code visible in the message text so consumers can pattern-match without inspecting framework internals. Other error codes pass through unchanged.

Renewal MUST NOT cause a render storm; downstream re-renders MUST be limited to consumers reading the changed accessors.
