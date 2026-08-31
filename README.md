# chatgpt-bmad

A ChatGPT compatibility layer for [BMad Method](https://github.com/bmad-code-org/BMAD-METHOD).

This repository tracks upstream BMAD, normalizes its agents/workflows/modules into a machine-readable manifest, and will generate ChatGPT-native Skills from that manifest.

## Architecture

```text
bmad-code-org/BMAD-METHOD
        |
        v
scripts/sync-bmad.mjs
        |
        +--> upstream/VERSION
        +--> upstream/manifest.json
        |
        v
ChatGPT skill generator (next phase)
        |
        v
plugin/skills/*
```

## Sync

Run locally:

```bash
npm run sync
npm run check
```

GitHub Actions runs the same sync daily and can also be started manually. When upstream BMAD changes, the generated upstream metadata is committed back to `main`.

## Design principles

- BMAD remains the source of truth; this repository is an adapter, not a fork.
- Every generated artifact records the exact upstream commit SHA.
- Transformation logic is deterministic and testable.
- ChatGPT-specific packaging is separated from upstream ingestion so BMAD layout changes fail safely instead of silently corrupting Skills.
