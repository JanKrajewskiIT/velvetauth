# Spec 05 — Callback Handling

## Step 1 — Callback detection

Callback detection MUST return true only when both conditions hold:

- The URL's path matches the resolved redirect URI's path under a normalization that strips a trailing slash other than the root.
- The URL's query contains either an authorization code or an error indicator AND at least one of: an OIDC state parameter, a session state parameter, or an issuer parameter.

The detection function (`isOidcCallbackReturnUrl(value, appUrl, origin?)`) MUST treat malformed URLs as not-a-callback (no throw). It MUST tolerate relative URL inputs by resolving them against the current browser origin. An optional `origin` parameter MAY be supplied to override the resolved origin — useful in non-browser contexts and testing. When `origin` is absent the function falls back to `window.location.origin` in a browser or a stable placeholder origin otherwise. Detection MUST be O(1) per evaluation.

## Step 2 — Inline processing (within the provider)

On provider mount, if the current URL is detected as a callback, the provider MUST process it asynchronously.

Callback processing MUST invoke the OIDC client's redirect-callback exchange, bounded by the configured timeout.

After a successful exchange, the framework MUST commit "user present, not loading, no error". The return-URL target MUST be resolved with the priority:

1. Return URL carried via OIDC state (subject to normalization and loop checking per [10-return-url-safety](10-return-url-safety.md)).
2. The return-URL storage entry (subject to normalization and loop checking).
3. The SPA root.

The return-URL storage entry MUST be read and immediately removed before fallback resolution. A stored return URL that is itself shaped like a callback URL MUST be ignored — loop prevention.

When the resolved target differs from the current URL, the framework MUST initiate a full navigation to the target using replace semantics (`location.replace`) so the consumed callback URL does not remain reachable via the back button. When the resolved target equals the current URL minus the IdP query, the framework MUST instead clean the URL in place by stripping the query and preserving path and hash (`history.replaceState`). `location.assign` MUST NOT be used for post-callback navigation.

A failed exchange MUST commit "no user, not loading, error message" and MUST still clean the URL.

## Step 3 — Detection constraints

Callback detection is path- and query-shape-based. It does NOT compare the URL's origin against the deployment origin. The deployment is the trust boundary: the SPA only ever loads on its own origin, so a callback-shaped URL reaching the detection function is, by construction, same-origin.

**Hash-based routing.** Detection compares pathnames only. Consumers using hash routers MUST configure the redirect URI to use the pre-hash path (e.g. `/auth/callback`, not `/#/auth/callback`). Return URLs whose first character is not a forward slash are rewritten to the SPA root by the return-URL normalizer.

**Multiple authorities sharing the same redirect path.** Detection cannot disambiguate between them. Consumers using more than one IdP authority MUST configure distinct callback paths per authority.

## Step 4 — Standalone handler (route-mounted)

The standalone callback handler (suggested name: `handleAuthRedirectCallback`) MUST resolve to "did not navigate" when invoked outside a browser runtime or when the current URL is not a callback.

When the current URL is a callback, the handler MUST follow the same exchange and return-URL resolution algorithm as inline mode. The handler MUST return a boolean indicating whether a full navigation was issued, so the caller can render an idle placeholder vs. a "redirecting" placeholder.

Consumers MUST pick exactly one integration mode — inline or standalone. Using both simultaneously causes one of the two to receive a "code already consumed" error from the OIDC client.
