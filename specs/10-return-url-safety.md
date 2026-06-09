# Spec 10 — Return URL Safety (Open-Redirect Protection)

## Step 1 — Return-URL normalization

The framework's return-URL handling is the single chokepoint where open-redirect attacks MUST be blocked. Only in-app absolute paths are accepted. Any URL carrying a scheme, host, or a protocol-relative prefix is replaced with the SPA root.

A return-URL normalizer (`normalizeReturnUrl`) MUST exist that takes an arbitrary value and produces a safe in-app path:

- Returns the SPA root when the input is a falsy value.
- Returns the SPA root when the input does not begin with a forward slash.
- Returns the SPA root when the input begins with two forward slashes (protocol-relative).
- Otherwise returns the input unchanged.

The normalizer MUST be pure — no DOM access, no storage access. Normalization MUST execute before persistence; storage MUST NEVER contain an unsafe value.

Input → expected output reference:

| Input | Output |
| --- | --- |
| unset | `"/"` |
| empty string | `"/"` |
| `"/"` | `"/"` |
| `"/admin"` | `"/admin"` |
| `"/admin/users?tab=active"` | `"/admin/users?tab=active"` |
| `"/admin#section"` | `"/admin#section"` |
| `"https://app/admin"` | `"/"` |
| `"//attacker.com/path"` | `"/"` |
| `"javascript:alert(1)"` | `"/"` |
| `"admin"` (no leading slash) | `"/"` |
| `"?next=1"` (query-only) | `"/"` |
| `"#hash"` (hash-only) | `"/"` |

## Step 2 — State resolver

A callback-state-to-return-URL resolver (`resolveCallbackReturnUrl`) is used internally by the callback handler. It extracts a return URL embedded in the OIDC state object:

- Returns an unset value when the state is falsy or not an object.
- Returns an unset value when the state's return URL field is not a string.
- Passes the returned string through the normalizer.
- Discards the normalized result (returns unset) when it would be detected as a callback URL ([05-callback](05-callback.md)).
- Otherwise returns the normalized string.

## Step 3 — Loop prevention at every ingress

Normalization MUST execute on every ingress: caller input to sign-in, stored fallback during callback, state-carried return URL during callback. No path may bypass it.

The sign-in operation ([04-sign-in](04-sign-in.md)) MUST NOT store or transmit a return URL that matches callback-URL detection. The callback handler ([05-callback](05-callback.md)) MUST reject a storage-fallback return URL that matches callback-URL detection.

## Step 4 — Threat model scope

The framework's return-URL handling governs post-callback navigation only. It does not:

- Validate that the configured redirect URI matches the SPA origin — that is the IdP's responsibility via its valid-redirect-URI whitelist.
- Prevent token leakage via referrer headers — consumers MUST set referrer-policy headers at the document level.
- Prevent CSRF on the sign-in flow — the underlying OIDC client's state parameter handles that.
- Sanitize operator-controlled configuration (IdP authority, SPA app URL, redirect URI).

If a consumer's own client-side router acts on query parameters that affect navigation, the consumer MUST sanitize those independently. The return-URL normalizer governs only what the framework navigates to.

Paths with `..` or encoded slashes are not flattened — passed through unchanged. The browser resolves them at navigation time; the result remains on-origin.
