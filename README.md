# The Way of Roxi

`the-way-of-roxi` is a skill repository for Roxi's software delivery conventions.

This repository uses a community-standard multi-skill layout:

```text
skills/<skill-name>/
  SKILL.md
  agents/openai.yaml
  references/
  scripts/
  assets/
```

It currently ships one skill:

- `skills/roxis-way/`: Roxi's collaboration, implementation, testing, language, and delivery rules.

## Repository Layout

```text
.
├── LICENSE
├── README.md
└── skills
    └── roxis-way
        ├── SKILL.md
        └── agents
            └── openai.yaml
```

## Install

Clone this repository and copy or sync `skills/roxis-way/` into the target tool's local skills directory.

Example destinations:

- Codex-style local skills directory
- Claude Code local skills directory
- Any compatible skill loader that reads a folder containing `SKILL.md`

## Included Skill

`roxis-way` defines defaults for:

- Collaboration language
- Planning artifact placement
- Commit and PR constraints
- Product language defaults
- Frontend coding style
- Comment language
- Third-party package installation preference
- Delivery verification expectations

## License

Apache-2.0
