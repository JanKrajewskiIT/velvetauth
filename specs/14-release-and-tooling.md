# Spec 14 — Release & Tooling

## Step 1 — Published artifact shape

The framework MUST be published as a single ESM-only package:

- Module format ESM only. The package MUST NOT ship a CommonJS entry point or a dual-format build.
- `"type": "module"` in `package.json`.
- Exactly one public entry exporting the surface from [13-consumer-integration](13-consumer-integration.md).
- Bundled `.d.ts` accompanying the entry, resolvable under both `"types"` and the `"types"` condition in `"exports"`.
- `sideEffects: false`.
- Published files limited to the build output directory only. Source, tests, configs, and development files MUST be excluded via the `files` allowlist.
- SolidJS and `oidc-client-ts` declared as peer dependencies. The build MUST mark both as externals so they remain peer-resolved at the consumer site.
- `engines.node` at or above `>=26`, mirroring the floor required by the shared tooling framework.

## Step 2 — Package manifest baseline

The framework's `package.json` MUST declare at minimum:

| Field                    | Required value or shape                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`                   | The published package name.                                                                                                                                        |
| `version`                | A semantic version string.                                                                                                                                         |
| `type`                   | `"module"`.                                                                                                                                                        |
| `license`                | An SPDX identifier.                                                                                                                                                |
| `description`            | A one-line human-readable description.                                                                                                                             |
| `keywords`               | A non-empty list of registry-search keywords.                                                                                                                      |
| `repository`             | An object with `type` and `url` pointing at the source repository.                                                                                                 |
| `packageManager`         | A corepack-style identifier pinning the package manager and its major.                                                                                             |
| `engines.node`           | `>=26`.                                                                                                                                                            |
| `exports`                | Exactly one public entry; `"types"` condition before `"import"` condition; no CommonJS conditions.                                                                 |
| `sideEffects`            | `false`.                                                                                                                                                           |
| `files`                  | An explicit allowlist limited to the build output directory.                                                                                                       |
| `publishConfig.registry` | The registry URL the framework publishes to.                                                                                                                       |
| `publishConfig.access`   | `"public"`. Required so the publish step can attach an OIDC-signed provenance attestation; npm refuses provenance for `restricted` or first-time private packages. |
| `peerDependencies`       | SolidJS and `oidc-client-ts` at the minimum versions from [00-overview](00-overview.md).                                                                           |
| `scripts`                | At minimum: `verify`, `build`, `typecheck`, `lint`, `lint:fix`, `format`, `format:check`, `prepublishOnly`, `prepare`.                                             |
| `devDependencies`        | MUST include `@jankrajewskiit/configs` at `^2.0.2`.                                                                                                                |

## Step 3 — Shared tooling framework

The framework MUST depend on `@jankrajewskiit/configs` at `^2.0.2` (2.x major; never 1.x). The 1.x line MUST NOT be used — it has incompatible peer-dependency floors and divergent factory shapes.

The framework MUST consume its lint, format, style-lint, TypeScript, Vite, lint-staged, and Husky presets exclusively from the published subpath exports of `@jankrajewskiit/configs`. The framework MUST NOT vendor, fork, or re-implement those presets locally.

| Subpath                                    | Where wired                           | What the framework relies on                                                       |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `@jankrajewskiit/configs/eslint`           | `eslint.config.mjs`                   | The browser/SolidJS factory; MUST NOT assemble its own ESLint plugin list.         |
| `@jankrajewskiit/configs/prettier`         | `"prettier"` field or `.prettierrc.*` | The preset's formatter rules verbatim.                                             |
| `@jankrajewskiit/configs/stylelint`        | `.stylelintrc.*`                      | The preset's Stylelint rules verbatim (if CSS is shipped).                         |
| `@jankrajewskiit/configs/tsconfig/lib`     | `tsconfig.json`                       | Library compiler options. MUST NOT extend `app`, `node`, `test`, or other presets. |
| `@jankrajewskiit/configs/vite`             | `vite.config.ts`                      | SolidJS library factory: compilation, declaration-file bundling, externalization.  |
| `@jankrajewskiit/configs/lint-staged`      | `lint-staged.config.mjs`              | The lint-staged 17.x-compatible factory output.                                    |
| `@jankrajewskiit/configs/husky/pre-commit` | `.husky/pre-commit`                   | The shared pre-commit shell script. MUST NOT hand-roll an equivalent.              |

Optional peer-dependency floors the framework's `devDependencies` MUST satisfy:

| Peer          | Floor      |
| ------------- | ---------- |
| `eslint`      | `>=9.0.0`  |
| `prettier`    | `>=3.0.0`  |
| `stylelint`   | `>=17.0.0` |
| `typescript`  | `>=5.5.0`  |
| `vite`        | `>=6.0.0`  |
| `lint-staged` | `>=17.0.0` |

## Step 4 — Required entry files (preset wiring)

| File                     | Required wiring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `eslint.config.mjs`      | Default-exports the result of `createEslintConfig` from `@jankrajewskiit/configs/eslint`. Passes `tsconfigRootDir`. Enables the browser environment. MUST NOT compose additional ESLint plugins or override rules outside the factory's documented options surface.                                                                                                                                                                                                                                                            |
| `vite.config.ts`         | Invokes `defineConfig` with an async factory returning the result of `createSolidLibViteConfig` from `@jankrajewskiit/configs/vite`. Enables `externalizeFromPackageJson` and `preserveModules: false` to produce a single bundled entry. MUST NOT register `vite-plugin-solid` or `vite-plugin-dts` directly.                                                                                                                                                                                                                 |
| `tsconfig.json`          | Extends `@jankrajewskiit/configs/tsconfig/lib`. MUST NOT extend any other preset from the `tsconfig` subpath. MUST declare `"rootDir": "src"` in `compilerOptions` so that declaration files are emitted to `dist/` rather than `dist/src/`.                                                                                                                                                                                                                                                                                   |
| `lint-staged.config.mjs` | Default-exports the result of the factory from `@jankrajewskiit/configs/lint-staged`. MUST NOT use the 1.x-style `.lintstagedrc` JSON shape. If no CSS is shipped, the Stylelint entry MUST be dropped from the returned config object: call `createLintStagedConfig()` without arguments, then `delete config['*.css']` before exporting. MUST NOT pass an empty string as `stylelintTarget` — the factory uses `??` and an empty string bypasses the default, producing an invalid glob that crashes lint-staged at runtime. |
| `.husky/pre-commit`      | Sources the pre-commit shell script from `@jankrajewskiit/configs/husky/pre-commit`. The sourcing path MUST resolve relative to the hook file's own directory using a single `..` traversal: `. "$hook_dir/../node_modules/@jankrajewskiit/configs/husky/pre-commit.sh"`. Using `../..` resolves outside the repository root and will fail.                                                                                                                                                                                    |
| Prettier wiring          | Either `"prettier": "@jankrajewskiit/configs/prettier"` in `package.json` OR a single `.prettierrc.*` re-exporting the preset verbatim. Exactly one MUST exist.                                                                                                                                                                                                                                                                                                                                                                |
| Stylelint wiring         | `.stylelintrc.*` extending `@jankrajewskiit/configs/stylelint` if CSS is shipped. If no CSS is shipped, omit the file entirely and drop the Stylelint entry from `lint-staged.config.mjs` as described above.                                                                                                                                                                                                                                                                                                                  |

## Step 5 — Required workspace files

| File             | Required content                                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.npmrc`         | Scope-to-registry mapping routing `@jankrajewskiit` to the registry from `publishConfig.registry`. MUST NOT contain credentials.                                                    |
| `.editorconfig`  | UTF-8, `lf` line endings, indent size 2, insert-final-newline, trim-trailing-whitespace.                                                                                            |
| `.nvmrc`         | A Node version string satisfying `engines.node`.                                                                                                                                    |
| `.node-version`  | The same Node version string as `.nvmrc`. The two files MUST agree at all times.                                                                                                    |
| `.gitattributes` | `text=auto eol=lf` for all text files.                                                                                                                                              |
| `.gitignore`     | Excludes `node_modules/`, build output, `.husky/_`, editor/OS noise, local env files, the regenerated root `AGENTS.md`. MUST NOT exclude the lockfile or the submodule directories. |
| `.gitmodules`    | Declares exactly three submodule entries (`.claude`, `.cursor`, `.agents`) with identical `url` pointing at the organization-level upstream agent-guideline repository.             |
| `CHANGELOG.md`   | A section for every published version, grouped at minimum into "Breaking", "Added", "Changed", "Fixed". Each version-bump commit MUST contain the corresponding changelog edit.     |

