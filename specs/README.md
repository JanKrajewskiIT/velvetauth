# Spec index — Auth framework

Black-box specification of a SolidJS authentication framework that wraps `oidc-client-ts`. The framework targets browser-side OIDC sign-in / sign-out / silent renew for SolidJS apps.

## Technical stack

| Layer            | Constraint                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Runtime          | SolidJS (≥ 1.9). The framework exposes a SolidJS provider component and reactive accessors. |
| Language         | TypeScript. All public surface is typed.                                                    |
| OIDC protocol    | `oidc-client-ts` (≥ 3.1). The framework wraps it; no parallel OIDC implementation.          |
| Bundling         | ESM-only, side-effect-free, types bundled with the published package.                       |
| Host environment | Browser. The framework degrades gracefully in non-browser contexts (no throw at render).    |

The framework MUST NOT introduce additional runtime dependencies beyond SolidJS and `oidc-client-ts`.

## Naming reference

Specs use functional names consistently so cross-references work. These names are suggestions for the public API surface; an implementation MAY choose different identifiers as long as the externally observable behavior is preserved.

| Functional concept                                  | Suggested name                               |
| --------------------------------------------------- | -------------------------------------------- |
| Configuration record passed by consumers            | `OidcAuthConfig`                             |
| Sub-configuration passed to the OIDC client factory | `OidcAuthUserManagerFactoryConfig`           |
| Root SolidJS provider component                     | `AuthProvider`                               |
| Hook returning the reactive auth context            | `useAuth`                                    |
| Auth context shape                                  | `AuthContextValue`                           |
| Sign-in operation                                   | `signIn(returnUrl?, options?)`               |
| Sign-out operation                                  | `signOut()`                                  |
| Manual silent renewal                               | `signInSilent()`                             |
| Standalone callback handler                         | `handleAuthRedirectCallback(config)`         |
| Off-component access-token getter                   | `getAuthAccessToken(config)`                 |
| OIDC client factory override                        | `setAuthUserManagerFactory(factory \| null)` |

## Index

| #   | Spec                                                   | Topic                                                                        |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 00  | [overview](00-overview.md)                             | Business goals, actors, architecture, glossary, IdP requirements.            |
| 01  | [configuration](01-configuration.md)                   | Consumer configuration record and defaults.                                  |
| 02  | [storage-contract](02-storage-contract.md)             | Browser storage usage, lifetimes, eviction.                                  |
| 03  | [bootstrap-hydration](03-bootstrap-hydration.md)       | Provider mount, initial state, event subscriptions, SSR.                     |
| 04  | [sign-in](04-sign-in.md)                               | Redirect to IdP, return-URL handling.                                        |
| 05  | [callback](05-callback.md)                             | Post-IdP redirect processing.                                                |
| 06  | [silent-renewal](06-silent-renewal.md)                 | Automatic + manual token renewal.                                            |
| 07  | [sign-out](07-sign-out.md)                             | Redirect to IdP logout.                                                      |
| 08  | [access-token-retrieval](08-access-token-retrieval.md) | Off-component access-token access.                                           |
| 09  | [identity-exposure](09-identity-exposure.md)           | Profile fields, roles, account URL.                                          |
| 10  | [return-url-safety](10-return-url-safety.md)           | Open-redirect protection.                                                    |
| 11  | [error-model](11-error-model.md)                       | Error sources, surfacing, recovery.                                          |
| 12  | [user-manager-factory](12-user-manager-factory.md)     | Custom OIDC client injection.                                                |
| 13  | [consumer-integration](13-consumer-integration.md)     | Required integration ergonomics for consumer apps.                           |
| 14  | [release-and-tooling](14-release-and-tooling.md)       | Packaging shape, verification gates, commit hooks, CI and release pipelines. |

## Glossary

| Term              | Meaning                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **IdP**           | Identity Provider — issues access/id tokens. Reference target: Keycloak.                                                                     |
| **Authority**     | OIDC issuer URL of the IdP (e.g. a Keycloak realm URL).                                                                                      |
| **Access token**  | JWT presented to the backend as a bearer credential. Short-lived.                                                                            |
| **Silent renew**  | Token renewal without user interaction, executed via a hidden iframe that loads the IdP's authorize endpoint.                                |
| **Callback URL**  | The URL the IdP redirects to after authentication, carrying authorization code and state parameters. Must match the configured redirect URI. |
| **Return URL**    | Path inside the SPA the user came from before being sent to the IdP. Restored after callback.                                                |
| **User store**    | Browser storage backend chosen by the OIDC client to persist the serialized user (default constraint: tab-scoped).                           |
| **Provider**      | The SolidJS component the consumer mounts at the root of its tree to enable authentication.                                                  |
| **Auth context**  | The reactive value the provider supplies, read by consumer components via the auth hook.                                                     |
| **Open redirect** | An attack class where a crafted return URL points to a third-party origin. Mitigated by return-URL normalization.                            |
| **Consumer**      | A SolidJS application that integrates the framework.                                                                                         |

## How to update

Specs are numbered in dependency order. Earlier specs define foundational contracts; later specs build on them. Each spec is self-contained but cross-references neighbors when behavior overlaps.

When changing behavior, update the affected spec first. Cross-spec impacts MUST update every affected spec. Behavioral changes to any MUST requirement constitute a breaking change (major version bump).
