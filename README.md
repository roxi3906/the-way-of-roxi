# The Way of Roxi

`the-way-of-roxi` is a skill repository for Roxi's software delivery conventions.

## Quick Install

Install the current published skill directly from GitHub:

```bash
npx skills add roxi3906/the-way-of-roxi --skill roxis-way
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

Install from GitHub with the `skills` CLI:

```bash
npx skills add roxi3906/the-way-of-roxi --skill roxis-way
```

If this repository grows to include more skills, install a specific one with `--skill <skill-name>` or inspect available skills with:

```bash
npx skills add roxi3906/the-way-of-roxi --list
```

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
