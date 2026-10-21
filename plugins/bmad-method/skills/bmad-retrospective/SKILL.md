---
name: bmad-retrospective
description: "Review a finished epic folder in the ticket tree against the evidence it left behind — the epic file, each ticket's story file and plan, diffs, commits — and produce a retrospective with sourced findings, action items, and an acceptance decision. Use when the user says \"run a retrospective\" or \"lets retro the epic [epic]\". Supports -H/--headless"
---

## ChatGPT adapter bootstrap

Before following the upstream BMAD instructions below, run this once for the current project root:

```bash
python3 "{skill-root}/scripts/chatgpt_bootstrap.py" "{project-root}"
```

This materializes BMAD's shared runtime and neutral default configuration at `{project-root}/_bmad` when they are not already present. Existing BMAD configuration is preserved. If bootstrap fails, report the error and halt.


Run the following command exactly once without changing the current working directory.

Replace `{project-root}` with the nearest folder containing `_bmad/`, from the working directory upward.
Replace `{skill-root}` with the absolute path to this skill's directory.

```bash
uv run --no-cache "{project-root}/_bmad/scripts/render_skill.py" --project-root "{project-root}" --skill "{skill-root}"
```

- The command prints the skill's workflow: follow it. `HALT: <reason>`: report the reason and stop.
- If the script does not exist, BMad is not set up in this project yet. Offer to set it up using `bmad` skill, then run the command again. If you do not have the `bmad` skill, offer to install it first.
- On any other output or failure, including `uv` being unavailable, report the command output and stop. Do not run any workflow source directly.
