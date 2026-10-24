# CI pipelines

Delivery and reporting are independent workflows. A failed security or code quality
report does not block publication or deployment. Build failures, missing artifacts,
archive identity mismatches, signing failures, SSH host identity failures and
production health/TLS failures still stop delivery.

| Workflow                      | Trigger                            | Responsibility                                                     |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `publish.yml`                 | Existing delivery events           | Build, publish and deploy the release artifact.                    |
| `ci.yml` calling `verify.yml` | Push to main, pull request, manual | Run the existing quality checks and retain results for correction. |
| `security.yml`                | Monday 05:23 UTC or manual         | Source security and dependency audits.                             |
| `codeql.yml`                  | Tuesday 06:41 UTC or manual        | CodeQL security and quality analysis.                              |

Cron times use UTC, so their local time changes with daylight saving time.
Security and CodeQL have no push or pull-request trigger. They are not dependencies
of delivery workflows. A report may fail its own workflow to keep findings and
scanner failures visible; it does not turn them into successful scan evidence.

Quality runs every check declared by the existing `verify` script, including
architecture, duplication and unused-dependency checks, even when an earlier
check fails. Results appear in the run summary and the `code-quality` artifact.
Detailed command diagnostics remain in the job logs. Dependencies are reported
in `dependency-security`; source findings in `security-*`; CodeQL in
`codeql-sarif`. Report artifacts have seven-day retention and remain accessible
through the repository's Actions permissions. Download reports before expiry
when tracking a correction for longer.

Release building, code quality and dependency/SPA security checks use reusable
workflows from VelvetConfigs 3.21.0, pinned to the immutable commit
`ad587f572dab1149288acf3f8001a7ea6ea9e225`. Temporary local copies of these
workflows have been removed. Repository-specific triggers, public build inputs,
permissions and release orchestration remain in this repository. Scanner and
publisher callers and direct tooling checkouts select the same release. Nested
tooling pins inside the shared workflows remain owned by that published version.

SBOM generation inventories dependencies without checking advisory databases.
Retaining and signing an SBOM on the delivery path does not establish a clean
security scan. Existing developer `verify`, lint and audit commands remain strict.

GitHub repository rules are separate from workflow dependencies. If an existing
branch protection rule, ruleset, required workflow or environment deployment rule
requires security or quality success, remove that reporting check from the required
set to apply this policy there too. Keep delivery/build checks required as needed.
Repository settings have not been changed by this configuration edit.

## Validation scope

Workflow YAML, embedded JavaScript syntax, shared workflow input/secret contracts,
job dependencies and weekly schedule configuration have been checked locally against the published shared release.
This does not establish successful GitHub Actions execution or a passing scan.

`npm run verify` from `./` remains unrun for this change.
No scanner, registry publication, SSH deployment or active staging scan was executed.
