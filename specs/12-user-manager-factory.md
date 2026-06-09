# Spec 12 — Custom OIDC Client Factory

## Step 1 — Registration operation

The framework MUST expose exactly one escape hatch for consumers that need to deviate from the defaults: a factory-registration operation that takes either a factory function or a null-equivalent (suggested name: `setAuthUserManagerFactory`).

Registering a factory MUST cause the next OIDC client resolution to invoke that factory. Registering a null-equivalent MUST restore the default factory for subsequent resolutions. Both forms of the registration operation MUST invalidate the cached OIDC client instance so the next resolution rebuilds.

The registration operation MUST be a synchronous side effect (no async, no IO). The factory MUST be a singleton — repeated registrations overwrite previous ones; there is no factory stack. The framework MUST NOT invoke any registered factory at module load — only lazily on first resolution.

The factory MUST be invoked exactly once per configuration identity (memoized by the OIDC client cache). Failure inside the factory MUST propagate to the caller of the OIDC client resolution. The framework MUST NOT retry on factory failure.

Common use cases for the factory:

- **Cross-tab persistence** — switch the user store to cross-tab browser storage.
- **Additional scopes** — request a custom audience or offline access.
- **Session monitoring** — enable IdP-side session detection.
- **Userinfo loading** — fetch additional claims beyond what the ID token carries.
- **Test harnesses** — inject a fully fake OIDC client.

## Step 2 — Sub-configuration contract

The factory MUST receive a sub-configuration record (suggested type name: `OidcAuthUserManagerFactoryConfig`) containing exactly:

| Field                             | Description                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| IdP authority                     | Pass-through from the consumer configuration.                                                          |
| OIDC client identifier            | Pass-through.                                                                                          |
| Resolved redirect URI             | Defaulted from the consumer configuration.                                                             |
| Resolved post-logout redirect URI | Defaulted from the consumer configuration.                                                             |
| Resolved silent redirect URI      | Optional pass-through.                                                                                 |
| Automatic silent renewal flag     | Currently always passed as true by the framework; the factory MAY honor or override.                   |
| Resolved OAuth scope              | Pass-through after defaulting; the factory SHOULD forward this verbatim to the underlying OIDC client. |

Fields NOT passed to the factory (framework-level concerns): account console URL, async operation timeout, return-URL storage key.

The factory return value MUST be a valid OIDC client — an `oidc-client-ts` user manager or a structurally compatible substitute exposing the events surface the provider subscribes to. The resolved redirect URI and post-logout redirect URI passed to the factory MUST be the framework's defaulted values, not raw configuration fields.

## Step 3 — Cache semantics and ordering

The factory MUST be registered before any consumer triggers OIDC client resolution — in practice, before the provider mounts.

If the factory is registered after resolution has already populated the cache, the cached instance is replaced. Provider subscriptions bound to the previous instance remain attached to it and effectively go silent. Consumers MUST treat post-mount factory registration as a require-remount scenario.

| Trigger                                                 | Effect                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Registering a factory (any value)                       | Clears the cached instance; clears the cached identity key.              |
| Resolving the OIDC client with a new identity key       | Calls the active factory; replaces the cached instance and identity key. |
| Resolving the OIDC client with the same identity key    | Returns the cached instance.                                             |
| Reinitialization of the framework's module (hot reload) | Cache is reset.                                                          |

When a consumer swaps user persistence to cross-tab storage via the factory, the framework's persisted-user reader still targets tab-scoped storage. Consumers in this case MUST NOT rely on the persisted-user reader for initial hydration; instead they should let the asynchronous user lookup at bootstrap resolve.
