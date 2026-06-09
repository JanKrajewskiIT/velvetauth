# Spec 04 — Sign-In Flow

## Step 1 — Core redirect behavior

The sign-in operation MUST be a no-op when invoked outside a browser runtime; it MUST resolve without throwing.

The operation MUST NOT throw synchronously for any input. Errors raised by the OIDC client redirect MUST be captured and surfaced via the error accessor. The sign-in operation MUST resolve (no exception propagation to the caller). The operation MUST NOT clear the user accessor or the loading flag on error — only the error surface is mutated.

The operation MUST be idempotent at the intent level — rapid double-invocation MUST NOT corrupt state. The underlying OIDC client handles single-flight redirect issuance.

## Step 2 — Return URL handling

Two carriers transmit the return URL across the redirect, in this priority order on the way back:

1. **OIDC `state` parameter** — encoded in the OIDC state and bound to the authentication request.
2. **Tab-scoped storage fallback** under the return-URL storage key — only consulted if the state carrier did not survive the round-trip.

When a return URL argument is supplied, it MUST be passed through the return-URL normalization defined in [10-return-url-safety](10-return-url-safety.md). A normalized return URL MUST be discarded (not carried forward) if it would itself be detected as a callback URL ([05-callback](05-callback.md)) — loop prevention.

When a safe return URL exists after normalization and loop checking, it MUST be persisted in tab-scoped storage under the resolved return-URL storage key. The OIDC client redirect MUST also be initiated with an OIDC `state` carrier that conveys the return URL. When no safe return URL exists, the redirect MUST be initiated without a state carrier.

The return URL persisted in storage MUST always be a safe in-app path; unsafe values MUST never reach storage.

If the OIDC client redirect throws after a return URL has been persisted in the same operation, the framework MUST remove that storage entry before surfacing the error. This prevents a stranded entry from being consumed by an unrelated subsequent callback. A return URL persisted by an earlier successful redirect that is still pending its callback MUST NOT be removed by this rule.

## Step 3 — Authorization-request options

The sign-in operation MUST accept an optional second argument carrying OIDC authorization-request parameters.

| Field              | Type                 | Forwarded as                                                               |
| ------------------ | -------------------- | -------------------------------------------------------------------------- |
| `acrValues`        | string               | OIDC `acr_values`                                                          |
| `prompt`           | string               | OIDC `prompt`                                                              |
| `loginHint`        | string               | OIDC `login_hint`                                                          |
| `uiLocales`        | string               | OIDC `ui_locales`                                                          |
| `extraQueryParams` | string-to-string map | additional query parameters appended verbatim to the authorization request |

Provided options MUST be forwarded verbatim to the underlying OIDC client's redirect call so they reach the IdP's `/authorize` request unaltered. The framework MUST NOT validate, normalize, or transform their values beyond what the underlying OIDC client requires.

An option whose value is `undefined`, `null`, or the empty string MUST be dropped before forwarding. `extraQueryParams` entries are filtered by the same rule on a per-key basis.

Options MUST NOT influence the configuration identity ([01-configuration](01-configuration.md)) and MUST NOT cause the underlying OIDC client to be rebuilt. They are per-call, not per-identity.

`extraQueryParams` MUST NOT be a back-door for parameters the framework owns. Keys that name a protocol-reserved or framework-managed authorization-request parameter MUST be silently dropped. The dropped set MUST include at minimum: `redirect_uri`, `response_type`, `client_id`, `scope`, `state`, `nonce`, `code_challenge`, `code_challenge_method`, `response_mode`, `display`, `max_age`, `id_token_hint`, and any key for which a dedicated option exists (`acr_values`, `prompt`, `login_hint`, `ui_locales`). Consumers MUST use the dedicated option for fields the framework recognizes.
