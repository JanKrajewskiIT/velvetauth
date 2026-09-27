# Spec 00 — Overview & Goals

## Purpose

Deliver a single npm package that provides browser-side OIDC authentication for SolidJS applications. The framework centralizes redirect flow, callback handling, silent renewal, role parsing, return-URL preservation, and open-redirect defense so that every consumer application can adopt authentication by installing one dependency and mounting one provider.

## Target consumers

- SolidJS single-page applications that authenticate end users through Keycloak (or any OIDC-compliant IdP) and call protected backends with bearer access tokens.

## Non-goals

- The framework does NOT perform backend token validation, introspection, or RBAC enforcement.
- It does NOT provision IdP realms or clients beyond the requirements listed below.
- It does NOT support server-side rendering of authenticated content; the provider renders safely in SSR by degrading to an unauthenticated context.
- It does NOT cover non-OIDC flows (basic auth, magic links, etc.).
- It does NOT support multi-IdP federation switching at runtime.
- It does NOT enable cross-tab persistence by default; that requires a custom factory ([12-user-manager-factory](12-user-manager-factory.md)).

## Guiding principles

- **Single source of authentication truth.** Every consumer mounts the same provider; no per-app OIDC glue code.
- **Tab-scoped sessions by default.** Closing the tab signs the user out — no zombie sessions on shared machines.
- **Reactive surface.** Auth state is exposed as SolidJS reactive accessors so components re-render automatically on changes.
- **Off-component access.** A plain async getter (no SolidJS coupling) covers fetch wrappers and interceptors.
- **Safe by default.** Return-URL normalization, open-redirect protection, and PKCE are on without consumer configuration.
- **ESM-only, zero extra runtime dependencies.** No bundled polyfills; consumers own their peer resolutions.

## Architecture

```
┌──────────────┐    sign-in redirect    ┌────────────┐
│   End user   │ ─────────────────────▶ │    IdP     │
│   (browser)  │ ◀───────────────────── │ (Keycloak) │
└──────┬───────┘    code + state         └─────┬──────┘
       │                                        │
       │  page load / interaction               │  /authorize, /token,
       │                                        │  /logout, /userinfo
       ▼                                        │
┌───────────────────────────────────────────────┴─────┐
│                 SolidJS SPA                         │
│  ┌─────────────────────────────────────────────┐    │
│  │  Auth Provider (configured by consumer)     │    │
│  │     ├─ exposes reactive auth context        │    │
│  │     └─ subscribes to OIDC client events     │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │  Off-component token access (consumer-side  │    │
│  │  fetch wrapper / interceptor)               │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
           │
           │  bearer token attached to outgoing request
           ▼
┌──────────────┐
│ Backend API  │
└──────────────┘
```

Framework collaborators:

- **OIDC client (`oidc-client-ts`)** — owns the OIDC protocol on the wire, persists the user via a pluggable storage backend, schedules silent renew, emits lifecycle events.
- **Auth provider** — SolidJS component holding reactive auth state and bridging OIDC client events into the reactive graph.
- **Configuration resolver** — converts the consumer-supplied configuration into the shape the OIDC client requires, applying defaults.
- **URL / token helpers** — pure functions covering URL normalization, JWT payload decoding, profile lookup, and role extraction.

## IdP requirements

For the defaults to function end-to-end the IdP client MUST be configured with:

- The configured redirect URI and (when used) silent redirect URI present on the IdP's valid-redirect-URI allowlist.
- The configured post-logout redirect URI present on the IdP's valid-post-logout allowlist.
- The SPA origin present on the IdP's allowed web origins (required for the silent-renew iframe to read its callback).
- Access-token claim mappers that emit realm roles under a `realm_access.roles` claim and per-resource roles under `resource_access.<clientId>.roles`.
- PKCE enabled for public clients.

## User scenarios

1. **First visit, unauthenticated.** User opens the SPA, lands on a public page. No IdP interaction.
2. **Click sign in.** User triggers sign-in, is redirected to the IdP, authenticates, returns via the callback URL, and lands on the route they were on (or the SPA root if no intent was preserved).
3. **Repeat visit, same tab.** Tab still open from earlier; the user is hydrated from local persistence; authenticated content renders immediately, with no IdP round-trip.
4. **Token expiry mid-session.** Access token reaches its expiry; silent renew runs in an iframe and refreshes the token without UI disruption.
5. **Silent renew fails.** Iframe cannot reach the IdP, refresh credentials are no longer accepted, or third-party storage is blocked; the user is flipped to unauthenticated; consumer redirects to sign-in.
6. **Sign out.** User triggers sign-out; the IdP session ends; the user returns to the configured post-logout URL; local state clears.
7. **API call from any context.** A fetch wrapper attaches the current access token; if expired, it renews on the fly before issuing the request.

## Framework-wide requirements

No asynchronous OIDC operation invoked by the framework MAY hang indefinitely — every such operation MUST be bounded by a consumer-configurable timeout with a sensible default.

The framework MUST NOT throw during render in non-browser contexts. Rendering MUST degrade to an unauthenticated context.

The framework MUST NOT navigate the user to any URL not whitelisted by either the IdP or the return-URL safety rules ([10-return-url-safety](10-return-url-safety.md)).

The framework MUST share exactly one OIDC client instance per configuration identity. Multiple components MUST NOT yield multiple parallel event subscriptions for the same identity.

The framework MUST ship as ESM, side-effect-free, with TypeScript types included.

The public surface MUST remain stable within a major version. Breaking changes MUST be accompanied by spec changes.

The framework MUST NOT log to the developer console on its own. All diagnostics flow through the documented error surface ([11-error-model](11-error-model.md)).

The framework MUST NOT take a dependency on a router. Consumers integrate the auth surface with whatever router they choose.

## How to read these specs

Specs are numbered in dependency order. Earlier specs define foundational contracts that later specs build on. Each spec is self-contained but cross-references neighbors when behavior overlaps. The configuration spec ([01-configuration](01-configuration.md)) is referenced by almost every other spec; the storage contract ([02-storage-contract](02-storage-contract.md)) and return-URL safety ([10-return-url-safety](10-return-url-safety.md)) are referenced by all flow specs.

## Source evidence and handoff status

These files define the proposed clean-room target; they are not proof that the current package implements every MUST requirement. Executable evidence is in `src/`, `package.json`, the root configuration files, and `.github/`. Where that evidence disagrees with a spec, the disagreement and its status are recorded in [15-source-reconciliation](15-source-reconciliation.md). `SOURCE` identifies observed repository behavior, `AGENT` identifies an unapproved recommendation, and `ASSUMPTION` identifies an unresolved input.

The handoff is **not frozen** while any `OPEN` decision in the reconciliation register could change public, security, persistence, or operational behavior. After those decisions are approved and incorporated, the resolved specs become the sole implementation brief. A replacement implementation should preserve the approved observable contract, not the current private file layout or algorithms, and should not consult the old source unless the user explicitly reopens it.
