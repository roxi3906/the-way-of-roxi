# The Way of Roxi

`the-way-of-roxi` is a reusable skill repository for user-configured software delivery conventions.

## Quick Install

Install a published skill directly from GitHub:

```bash
npx skills add roxi3906/the-way-of-roxi --skill roxis-way
npx skills add roxi3906/the-way-of-roxi --skill tapd-sync
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

The `tapd-sync` skill follows the open Agent Skills specification. The `skills` CLI maps the same canonical skill into the discovery location supported by the selected compatible agent, so this repository does not maintain vendor-specific copies.

It currently ships two skills:

- `skills/roxis-way/`: Reusable collaboration, implementation, testing, language, and delivery rules for any user.
- `skills/tapd-sync/`: Session-aware TAPD work-item matching, binding, child-requirement creation, and commit-driven completion.

## Repository Layout

```text
.
├── LICENSE
├── README.md
└── skills
    ├── roxis-way
    │   ├── SKILL.md
    │   └── agents
    │       └── openai.yaml
    └── tapd-sync
        ├── SKILL.md
        └── agents
            └── openai.yaml
```

## Install

Install from GitHub with the `skills` CLI:

```bash
npx skills add roxi3906/the-way-of-roxi --skill roxis-way
npx skills add roxi3906/the-way-of-roxi --skill tapd-sync
```

Install any specific skill with `--skill <skill-name>` or inspect all available skills with:

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

- Activates for every substantive work session, even when the user does not mention TAPD
- Adapts by runtime capability to an installed TAPD skill, authenticated CLI, or environment configuration
- Ranks up to three matching open work items at session start
- Binds the session only after user confirmation
- Creates valuable follow-up work without repeated TAPD business confirmation while respecting host runtime permissions
- Completes the child requirements covered by successful code commits
- Keeps one TAPD write owner across primary, forked, and compacted contexts
- Keeps the original task moving when TAPD is unavailable

## License

Apache-2.0
