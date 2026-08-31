# BMAD -> ChatGPT compatibility

BMAD already publishes an Agent Skills library and a Claude-compatible marketplace. ChatGPT supports importing Claude-compatible plugin marketplaces from GitHub, so this adapter preserves BMAD's skill definitions instead of rewriting them.

## Adapter responsibilities

1. Mirror every skill declared by upstream `.claude-plugin/marketplace.json`.
2. Add `agents/openai.yaml` UI metadata required by the ChatGPT skill packaging convention.
3. Preserve the shared BMAD runtime under `plugin/runtime/`.
4. Validate that every declared skill has a `SKILL.md` and ChatGPT metadata.
5. Track the exact upstream BMAD commit in `upstream/VERSION` and `upstream/manifest.json`.

## Remaining runtime compatibility work

Some BMAD skills intentionally invoke scripts at `{project-root}/_bmad/scripts/...`. A marketplace import alone does not guarantee that project-local runtime exists. The adapter therefore must add a small bootstrap/compatibility layer before we call the distribution fully operational in ChatGPT.

Until that layer is verified, the generated marketplace should be treated as structurally importable but not yet end-to-end validated for every BMAD workflow.