## Step 6 — Verification gate

The framework MUST expose a single verification command (`npm run verify`) that runs in order:

1. Typecheck of the entire workspace.
2. Lint over the entire workspace.
3. Production build that produces the published artifact.
4. Package-shape linting: ESM-only checks (`publint`) plus type-portability checks (`@arethetypeswrong/cli` in ESM-only mode with `--ignore-rules internal-resolution-error`) scoped to the published entry. The `internal-resolution-error` rule is suppressed because `unplugin-dts` does not rewrite relative import extensions in emitted `.d.ts` files; bare imports resolve correctly under `bundler` moduleResolution used by all target consumers.

The verification command MUST exit non-zero on the first failing step. `prepublishOnly` MUST invoke this exact command. CI MUST invoke this exact command rather than re-implementing the gate definitions inline.

## Step 7 — Local commit hook

The framework MUST install a pre-commit hook that runs only on staged files, applies format and lint fixes scoped to staged files, and exits non-zero if any staged file still violates lint after fixes are applied. The hook MUST NOT invoke the full verification command. Hook installation MUST be automatic on `npm install` via a `prepare` script.

## Step 8 — CI pipeline

CI MUST run on every push to the default branch and every pull request targeting it. CI MUST execute the verification command on a clean checkout. CI MUST NOT publish, tag, or mutate the repository.

