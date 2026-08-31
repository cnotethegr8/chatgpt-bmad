# BMAD Method for ChatGPT

Use the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) directly in ChatGPT through native Skills.

`chatgpt-bmad` packages BMAD's agents and workflows for the OpenAI ecosystem, giving ChatGPT access to BMAD capabilities for product planning, architecture, UX, development, code review, research, and more.

The plugin automatically tracks upstream BMAD releases, regenerates the ChatGPT distribution, validates every generated skill, and runs runtime integration tests before updates are published.

## Using BMAD in ChatGPT

Once the **BMAD Method** plugin is installed in ChatGPT, you can use BMAD naturally in your conversations.

You don't need to manually select individual workflows or understand how BMAD is packaged internally. Describe what you want to accomplish and ChatGPT can invoke the appropriate BMAD skill.

For example:

**Brainstorm a product idea**

> Use BMAD to help me brainstorm and refine an idea for a marketplace connecting homeowners with local contractors.

**Create a PRD**

> Use BMAD to create a PRD for this product. Walk me through the process and ask me for anything you need.

**Design the architecture**

> Use BMAD to design the system architecture based on this PRD.

**Create epics and stories**

> Turn this PRD and architecture into implementation-ready epics and user stories using BMAD.

**Work with a BMAD specialist**

> Use the BMAD UX Designer to help me design the user experience for this feature.

You can also explicitly ask ChatGPT to use a particular BMAD workflow or agent when you want more control.

## What's included

The plugin exposes BMAD capabilities across the software-development lifecycle, including:

- brainstorming and advanced elicitation
- product and business analysis
- product requirements
- UX design
- system architecture
- epics and user stories
- implementation
- code review
- research
- project course correction
- BMAD specialist agents

The available skills are generated from upstream BMAD rather than maintained as an independent rewrite.

## Staying in sync with BMAD

BMAD Method remains the source of truth.

```text
BMAD Method
    ↓
sync upstream
    ↓
generate ChatGPT skills
    ↓
validate + runtime test
    ↓
publish
```

The repository checks upstream BMAD automatically. A generated distribution is only published after its skills pass validation and runtime integration testing.

This allows the ChatGPT version to follow BMAD development without becoming a separate fork.

## Development

Requires **Node.js 20+**.

```bash
git clone https://github.com/cnotethegr8/chatgpt-bmad.git
cd chatgpt-bmad

git clone --depth 1 https://github.com/bmad-code-org/BMAD-METHOD.git .tmp/bmad

npm run sync
npm run build -- .tmp/bmad
npm run check
npm run integration
```

## About BMAD Method

[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) is the upstream project and source of truth for the BMAD methodology, agents, and workflows.

`chatgpt-bmad` is a compatibility and distribution layer that adapts BMAD for ChatGPT and OpenAI-compatible skill runtimes. It is not a fork or independent reimplementation of BMAD.

BMAD Method and generated/adapted BMAD content remain subject to the applicable upstream licensing terms.
