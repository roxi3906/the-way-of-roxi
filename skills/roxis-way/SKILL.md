---
name: roxis-way
description: Defines Roxi's working style for software development tasks. Use when working in Roxi-owned projects or when Codex needs to follow Roxi's rules for collaboration language, implementation focus, third-party package installation preference, commit and pull request restrictions, PR target branch priority, default product language, code comment language, and post-task e2e validation.
---

# Roxi's Way

Follow these rules for all work done for Roxi.

## Collaboration

- Communicate with Roxi in Simplified Chinese.
- Focus on functional implementation and verification.
- Before creating a development plan or making code changes, ask Roxi whether to use a git worktree for the task. Do not proceed with plan creation or code modification until Roxi gives explicit authorization.
- Do not spend effort on commit planning, branch cleanup, or pull request packaging unless Roxi explicitly asks for it.

## Development Plan Storage

- Store working development plans, implementation checklists, scratchpads, and other in-progress planning artifacts under a project-level private directory by default.
- Prefer a tool-specific private directory under the project root for these files so they remain under that project-level private directory. Use `.codex/plans/` for Codex work, `.claude/plans/` for Claude Code work, and `.ai/plans/` as a fallback when no tool-specific directory is available.
- Keep these planning artifacts out of git. Add the relevant private directory or file pattern to `.gitignore` when needed.
- Write development plans, task breakdowns, specs, and other planning documents in Chinese by default unless the project explicitly requires another language or Roxi explicitly asks for one.
- Only move a plan into a tracked `docs/`, `specs/`, or similar shared location when Roxi explicitly asks for a shared, reviewable, or long-term document.

## Commit And PR Constraints

- Do not create commits unless Roxi gives an explicit and specific instruction.
- Do not create pull requests unless Roxi gives an explicit and specific instruction.
- If a test file is ignored by git but Roxi explicitly wants it included in a commit, stage that specific file with a one-off forced add such as `git add -f <file>` instead of modifying `.gitignore`.
- When creating a branch, include `roxi` in the branch name and use the format `<type>/roxi/<summary-branch-name>`, such as `feat/roxi/add-admin-login` or `fix/roxi/resolve-payment-timeout`. The summary branch name should concisely describe the change, new functionality, purpose, or implementation approach.
- If Roxi explicitly requests a pull request, treat the default target branch as the current branch's source branch rather than choosing a fixed default branch immediately.
- Check the likely source branch before creating the pull request. Use `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` to inspect the current branch's upstream branch, and use `git merge-base --fork-point <candidate-branch> HEAD` when needed to verify a likely source branch.
- Before creating the pull request, prepare the viable merge target branches and submit the recommended target together with the alternatives to Roxi for explicit selection and authorization.
- If the source branch cannot be determined reliably or is unavailable, fall back to this target branch priority: `dev/main`, `devlope`, `master`, `main`.
- Verify that the selected target branch exists before using it.

## Product Language Defaults

- If the project documentation does not define the UI language or the language for frontend and backend user-facing messages, default to English.
- Apply this default to visible UI copy, form validation messages, toast messages, dialog text, API response messages exposed to users, and other end-user prompts.

## Frontend Code Style

- Prefer arrow functions for frontend code unless a framework or library API clearly requires another function form.
- Keep lifecycle methods and hook bodies focused on orchestration rather than implementation details.
- Do not place large blocks of business logic directly inside lifecycle methods or hooks such as `useEffect`.
- Extract non-trivial logic into named functions so lifecycle methods and hooks primarily describe timing, dependencies, and control flow.

## Comment Style

- Add comments for the code written in the current task. Do not treat adding or rewriting comments for untouched existing code as a default requirement.
- Add comments for each logical block you write.
- Use simple comments for simple logic such as module declarations or page-level functional blocks in TSX files. Keep those comments brief and focused on block responsibility or UI section purpose, not line-by-line narration.
- Use more detailed comments for complex feature logic, tricky implementation details, or important design tradeoffs.
- Match the comment language to the dominant existing comment language in the file when it is clear. If the file has mixed or sparse comments, follow the nearest surrounding comment style when possible.
- If the file's existing comment language still cannot be determined, default to Chinese.
- Avoid comments that only restate the code.

## Third-Party Packages And Component Libraries

- When using third-party packages or component libraries, prefer the official recommended installation or integration approach.
- Avoid manually copying implementations when an official installation path, generator, CLI, registry, or documented setup flow is available.
- Only fall back to manual copy or custom in-project implementation when the official path is unavailable, incompatible, or clearly insufficient for the task. State that reason briefly when doing so.

## Delivery Workflow

- After completing development, run the project's e2e tests.
- If e2e tests fail, investigate the issue, implement fixes, and rerun the tests before reporting back.
- Report completion to Roxi only after the e2e checks pass, or after a concrete blocker has been isolated and explained clearly.
- If the project has no e2e test setup, use the closest available end-to-end or integration validation path and state that choice in the report.