The framework MUST ship:

| File                           | Role                                                                                                                                                                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/verify.yml` | Reusable verification workflow declared `workflow_call`-reusable. Installs dependencies via `npm ci` with `GHCR_TOKEN: ${{ secrets.GITHUB_TOKEN }}` so the `${GHCR_TOKEN}` substitution in `.npmrc` resolves correctly. Runs the audit gate at `--audit-level=high`. Runs `npm run verify`. |
| `.github/workflows/ci.yml`     | Entrypoint for verification triggered on push to the default branch and on PRs targeting it. Delegates to `verify.yml`. MUST NOT hold a registry credential.                                                                                                                                |

The verify workflow MUST pin the Node version to the value in `.nvmrc`. It MUST cache the dependency store keyed on the lockfile hash. It MUST NOT push commits, create tags, comment on PRs, or write to the registry.

Every workflow MUST pin `actions/checkout` at `v6` and `actions/setup-node` at `v6`. Earlier major versions MUST NOT be used.

Every caller that invokes `verify.yml` via `workflow_call` MUST pass `secrets: inherit` so that `GITHUB_TOKEN` is available inside the reusable workflow for authenticated `npm ci`. Without it, the `${GHCR_TOKEN}` substitution in `.npmrc` resolves to an empty string and the install fails with a 401.

## Step 9 — Release pipeline

A release MUST be triggered by pushing a git tag matching the release-tag pattern (`v<semver>`). No other trigger MUST cause a publish.

The framework MUST ship `.github/workflows/publish.yml` with three sequential jobs:

1. **Verify** — invokes `verify.yml` via `workflow_call`. MUST NOT receive registry credentials.
2. **Check-version** — extracts the semver portion of the pushed tag, compares it character-for-character to `package.json#version`, and fails with a human-readable message if they disagree. MUST NOT receive registry credentials.
3. **Publish** — the only job that receives the registry credential. Holds `id-token: write` permission. Runs `npm publish --provenance --access public` against the registry from `publishConfig.registry`. MUST NOT run if any previous job failed.

The workflow MUST declare a `concurrency` group keyed on the tag so a duplicate tag-push run cannot race itself.

## Step 10 — Semver contract and changelog

- PATCH — bug fixes, dependency bumps that do not alter exported behavior.
- MINOR — additive changes: new exports, new factory options with safe defaults.
- MAJOR — breaking changes: removing or renaming an export, raising peer-dependency minimum versions, changing default behavior.

Commit messages MUST follow Conventional Commit prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). A breaking change MUST be marked with `!` after the type/scope or with a `BREAKING CHANGE:` footer.

