---
name: bmod-core-tools
description: Required bmod metadata. Never invoke this skill.
---

## ChatGPT adapter bootstrap

Before following the upstream BMAD instructions below, run this once for the current project root:

```bash
python3 "{skill-root}/scripts/chatgpt_bootstrap.py" "{project-root}"
```

This materializes BMAD's shared runtime and neutral default configuration at `{project-root}/_bmad` when they are not already present. Existing BMAD configuration is preserved. If bootstrap fails, report the error and halt.

This folder is the BMad Core Tools module's record, not something to run. Invoke the `bmad` skill with `setup core-tools`; it sets the module up if it never was, and otherwise reports its state. If there is no `bmad` skill, say so and offer `npx skills add bmad-code-org/BMAD-METHOD --skill bmad`.
