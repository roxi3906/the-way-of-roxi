# The Way of Roxi

`the-way-of-roxi` is a reusable skill repository for user-configured software delivery conventions.

## Quick Install

Install every skill for the 14 primary supported agents:

```bash
npx skills add roxi3906/the-way-of-roxi --skill '*' --agent codex claude-code cursor gemini-cli github-copilot opencode amp cline goose kiro-cli kimi-code-cli qwen-code roo windsurf --copy -y
```

`--copy` is intentional for the mixed shared and agent-native catalog roots. It ensures one multi-agent install populates every documented project directory.

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

It currently ships four skills:

- `skills/auto-develop/`: Explicitly invoked autonomous delivery with project-management phase synchronization, implementation, deep review, recommended fixes, a draft PR, and a traceable decision tree.
- `skills/roxis-way/`: Reusable collaboration, implementation, testing, language, and delivery rules for any user.
- `skills/tapd-sync/`: Session-aware TAPD work-item matching, binding, parent phase progress, selective child creation, and evidence-driven completion.
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
| Amp | `.agents/skills` | Loads matching skills on demand; use `/skill-name` explicitly when needed |
| Cline | `.agents/skills` | Uses enabled skill descriptions for matching; name the skill explicitly when needed |
| Goose | `.goose/skills` | Loads matching skills automatically; use `/skills skill-name` explicitly |
| Kiro CLI | `.kiro/skills` | Activates matching skills automatically; use `/skill-name` explicitly |
| Kimi Code CLI | `.agents/skills` | May activate from the description; use `/skill:skill-name` to select explicitly |
| Qwen Code | `.qwen/skills` | Invokes matching skills through the model; use `/skill-name` explicitly |
| Roo Code | `.roo/skills` | Loads matching skills on demand; name the skill explicitly when needed |
| Windsurf | `.windsurf/skills` | Activates matching skills from their descriptions; name the skill explicitly when needed |

Automatic selection is a model decision, so successful installation cannot guarantee implicit activation for every prompt. The descriptions intentionally front-load common English and Chinese trigger phrases. For deterministic use, explicitly say `Use the roxis-way skill ...`, `Use the tapd-sync skill ...`, or invoke the agent-specific command shown above. `auto-develop` and `tapd-summary` are deliberately explicit-only, so ordinary development, review, summary, or report requests do not activate them.

Invoke `auto-develop` through the host Skill picker or its tested explicit form:

- Codex: `$auto-develop`
- Amp, Claude Code, Cursor, GitHub Copilot, Kiro CLI, OpenCode, and Qwen Code: `/auto-develop`
- Goose: `/skills auto-develop`
- Kimi Code CLI: `/skill:auto-develop`
- Cline, Gemini CLI, Roo Code, and Windsurf: `Use the auto-develop skill for this request.`

The canonical Skill combines a portable `invocation/manual-only: "true"` metadata contract, the native `disable-model-invocation: true` frontmatter control, OpenCode's `opencode/autoinvoke: "false"`, Codex's `allow_implicit_invocation: false`, and an in-Skill invocation gate. Codex, OpenCode, Claude Code, and Kimi Code CLI enforce their native controls before loading the Skill. Other hosts rely on explicit invocation plus the portable runtime gate.

The explicit invocation activates `auto-develop` for the rest of that session. Every later message follows the Skill without repeating the invocation, including new repository deliveries requested after an earlier draft PR completes. The activation ends only with the session, never carries into a new session, and keeps each delivery limited to the task requested by its current user message.

