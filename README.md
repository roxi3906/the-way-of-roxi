# The Way of Roxi

`the-way-of-roxi` is a reusable skill repository for user-configured software delivery conventions.

## Quick Install

Install every skill for the six primary supported agents:

```bash
npx skills add roxi3906/the-way-of-roxi --skill '*' --agent codex claude-code cursor gemini-cli github-copilot opencode -y
```

List all skills in this repository:

```bash
npx skills add roxi3906/the-way-of-roxi --list
```

This repository uses a community-standard multi-skill layout:

```text
skills/<skill-name>/
  SKILL.md
  agents/openai.yaml
  references/
  scripts/
  assets/
```

All skills follow the open Agent Skills specification. The `skills` CLI maps the same canonical skills into the discovery location supported by the selected compatible agent, so this repository does not maintain vendor-specific copies.

It currently ships three skills:

- `skills/roxis-way/`: Reusable collaboration, implementation, testing, language, and delivery rules for any user.
- `skills/tapd-sync/`: Session-aware TAPD work-item matching, binding, child-requirement creation, and commit-driven completion.
- `skills/tapd-summary/`: Explicitly invoked, read-only daily work and next-day plan summaries grouped by project.

## Agent Compatibility

The locked `skills` CLI is exercised against a fresh temporary installation for every target below. Installation verifies that each registered skill is byte-for-byte identical to its canonical source.

| Agent | Project discovery root | Invocation behavior |
| --- | --- | --- |
| Codex | `.agents/skills` | `roxis-way` and `tapd-sync` may activate implicitly; use `$skill-name` to select explicitly |
| Claude Code | `.claude/skills` | May activate from the description; use `/skill-name` to select explicitly |
| Cursor | `.agents/skills` | May activate from the description; use `/skill-name` or name the skill explicitly |
| Gemini CLI | `.agents/skills` | Discovers relevant skills and may request activation confirmation; name the skill explicitly when needed |
| GitHub Copilot | `.agents/skills` | Loads relevant skills from the shared discovery root; use `/skill-name` or name it explicitly |
| OpenCode | `.agents/skills` | Loads relevant skills from the shared discovery root; use the OpenCode v2 `/skill-name` form or name it explicitly |

Automatic selection is a model decision, so successful installation cannot guarantee implicit activation for every prompt. The descriptions intentionally front-load common English and Chinese trigger phrases. For deterministic use, explicitly say `Use the roxis-way skill ...`, `Use the tapd-sync skill ...`, or invoke the agent-specific command shown above. `tapd-summary` is deliberately explicit-only so ordinary requests for summaries or reports do not trigger TAPD access.

## Repository Layout

```text
.
├── LICENSE
├── package.json
├── README.md
├── scripts
│   ├── lib
│   │   └── run-process.mjs
│   ├── verify-agent-installations.mjs
│   ├── verify-codex-triggers.mjs
│   └── verify.mjs
└── skills
    ├── roxis-way
    │   ├── SKILL.md
    │   └── agents
    │       └── openai.yaml
    ├── tapd-sync
    │   ├── SKILL.md
    │   └── agents
    │       └── openai.yaml
    └── tapd-summary
        ├── SKILL.md
        └── agents
            └── openai.yaml
```

## Install

Install one skill for selected agents:

```bash
npx skills add roxi3906/the-way-of-roxi --skill roxis-way --agent codex claude-code cursor gemini-cli github-copilot opencode -y
```

Replace `roxis-way` with `tapd-sync` or `tapd-summary` as needed. Inspect all available skills with:

```bash
npx skills add roxi3906/the-way-of-roxi --list
```

## Included Skills

`roxis-way` defines defaults for:

- Collaboration language
- Context-aware language selection for each output destination
- Planning artifact placement
- Git conventions and PR authorization
- Post-merge PR cleanup approval and scope limits
- Product language selection
- Frontend coding style
- Comment language
- Third-party package installation preference
- Delivery verification expectations

`tapd-sync` coordinates TAPD tracking across a work session:

- Activates for substantive work sessions even when the user does not mention TAPD, except requests explicitly delegated to `tapd-summary`
- Adapts by runtime capability to an installed TAPD skill, authenticated CLI, or environment configuration
- Ranks up to three matching open work items at session start
- Binds the session only after user confirmation
- Creates valuable follow-up work without repeated TAPD business confirmation while respecting host runtime permissions
- Completes the child requirements covered by successful code commits
- Keeps one TAPD write owner across primary, forked, and compacted contexts
- Keeps the original task moving when TAPD is unavailable

`tapd-summary` produces manual, read-only TAPD summaries:

- Runs only when explicitly invoked as `$tapd-summary` or selected by name
- Reads every configured workspace and relevant work-item model without mutating TAPD
- Separates TAPD workspace containers from project-name evidence
- Combines current-user creation and verified completion events without title-based deduplication
- Produces a live next-day plan from target-day work that remains unfinished
- Returns compact unordered lists grouped by project with title-only work items

## Maintainer Verification

Use Node.js 22.20.0 or newer, install the locked development dependencies, then run the full verification entrypoint:

```bash
npm install
npm run verify
```

`npm test` validates structured metadata, trigger contracts, negative boundaries, OpenAI policy, and real temporary installations for all six agents. `npm run verify:codex` additionally launches fresh, ephemeral, read-only Codex sessions for both implicit skills and the explicit-only summary skill. The online smoke copies only the current `CODEX_HOME` authentication into an isolated temporary home, exposes no host credentials or TAPD adapter to model tools, rejects all tool activity, and fails clearly when Codex is not authenticated.

## License

Apache-2.0
