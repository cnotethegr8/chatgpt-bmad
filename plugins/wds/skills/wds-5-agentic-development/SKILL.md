---
name: wds-5-agentic-development
description: "Use Whiteport Design Studio (WDS) for AI-assisted development, testing, and reverse engineering through structured agent collaboration"
---

## ChatGPT WDS bootstrap

Before executing this upstream WDS agent or workflow, initialize the project's WDS runtime:

```bash
python3 "{skill-root}/scripts/chatgpt_bootstrap.py" "{project-root}"
```

This installs WDS's upstream workflows and shared references into
`{project-root}/_bmad/wds`, retaining any existing WDS project configuration.
Keep the BMAD Method plugin available for BMAD core workflows.
If bootstrap fails, report the error; do not continue with incomplete setup.


Follow the instructions in ./workflow.md.