For each delivery, `auto-develop` synchronizes preparation, technical research, solution design, implementation, verification, code review, and closeout through the user's configured project-management integration. The bound parent records the complete lifecycle. Child work items are reserved for independently acceptable outcomes, so routine internal phases do not create tracking noise.

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
    ├── auto-develop
    │   ├── SKILL.md
    │   ├── agents
    │   │   └── openai.yaml
    │   └── references
    │       └── execution-report.md
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
npx skills add roxi3906/the-way-of-roxi --skill roxis-way --agent codex claude-code cursor gemini-cli github-copilot opencode amp cline goose kiro-cli kimi-code-cli qwen-code roo windsurf --copy -y
```

Replace `roxis-way` with `auto-develop`, `tapd-sync`, or `tapd-summary` as needed. Inspect all available skills with:

```bash
npx skills add roxi3906/the-way-of-roxi --list
```

## Included Skills

`auto-develop` performs an explicitly authorized autonomous delivery:

- Runs only when selected through the host's Skill UI, invocation syntax, or a direct instruction to use the Skill
- Stays active for every later message in the same session without repeated invocation
- Treats activation plus each current request as task-scoped authorization for a dedicated worktree, commits, branch push, and a draft PR
- Selects the first available source branch in `develop`, `dev/main`, `main`, `master` order and preserves it as the PR target
- Reuses configured workflows, task synchronization, and progress monitoring; a unique match at or above 90% can be bound automatically
- Makes recommended low-risk decisions while pausing only for indispensable user actions or material risk
- Deeply reviews the completed diff, fixes every actionable in-scope recommendation, revalidates, and re-reviews
- Stores every material decision in a fixed-shape object inside `{task-summary}-decision-tree.json`, then locates that object by its immutable ID for later updates
- Restores the durable ledger before acting in a resumed or context-restored session
- Reports the verified delivery with the private JSON decision-tree path and a complete tree rendered in the current session language
- Reminds the user that local worktree and branch cleanup can be requested after merge; cleanup is outside this Skill

`roxis-way` defines defaults for:

- Collaboration language
- Context-aware language selection for each output destination
- Planning artifact placement
- Git conventions and PR authorization
- Post-merge cleanup approval, bound project-management work-item transitions, and scope limits
- Product language selection
- Frontend coding style
- Comment language
- Third-party package installation preference
- Delivery verification expectations

`tapd-sync` coordinates TAPD tracking across a work session:

- Activates for the first substantive request even when the user does not mention TAPD, and later only for an explicit parent request or an existing binding; requests delegated to `tapd-summary` remain excluded
- Runs one read-only TAPD match before the first substantive final answer and lightly recommends a parent binding there
- Suspends all later TAPD checks, prompts, child handling, and footers when the first exchange ends unbound without explicit parent intent
- Reactivates only when the user later selects the first recommendation or explicitly requests parent binding or creation
- Adapts by runtime capability to an installed TAPD skill, authenticated CLI, or environment configuration
- Ranks up to three matching open work items at session start
- Binds the session only after user confirmation
- Creates valuable follow-up work without repeated TAPD business confirmation while respecting host runtime permissions
- Records bound delivery phases on the parent through verified configured fields or activity entries, including ordered backfill after a late or restored binding
- Creates phase children only for independently acceptable outcomes; routine stages remain parent progress
- Completes code-bearing children only when covered by successful commits, and non-code phase children only from durable accepted evidence
- Allows a workflow-defined direct initial-to-terminal transition; completing the bound parent additionally requires scoped direct, whole-tree, reviewed-plan, or task-cleanup authorization from the user
- After binding, ends applicable final answers with links to the bound parent and relevant children
- Keeps one TAPD write owner across primary, forked, and compacted contexts
- Keeps the original task moving when TAPD is unavailable

`tapd-summary` produces manual, read-only TAPD summaries:

- Runs only when explicitly invoked as `$tapd-summary` or selected by name
- Reads every configured workspace and relevant work-item model without mutating TAPD
- Separates TAPD workspace containers from project-name evidence
- Combines target-day current-user creation and verified completion events with current-user-owned nonterminal work from any creation date
- Carries current-user-owned nonterminal work into both the daily summary and live next-day plan while retaining unfinished target-day-created work
- Returns compact unordered lists grouped by project with title-only work items

## Maintainer Verification

Use Node.js 22.20.0 or newer, install the locked development dependencies, then run the full verification entrypoint:

```bash
npm install
npm run verify
```

`npm test` validates structured metadata, host invocation profiles, positive and negative trigger contracts, manual-only controls, per-agent installations for all 14 supported agents, and the combined `--copy` quick-install path across every documented catalog root. Installation verification parses each copied `auto-develop` bundle and requires the portable intent contract plus the `disable-model-invocation`, OpenCode, and Codex native controls to survive unchanged. `npm run verify:codex` additionally launches fresh, isolated, read-only Codex sessions for explicit and negative Auto Develop behavior, the repository workflow, TAPD Sync lifecycle, and explicit-only summary behavior. Single-turn cases remain ephemeral. The Auto Develop stateful case resumes one temporary session from a durable-ledger midpoint through a final report, a separate delivery, risk-gate pause and continuation, and an ordinary question; it then opens a fresh thread with an inherited parent summary and verifies that the earlier activation does not carry over. The TAPD Sync lifecycle case separately resumes one temporary session across the first match, a dormant reply, and candidate selection. Capable-adapter cases expose only a bundled read-only TAPD fixture and reject non-TAPD commands or write-like TAPD commands, while unavailable and negative cases reject all tool activity. The online smoke copies only the current `CODEX_HOME` authentication into an isolated temporary home, exposes no host credentials or live TAPD configuration to model tools, and fails clearly when Codex is not authenticated. Runtime activation behavior for other agents is documented from their product guidance; this repository verifies their locked CLI installation artifacts rather than launching authenticated sessions for every product.

## License

Apache-2.0
