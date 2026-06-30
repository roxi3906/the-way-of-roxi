---
name: roxis-way
description: Use when working in a Roxi-owned repository or when a task must follow Roxi-specific rules for reply language, worktree authorization, private plan storage, commit and pull request authorization, branch naming, pull request target selection, pull request title or body drafting, product language defaults, code comment triggers, code comment language, third-party integration choices, or delivery validation.
---

# Roxi's Way

Follow these rules for all work done for Roxi.

## Hard Rules

- When this skill applies, use Simplified Chinese for replies to Roxi.
- When work may create a plan, modify the repository, or require completion validation, ask Roxi to choose the workspace and validation strategy with numbered quick-reply lists before starting task execution.
- Before asking Roxi to choose the workspace strategy, check whether local branches or git worktree branches already match the task and present any matches as ranked options.
- Only create commits or pull requests after Roxi gives an explicit instruction for that exact action.
- Only move in-progress plans into tracked shared docs when Roxi explicitly asks for a shared or long-term document.
- When product-facing language is unspecified, default only user-facing product text to English.
- Before reporting completion, run the selected e2e or closest substitute validation; if Roxi selected "Other" for validation without details, choose the coverage scope based on risk and state that choice.

## Collaboration

Trigger: Apply this section when starting work, deciding next actions, before task execution, before choosing workspace strategy, before choosing validation strategy, or before any planning or repository modification.

- When replying to Roxi in this repository, communicate in Simplified Chinese.
- Prioritize functional implementation and verification over commit packaging, branch cleanup, or presentation work.
- Before asking Roxi to choose a workspace strategy, inspect local branches and branches already checked out in git worktrees. Compare those branch names with Roxi's task description using concrete identifiers from the request, such as feature names, bug IDs, ticket numbers, product areas, module names, and meaningful keywords.
- When Roxi's task describes a pull request, PR URL, PR number, or PR conflict resolution, inspect the PR metadata before ranking workspace candidates. Use the PR head branch as the strongest match key, the base branch as required conflict context, and the PR title or description as secondary keywords. If the head branch exists in a local branch or git worktree, rank that exact match first. If the head branch only exists as a remote-tracking branch, present it as a candidate that would require creating or checking out a local workspace. If the PR comes from a fork, present the fork owner and head ref and state that fetching the fork branch may be required before work can start.
- If any local branch or git worktree branch plausibly matches Roxi's task, include those candidates in the workspace strategy prompt before the standard generic options. Sort them from highest to lowest relevance, and show enough context for each candidate to choose confidently: branch name, whether it is in the current workspace or another git worktree, and the worktree path when applicable.
- Do not automatically switch to, reuse, create from, or modify a matched branch. Present the ranked candidates as numbered choices and wait for Roxi's explicit selection or a described alternative.
- When the task may require any planning artifact, repository change, implementation, fix, refactor, behavior change, test change, or other development work, stop before planning, editing, or task execution and ask Roxi to choose the required start strategies with numbered quick-reply lists.
- The workspace strategy prompt MUST be easy to answer with one number and MUST include an "Other" option. When no task-matching branch candidates exist, use these standard options:
  1. Use a git worktree: isolate the task in a separate checkout so unrelated current-workspace changes stay untouched.
  2. Create a separate branch in the current workspace: keep the same directory, but separate the task history from the current branch.
  3. Continue on the current branch without a git worktree: use the existing branch and workspace for the task.
  4. Other: describe the preferred workspace or branch strategy.
- When the task may require completion validation, the start prompt MUST also ask Roxi to choose the e2e or substitute validation coverage before execution begins. The coverage prompt MUST be easy to answer with one number, MUST use this order, and MUST include an "Other" option:
  1. Directly related functional tests: validate business behavior directly touched by the change, component wrappers/usages/importers directly connected to the changed code, and direct logic or data-flow paths.
  2. Indirectly related functional tests: also validate derived data, derived state, downstream display, or behavior that depends on the changed paths.
  3. Full test suite: run the full available e2e or closest substitute validation suite.
  4. Other: describe the desired test scope or command; if Roxi selects this without providing details, choose the coverage scope based on implementation risk and explain the choice before running validation.
- Only create plans or modify code, config, tests, generated files, or any other repository content after Roxi explicitly selects or describes the required start strategies.
- Unless Roxi explicitly asks for it, do not spend effort on commit planning, branch cleanup, or pull request packaging.