A published version MUST NOT be unpublished once consumers may have installed it. For a broken release, publish a superseding patch and run `npm deprecate <name>@<version>` against the broken version. No workflow file MAY contain an `npm unpublish` invocation.

## Step 11 — Provenance attestations

The framework is a security-sensitive dependency: a compromised publish path compromises every consumer. The publish job MUST invoke `npm publish --provenance`. The job MUST hold `id-token: write` permission so sigstore can mint a short-lived OIDC token.

A missing or failed provenance generation step MUST fail the publish job. The workflow MUST NOT fall back to a non-provenance publish. When sigstore is transiently unreachable, the workflow MUST be re-run against the same tag once sigstore is back — the tag MUST NOT be advanced.

`publishConfig.access` MUST be `"public"` (Step 2). npm rejects provenance for `restricted` or first-time private packages.

The `README.md` MUST document the consumer-side verification command: `npm audit signatures <package-name>`.

## Step 12 — Audit gating and code ownership

The verify workflow MUST run a high-severity audit step (`npm audit --audit-level=high`). The step MUST NOT be marked `continue-on-error`. A high-severity advisory that the maintainer determines is not exploitable MAY be suppressed only via an explicit, source-controlled suppression record citing the advisory ID and justification. Every suppression MUST carry a target removal date; an expired suppression MUST fail the verify workflow.

The repository MUST ship `.github/CODEOWNERS` declaring ownership of at minimum: the repository root, the specs directory, the source directory, `.github/workflows/`, `package.json`, the lockfile, `.npmrc`, and the preset-wiring entry files from Step 4.

Default-branch protection MUST require: a passing verify status check, a passing audit status check, at least one approving CODEOWNERS review, and an up-to-date branch. Force pushes and non-administrative direct pushes to the default branch MUST be disabled.

## Step 13 — Dependency automation

The framework MUST ship `.github/dependabot.yml` covering:

- `npm` — weekly schedule, updates grouped by tool family (`eslint*`, `prettier*`, `stylelint*`, `vite*`, `typescript*`, `@jankrajewskiit/*`, `solid-js*`, `oidc-client-ts*`), an open-PR limit, and the `dependencies` label.
- `github-actions` — weekly schedule.

All Dependabot PRs MUST carry the `dependencies` label. Commit prefixes MUST follow the conventional-commit policy (`chore:` or `build:`). The configuration MUST declare a non-empty `reviewers:` list referencing CODEOWNERS owners. Patch and minor updates MAY be auto-merged once verify passes. Major updates MUST require a CODEOWNERS review.

## Step 14 — Agent guideline submodules

Multiple AI/agent runtimes look for their guideline payload at distinct paths. The framework MUST consume the agent-guideline payload as three git submodules — all targeting the same upstream repository.

| Submodule path | Consumed by                             |
| -------------- | --------------------------------------- |
| `.claude/`     | Claude Code                             |
| `.cursor/`     | Cursor                                  |
| `.agents/`     | Generic `AGENTS.md`-convention runtimes |

`.gitmodules` MUST declare exactly these three entries with identical `url`. Edits to agent guidelines MUST flow through the upstream submodule repository; the framework MUST NOT commit edits made directly inside `.claude/`, `.cursor/`, or `.agents/`. None of the submodule paths, `.gitmodules`, or a root `AGENTS.md` MAY ship in the published tarball.

## Step 15 — README requirements

The framework MUST ship a root-level `README.md` included in the published tarball containing:

- **Install** — package name, install command, `.npmrc` scope-to-registry entry, peer dependencies with minimum versions.
- **Integration overview** — a minimal end-to-end example: provider mount, configuration record, off-component getter, sign-in / sign-out triggers.
- **Surface table** — every public export with a one-line description, kept in sync with [13-consumer-integration](13-consumer-integration.md).
- **Upgrading** — link to `CHANGELOG.md` entries; when a new major has shipped, the previous major's last-supported version.
- **Provenance verification** — `npm audit signatures <package-name>` as a copy-pasteable one-liner, with a brief explanation of what a passing audit attests.
- **Release workflow** — the bump → tag → push flow, and the broken-release recovery procedure (`npm deprecate` + superseding patch).
- **Branch protection** — the checklist from Step 12 so a fresh fork can re-establish protection without guessing the contract.
