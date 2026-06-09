# Spec 01 — Configuration

## Step 1 — Configuration record

The framework accepts a consumer configuration record (suggested type name: `OidcAuthConfig`). Three fields are required; all others have defaults.

| Field                    | Required | Default                    | Purpose                                                                                                                    |
| ------------------------ | -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| IdP authority URL        | yes      | —                          | OIDC issuer URL used for IdP discovery.                                                                                    |
| OIDC client identifier   | yes      | —                          | Identifies the SPA at the IdP.                                                                                             |
| SPA app URL              | yes      | —                          | Fallback for both redirect URI and post-logout redirect URI.                                                               |
| Redirect URI             | no       | App URL                    | URL the IdP redirects to after sign-in. Its path is what callback detection matches against.                               |
| Post-logout redirect URI | no       | App URL                    | URL the IdP redirects to after sign-out.                                                                                   |
| Silent redirect URI      | no       | unset                      | Hidden iframe URL for silent renew. Required for automatic renewal end-to-end ([06-silent-renewal](06-silent-renewal.md)). |
| Account console URL      | no       | Authority URL + `/account` | Surface-only; framework MUST NOT navigate to it.                                                                           |
| Async operation timeout  | no       | 8 s                        | Bounds every async OIDC call performed by the framework.                                                                   |
| Return-URL storage key   | no       | stable namespaced default  | Key under which the return-URL fallback is persisted in browser storage.                                                   |
| OAuth scope string       | no       | `openid profile email`     | Space-delimited scopes requested at the IdP.                                                                               |

The framework MUST expose accessor functions (or equivalent) to read every defaulted value with its fallback applied, so that other parts of the framework and consumers can resolve the effective configuration without re-implementing the defaulting logic. Default values MUST be defined as discoverable constants.

## Step 2 — Default resolution

When the redirect URI field is absent, the resolved redirect URI MUST equal the SPA app URL. When the post-logout redirect URI is absent, the resolved value MUST equal the SPA app URL. When the account console URL is absent, the resolved value MUST be derived from the authority URL with a trailing `/account` segment.

The configuration record SHOULD be treated as immutable after the provider mounts. Behavior is defined for changing it only via remount.

## Step 3 — Configuration identity

The framework MUST derive a stable identity key from a subset of configuration fields. Two configurations with the same identity key MUST yield the same OIDC client; configurations that differ in any identity-bearing field MUST yield a new client.

Fields that are part of the identity:

- IdP authority URL
- OIDC client identifier
- SPA app URL
- Redirect URI (resolved, including defaults)
- Post-logout redirect URI (resolved)
- Silent redirect URI (resolved)
- OAuth scope (resolved)

Fields that are NOT part of the identity (read on each call without rebuilding the client):

- Account console URL
- Async operation timeout
- Return-URL storage key

Changing the IdP authority, client identifier, or requested scopes rebuilds the OIDC client (clean break); changing the timeout takes effect on the next operation without disturbing the client's internal state.

Re-passing a structurally equivalent configuration record (new object, same field values) MUST NOT rebuild the OIDC client. Identity is content-based.

The framework MUST encode the identity tuple with an unambiguous, content-disjoint separator. Concatenation without a separator (or with a separator that may appear inside a field) is forbidden because it permits collisions where two distinct tuples produce the same key.

## Step 4 — OIDC client construction defaults

When no consumer factory is registered, the framework MUST construct an OIDC client with the following observable properties:

- Issuer / client / redirect URIs / post-logout / silent redirect derived from the resolved configuration.
- OAuth response type MUST be `code` (authorization-code flow with PKCE handled by the underlying client).
- Requested scopes MUST equal the resolved scope field.
- User persistence backend defaults to tab-scoped browser storage (`sessionStorage`). The default MUST NOT promote any user state to a cross-tab store.
- Automatic silent renewal MUST be enabled by default.
- No userinfo loading and no session monitoring beyond what `oidc-client-ts` does by default.

Consumers needing cross-tab persistence, additional scopes, session monitoring, or other deviations MUST register a custom factory ([12-user-manager-factory](12-user-manager-factory.md)).

The framework MUST share exactly one underlying OIDC client per configuration identity, regardless of how many consumer call sites trigger resolution. Attempting to resolve the OIDC client outside a browser runtime MUST throw a descriptive error ([11-error-model](11-error-model.md)). Registering, unregistering, or replacing the consumer factory MUST invalidate the cached OIDC client so the next resolution call rebuilds.
