# Automatic BMAD compatibility failure reporting

The sync pipeline treats the generated ChatGPT distribution as a last-known-good artifact. Generation, structural validation, and runtime integration checks must all pass before generated changes are committed. Failure reporting is diagnostic only and never changes that publication gate.

## Architecture

Failure reporting is kept outside BMAD transformation logic:

- `scripts/compatibility-incident.mjs` is the transport-independent core. It classifies failures, extracts an affected skill/workflow when possible, redacts secrets, truncates diagnostics, creates stable incident keys, and renders issue content.
- `scripts/report-compatibility.mjs` is the GitHub issue transport. It creates a new issue or comments on the existing open issue for the same incident key.
- `scripts/resolve-compatibility.mjs` closes matching open incidents after the same upstream SHA completes generation, validation, and runtime checks successfully.
- `scripts/simulate-compatibility-failure.mjs` is a manual acceptance-test helper. It is inert unless a `workflow_dispatch` run explicitly selects a simulated failure.
- `.github/workflows/sync-bmad.yml` orchestrates stages and captures bounded stage logs. This makes another transport such as Slack or email possible without changing the BMAD adapter/generator.

The incident key is `upstream BMAD SHA + failure category`. A non-transient clone failure that occurs before an upstream SHA can be determined uses `unknown + upstream_sync`; the next successful upstream fetch closes that unattributed clone incident.

## Failure categories

| Pipeline stage | Compatibility category | Issue behavior |
| --- | --- | --- |
| upstream clone | `infrastructure_transient` when network/rate-limit/runner patterns are detected; otherwise `upstream_sync` | transient failures do not open issues |
| metadata sync | `upstream_sync` | create/update |
| adapter/generator | `adapter_generator` | create/update |
| marketplace manifest validation | `openai_marketplace_compatibility` | create/update |
| generated plugin validation | `plugin_structural_validation` | create/update |
| integration bootstrap | `runtime_bootstrap` | create/update |
| rendered BMAD workflow | `bmad_workflow_runtime` | create/update |
| other integration failure | `runtime_integration` | create/update |

Runtime classification uses the existing labeled smoke-test errors (for example `bootstrap bmad-prd` and `render bmad-build`) instead of hard-coding behavior around a specific BMAD release.

## Issue lifecycle

A first failure creates an issue containing a hidden deterministic marker. A later failure with the same upstream SHA and category finds that marker and adds a `Latest failure` comment rather than creating another issue. Different upstream SHAs or categories create distinct incidents.

After all compatibility gates pass for an upstream SHA, matching open incidents for that SHA are commented with the successful run and closed as completed. Infrastructure/transient failures fail the workflow but do not create compatibility issues.

## Diagnostics and security

Issue reports include upstream version/SHA when available, the `chatgpt-bmad` SHA, workflow run URL, stage/category, affected skill/workflow when identifiable, previous known-good metadata, reproduction command, timestamp, and a bounded error excerpt. Full logs remain linked from the Actions run.

Before issue publication, diagnostic text is redacted for common token formats, authorization headers, credential assignments, and environment values whose names indicate tokens, secrets, passwords, API keys, access keys, or private keys. Excerpts are capped at 6,000 characters. Do not add raw environment dumps to compatibility logs or issue bodies.

The manual simulator deliberately writes a fake bearer credential into its synthetic diagnostic so acceptance testing exercises the same redaction path used for real failures. The fake value is test-only and is not a repository or Actions secret.

## Manual acceptance testing

Use **Actions → Sync BMAD → Run workflow** and choose `simulate_failure_stage`. The default is `none`, and scheduled or push-triggered runs always behave as `none`; failure injection is only reachable through an explicit `workflow_dispatch` input.

Supported simulations are:

- `upstream_sync`
- `adapter_generator`
- `validate_manifest`
- `validate_plugin`
- `runtime_bootstrap`
- `bmad_workflow_runtime`
- `runtime_integration`

A full lifecycle acceptance check is:

1. Manually run the workflow with a simulated stage such as `adapter_generator` and verify exactly one compatibility issue is created.
2. Re-run the same failure for the same upstream SHA and verify the existing issue receives a `Latest failure` comment instead of a second issue being created.
3. Verify the diagnostic excerpt shows the simulator's bearer value as `[REDACTED]`.
4. Manually run the workflow again with `simulate_failure_stage=none` and verify all compatibility gates pass and the matching incident closes automatically.

The acceptance harness never commits a generated distribution from a failed run; the existing generation, structural validation, and runtime compatibility gate remains authoritative.

## Local verification

Run:

```bash
npm run test:compat
npm run check
npm run integration
```

`test:compat` covers failure classification, runtime target extraction, dedupe markers, redaction, and diagnostic truncation. The existing `check` and `integration` commands remain the publication compatibility gates.
