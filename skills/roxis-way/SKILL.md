---
name: roxis-way
description: Use when working in a Roxi-owned repository or when a task must follow Roxi-specific rules for reply language, worktree authorization, private plan storage, commit and pull request authorization, branch naming, pull request target selection, product language defaults, code comment language, third-party integration choices, or delivery validation.
---

# Roxi's Way

Follow these rules for all work done for Roxi.

## Hard Rules

- When this skill applies, use Simplified Chinese for replies to Roxi.
- When work may create a plan or modify the repository, ask whether to use a git worktree before proceeding.
- Only create commits or pull requests after Roxi gives an explicit instruction for that exact action.
- Only move in-progress plans into tracked shared docs when Roxi explicitly asks for a shared or long-term document.
- When product-facing language is unspecified, default only user-facing product text to English.
- Before reporting completion, run the required e2e or closest substitute validation.

## Collaboration

Trigger: Apply this section when starting work, deciding next actions, or before any planning or repository modification.

- When replying to Roxi in this repository, communicate in Simplified Chinese.
- Prioritize functional implementation and verification over commit packaging, branch cleanup, or presentation work.
- When the task may require any planning artifact or any repository change, ask Roxi whether to use a git worktree before proceeding.
- Only create plans or modify code, config, tests, generated files, or any other repository content after Roxi explicitly authorizes the worktree decision or explicitly tells you not to use one.
- Unless Roxi explicitly asks for it, do not spend effort on commit planning, branch cleanup, or pull request packaging.

## Development Plan Storage

Trigger: Apply this section when creating or moving any in-progress plan, checklist, scratchpad, or temporary spec.

- When creating working development plans, implementation checklists, scratchpads, temporary specs, or other in-progress planning artifacts, store them under a project-level private directory by default.
- When choosing that private location, prefer a tool-specific directory under the project root: use `.codex/plans/` for Codex work, `.claude/plans/` for Claude Code work, and `.ai/plans/` only when no tool-specific directory is available.
- Keep those in-progress planning artifacts out of git. Only update `.gitignore` when needed to keep them untracked.
- Unless the project explicitly requires another language or Roxi explicitly asks for one, write development plans, task breakdowns, specs, and other planning documents in Chinese.
- Only move a plan into tracked `docs/`, `specs/`, or another shared location when Roxi explicitly asks for a shared, reviewable, or long-term document.

## Commit And PR Constraints

Trigger: Apply this section when committing, naming branches, force-adding ignored files, choosing a PR target, or preparing a pull request.

- Only create a commit when Roxi gives an explicit instruction to commit the current work. Do not treat phrases such as "wrap this up," "ship it," or other indirect wording as commit authorization.
- Only create a pull request when Roxi gives an explicit instruction to create a pull request. Do not infer pull request authorization from general completion requests.
- When Roxi explicitly asks to include an ignored file in a commit, force-add only that file, such as with `git add -f <file>`. Do not modify `.gitignore` unless Roxi explicitly asks to change ignore rules.
- When a new branch must be created and Roxi has not provided a branch name, include `roxi` in the branch name and use the format `<type>/roxi/<summary-branch-name>`, such as `feat/roxi/add-admin-login` or `fix/roxi/resolve-payment-timeout`.
- When Roxi explicitly requests a pull request, treat the current branch's source branch as the default merge target candidate before considering fixed fallback branches.
- Before proposing a pull request target, first inspect the current branch's upstream branch with `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}`.
- Only use `git merge-base --fork-point <candidate-branch> HEAD` when the upstream result is missing, ambiguous, or insufficient to confirm the source branch.
- Before creating the pull request, prepare the viable merge target branches and submit the recommended target together with the alternatives to Roxi for explicit selection and authorization.
- Only fall back to this target branch priority when the source branch cannot be determined reliably or does not exist: `dev/main`, `devlope`, `master`, `main`.
- Verify that Roxi's selected target branch exists before using it.

## Product Language Defaults

Trigger: Apply this section when writing UI copy or any user-facing product message and the project language is not already defined.

- When the project documentation does not define the language for UI copy or other user-facing product messages, default those messages to English.
- Apply that default only to end-user-visible text, including visible UI copy, form validation messages, toast messages, dialog text, API response messages exposed to users, and similar prompts.
- Do not apply this default to internal-only tooling, developer-facing output, logs, comments, or planning artifacts unless the task explicitly makes them user-facing.

## Frontend Code Style

Trigger: Apply this section when writing or editing frontend code.

- When writing or editing frontend code, prefer arrow functions unless a framework or library API clearly requires another function form.
- When writing lifecycle methods or hook bodies, keep them focused on orchestration rather than implementation details.
- Do not place large blocks of business logic directly inside lifecycle methods or hooks such as `useEffect`.
- When logic inside a lifecycle method or hook becomes non-trivial, extract it into named functions so the lifecycle method or hook mainly describes timing, dependencies, and control flow.

## Comment Style

Trigger: Apply this section when adding or substantially rewriting code in the current task.

- When you write code in the current task, add comments for the logical blocks you introduce or substantially rewrite.
- Only comment untouched existing code when Roxi explicitly asks for comment-only cleanup or the untouched code must be explained to make your new code understandable.
- When the logic is simple, keep the comment brief and focused on block responsibility or UI section purpose rather than line-by-line narration.
- When the logic involves tricky behavior, feature rules, implementation constraints, or important tradeoffs, add a more detailed comment that explains the non-obvious part.
- When the file's dominant existing comment language is clear, match that language.
- When the file has mixed or sparse comments, follow the nearest surrounding comment style when possible.
- Only default to Chinese when the file's existing comment language still cannot be determined.
- Do not add comments that only restate the code.

## Third-Party Packages And Component Libraries

Trigger: Apply this section when introducing or integrating a third-party package, library, registry item, or generated component.

- When introducing a third-party package or component library, prefer the official recommended installation or integration approach.
- Do not manually copy implementations when an official installation path, generator, CLI, registry, or documented setup flow is available.
- Only fall back to manual copy or custom in-project implementation when the official path is unavailable, incompatible, or clearly insufficient for the task, and state that reason briefly when doing so.

## Delivery Workflow

Trigger: Apply this section when development work is complete or when Roxi explicitly asks for a `docker compose` build.

- When development work is complete, run the project's e2e tests before reporting completion.
- If the project has no e2e test setup, use the closest available end-to-end or integration validation path and state that substitution in the report.
- If e2e or substitute validation fails, investigate the issue, implement fixes, and rerun the relevant validation before reporting back.
- Only report completion to Roxi after the required validation passes, or after a concrete blocker has been isolated and explained clearly.
- Only start the following Docker Compose workflow when Roxi explicitly asks to build with `docker compose` or Compose.
- Step 1: Search the repository for available Compose file paths and present all viable options to Roxi for explicit selection.
- Step 2: Only after Roxi selects the Compose file, ask which `service` entries should be built.
- Step 3: Only after the target `service` entries are confirmed, review the `.env`-managed environment variables used by those services and ask Roxi whether any values need to be changed before the build.
- Step 4: Before starting the build, ask Roxi whether the build should use cache.
- Step 5: Do not start the build until the Compose file, target services, required environment variable changes, and cache preference are all confirmed.
- Step 6: Before rebuilding the selected services, remove the existing images for those services and then run a clean build from scratch according to Roxi's cache preference.
- Step 7: After the build completes, present the container or service network access addresses for the built services.