## Development Plan Storage

Trigger: Apply this section when creating or moving any in-progress plan, checklist, scratchpad, or temporary spec.

- When creating working development plans, implementation checklists, scratchpads, temporary specs, or other in-progress planning artifacts, store them under a project-level private directory by default.
- When an in-progress planning artifact already exists outside that project-level private directory, move it into the appropriate private plans directory before continuing to update it.
- When choosing that private location, prefer a tool-specific directory under the project root: use `.codex/plans/` for Codex work, `.claude/plans/` for Claude Code work, and `.ai/plans/` only when no tool-specific directory is available.
- Name each in-progress plan file with the current date and a concise summary of the planned changes, such as `YYYY-MM-DD-update-payment-retry-plan.md`.
- When an in-progress plan changes materially, rename the file so its date and summary still match the latest revision and planned changes.
- Keep those in-progress planning artifacts out of git. Only update `.gitignore` when needed to keep them untracked.
- Unless the project explicitly requires another language or Roxi explicitly asks for one, write development plans, task breakdowns, specs, and other planning documents in Chinese.
- Only move a plan into tracked `docs/`, `specs/`, or another shared location when Roxi explicitly asks for a shared, reviewable, or long-term document.

## Commit And PR Constraints

Trigger: Apply this section when committing, naming branches, force-adding ignored files, choosing a PR target, drafting a PR title or body, or preparing a pull request.

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
- When drafting a pull request title, write it in English and use a standard conventional commit style, such as `feat: add admin login` or `fix: resolve payment timeout`.
- When drafting a pull request body, write it in Chinese unless Roxi explicitly requests another language.
- Structure the pull request body with standard sections for `总结`, `要点`, `影响范围`, `测试结果`, and `潜在问题`.
- In the summary section, describe the change as functional outcomes or business-facing behavior rather than a plain code-file or implementation checklist.
- Use the `要点` section only for concise product-facing changes introduced by the PR. Each bullet must describe changed user or product behavior, entry points, naming, URLs, discoverability, compatibility, business capability, data behavior, integrations, or operationally relevant outcomes.
- Do not include unchanged existing functionality, tests, builds, lint, validation, file moves, component names, internal refactors, config edits, or implementation mechanics in `要点`; place those in `测试结果`, `影响范围`, or `潜在问题` when relevant.
- For merge or release pull requests, write `要点` bullets about the product changes being released, not merge mechanics, source branches, target branches, commit plumbing, or repository synchronization.
- If a technical change has no direct product-facing effect, omit it from `要点` unless it affects compatibility, discoverability, user access, data behavior, integrations, or operations.
- Avoid `要点` bullets that merely say a page or flow continues to support existing content or behavior. Preserve unchanged scope in `影响范围` when needed.
- Include an `影响范围` section that explains affected user flows, business paths, modules, data or state flows, integrations, and operational concerns when applicable.
- If related pull requests exist, include them in a separate `关联 PR` section with each pull request's title or purpose and link.
- Automatically identify and mention relevant authors from commits, PR metadata, or changed work when that information is available.
- Associate relevant assignees with the pull request when assignee information is available.
- Include a separate `作者` section at the bottom of the pull request body.

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

Trigger: Apply this section when writing, editing, adding, or substantially rewriting code in the current task; when the task involves code comments, comment cleanup, comment language, readability, confusing code, or hard-to-read code; or when generating code snippets that are intended to be used in a repository.

- When you write code in the current task, add comments for the logical blocks you introduce or substantially rewrite.
- When writing code, add comments for important, easy-to-confuse, or hard-to-read code paths.
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

Trigger: Apply this section when development work is complete, after any implementation/fix/refactor step is ready for validation, before running the initially selected e2e or substitute validation scope, or when Roxi explicitly asks for a `docker compose` build.

- Unit tests are usually fast; when relevant unit tests exist, run the directly relevant unit tests without asking Roxi to choose a scope first.
- Before running e2e tests or the closest substitute validation, summarize what was completed in the immediately preceding development step and state the validation scope selected at task start.
- The pre-validation summary MUST mention changed user behavior, affected business paths, changed components or modules, and important direct data or state flow changes when applicable.
- Do not ask Roxi to choose the e2e or substitute validation coverage again unless no start-of-task scope exists or the implementation materially broadened the risk beyond the selected scope.
- When development work is complete, run the initially selected e2e tests or closest substitute validation before reporting completion.
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
