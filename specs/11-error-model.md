# Spec 11 — Error Model

## Step 1 — Error surface

The framework exposes a single reactive error accessor (string-valued or null-equivalent). It is updated by every flow handler and by event subscribers. It is never read by the framework itself — only consumers read it.

The framework MUST expose this reactive error accessor. Every asynchronous flow handler (sign-in, sign-out, manual renewal, bootstrap, callback) MUST set the error surface on failure. Successful completion of any of those handlers MUST set the error surface to null-equivalent, except when callback exchange succeeds but fallback cleanup fails; in that case the authenticated user is retained and the cleanup error is surfaced.

OIDC client resolution failures follow the contract of the calling API: sign-in, sign-out, and manual renewal capture the failure in the reactive error accessor and resolve; provider bootstrap sets unauthenticated state and the error; inline callback sets unauthenticated state and the error and cleans the URL; standalone callback rejects after URL cleanup; the off-component token getter rejects. A manual renewal that returns null clears the error while leaving the user unchanged.

Error messages MUST be derived from the underlying error's message field, or from a documented framework-defined message for timeout cases. They MUST NOT include access/refresh/ID tokens, authorization codes, or other secret material. The interaction-required codes explicitly listed in [06-silent-renewal](06-silent-renewal.md) are non-secret protocol outcomes and MAY appear in the error text so consumers can pattern-match. The framework MUST NOT write to the developer console on its own. Error messages MUST NOT carry stack traces by default.

Framework-defined timeout messages are: `Authentication initialization timed out.`, `Authentication callback timed out.`, `Sign-in redirect timed out.`, `Sign-out redirect timed out.`, `Silent renewal timed out.`, and `Access-token user lookup timed out.`

Each documented timeout source MUST have a distinct, stable error message so consumers can pattern-match if needed. The total set of distinct error messages emitted by the framework MUST be small enough that consumers can enumerate them.

The error accessor MUST be reactive and MUST share the same state container as the user accessor so consumer effects can observe both atomically.

## Step 2 — Error catalogue

### Errors surfaced via the reactive error accessor

| Source                                   | Trigger                                                     | Resulting state                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bootstrap user-lookup rejection          | Network or storage failure during initial fetch             | Error surface set; user null.                                                                           |
| Bootstrap timeout                        | User lookup exceeds the configured timeout                  | Error surface set with `Authentication initialization timed out.`; user null.                           |
| Callback exchange rejection              | The OIDC client's redirect-callback exchange fails          | Error surface set; user null; URL still cleaned.                                                        |
| Callback timeout                         | The exchange exceeds the configured timeout                 | Error surface set with `Authentication callback timed out.`; user null.                                 |
| Callback fallback cleanup failure        | The return-URL fallback cannot be removed                   | Error surface set; a successfully exchanged user remains present; URL is cleaned; fallback is not used. |
| Sign-in rejection                        | The OIDC client's sign-in redirect fails before navigation  | Error surface set; user and loading state unchanged.                                                    |
| Sign-in timeout                          | The sign-in redirect exceeds the configured timeout         | Error surface set with `Sign-in redirect timed out.`; user and loading state unchanged.                 |
| Sign-in storage or factory failure       | Fallback storage write or client resolution fails           | Error surface set; user and loading state unchanged; redirect is not initiated.                         |
| Sign-out rejection                       | The OIDC client's logout redirect fails before navigation   | Error surface set; user and loading state unchanged.                                                    |
| Sign-out timeout                         | The logout redirect exceeds the configured timeout          | Error surface set with `Sign-out redirect timed out.`; user and loading state unchanged.                |
| Sign-out factory failure                 | OIDC client resolution fails                                | Error surface set; user and loading state unchanged.                                                    |
| Manual silent renewal rejection          | The OIDC client's silent sign-in fails                      | Error surface set; user unchanged.                                                                      |
| Manual renewal factory failure           | OIDC client resolution fails                                | Error surface set; user unchanged; loading is reset.                                                    |
| Manual silent renewal timeout            | The silent sign-in exceeds the configured timeout           | Error surface set with `Silent renewal timed out.`; user unchanged.                                     |
| Silent renewal failure event (automatic) | The underlying OIDC client emits a `silentRenewError` event | Error surface set; user unchanged until token expiry.                                                   |
| Access-token expiry event                | Access token reaches expiry and was not renewed             | User accessor becomes null-equivalent; error surface unchanged. (This is not an error.)                 |

### Thrown errors (not on the error accessor)

An off-component user-lookup timeout MUST reject with `Access-token user lookup timed out.` A timeout during the getter's renewal attempt is swallowed and resolves to no token, per [08-access-token-retrieval](08-access-token-retrieval.md).

| Source                                                   | Trigger                   | Recovery                                    |
| -------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| The auth hook called outside the provider                | Programmer error          | Wrap the tree in the provider.              |
| OIDC client resolution invoked outside a browser runtime | Programmer or SSR misuse  | Guard with a browser-runtime check.         |
| Off-component access-token getter — user lookup timeout  | The lookup step times out | Caller treats as a transport-style failure. |

### Silently swallowed errors

| Source                                 | Reason                                                                                             | Observable effect                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Off-component getter — renewal failure | Contract returns either a token or "no token"; renewal failure is one of several "no token" causes | Resolves to "no token".                                           |
| Role extractor — decode failure        | A malformed token MUST NOT crash the UI                                                            | Roles accessor returns an empty array.                            |
| Persisted-user reader — parse failure  | Corrupted storage MUST NOT crash hydration                                                         | Reader returns null-equivalent; initial state is unauthenticated. |

## Step 3 — Specific event rules

The `silentRenewError` event handler MUST set the error surface to the event's message and MUST NOT clear the user accessor immediately.

The `accessTokenExpired` event handler MUST NOT set the error surface.

The auth hook and the OIDC client resolver MUST throw descriptive errors when used incorrectly.

## Step 4 — Recovery decision matrix

For consumers wiring error UI:

| Error surface   | User accessor   | Suggested UX                                                                                                                     |
| --------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| null-equivalent | present         | Normal authenticated UI.                                                                                                         |
| null-equivalent | null-equivalent | Show sign-in call-to-action.                                                                                                     |
| set             | present         | Non-blocking banner ("Trouble refreshing your session — you may be signed out soon"). Consider triggering manual silent renewal. |
| set             | null-equivalent | Blocking message with retry / sign-in call-to-action.                                                                            |
