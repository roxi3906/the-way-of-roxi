---
name: roxis-way
description: Apply Roxi's repository workflow automatically across supported host agents to every repository, repo, codebase, and software-project task. Use for coding, implementation, fixes, debugging, refactoring, reviews, research, design, planning, testing, documentation, UI copy, Git or pull-request work, delivery, and any project artifact or developer-facing reply. Enforce per-destination language selection, workspace and validation choices, private plans, Git and PR rules, cleanup approval, frontend and comment style, third-party integrations, and completion verification. Do not use for casual conversation, simple translations, time queries, or requests unrelated to a repository.
---

# Roxi's Way

Follow these rules for all work done for the user.

## Apply Across Agent Runtimes

- Apply the same workflow in every supported host runtime and use the host's actual tools, permissions, and task terminology.
- Do not depend on a product-specific invocation prefix. Allow implicit activation from the skill description, and accept the explicit skill syntax supported by the current host agent when the user selects this skill directly.
- Keep host-specific commands and installation paths out of this workflow; use the repository compatibility contract for those mappings.

## Hard Rules

- When this skill applies, use Simplified Chinese for replies to the user.
- Inspect every output destination before writing or revising it, then apply Output Language Selection; make this decision for each output independently, even when one task produces multiple artifacts.
- Never use the current conversation language as the primary language evidence for a non-conversational output.
- When work may create a plan, modify the repository, or require completion validation, ask the user to choose the workspace and validation strategy with numbered quick-reply lists before starting task execution.
- Before asking the user to choose the workspace strategy, check whether local branches or git worktree branches already match the task and present any matches as ranked options.
- Only create pull requests after the user gives an explicit instruction for that exact action.
- Before cleanup after a pull request or feature has been merged, prepare a cleanup plan that lists the development contents and confirmed bound project-management work items involved, plus the exact cleanup script or commands, then submit them to the user for review before execution.
- During post-merge delivery cleanup, only touch items and run commands that were included in the user's reviewed cleanup plan.
- Only move in-progress plans into tracked shared docs when the user explicitly asks for a shared or long-term document.
- For product-facing text, use the destination's established language and only fall back to English when no applicable local evidence exists.
- Before reporting completion, run the selected e2e or closest substitute validation; if the user selected "Other" for validation without details, choose the coverage scope based on risk and state that choice.

## Output Language Selection

Trigger: Apply before creating or revising any reply, code comment, pull request title or body, plan, checklist, spec, architecture document, development proposal, data-analysis result, UI copy, developer-facing message, or other artifact.

- Do not write or revise the output until its language has been selected.
- For each output or independently governed part of an output, choose the language in this order and stop at the first decisive source:
  1. Follow the user's explicit language instruction for that specific output.
  2. Follow binding rules or templates that govern the output destination, such as repository instructions, contribution guides, document templates, or platform requirements.
  3. Use the dominant language of the same content type at the exact output destination.
  4. If local evidence is insufficient, expand outward to the nearest relevant scope and inspect the same content type there.
  5. If no clear precedent exists, use the fallback for that output type.
- Prefer evidence that is closer to the destination, more similar in content type, and more recent. Do not let a broad repository pattern override a clear pattern at the actual destination.
- Decide the language for each output independently. Files produced by the same task may use different languages when their destinations differ.
- Evaluate independently governed parts separately. In particular, evaluate a PR title and body separately because a repository may use different language conventions for each.
- When evidence is sparse or mixed, inspect additional nearby examples before using a fallback; do not call a language dominant without a clear pattern.
- The current conversation language may govern direct replies under Collaboration, but it is not primary evidence for repository artifacts or other non-conversational outputs.
- Use these artifact-specific contexts and fallbacks:
  - For code comments, inspect the target file first, then nearby comments and similar files; if no pattern is clear, use Simplified Chinese.
  - For plans, specs, architecture documents, development proposals, and data-analysis results, inspect same-type documents in the target directory first, then the nearest related documentation scope; if no pattern is clear, use Simplified Chinese.
  - For pull requests, inspect recent comparable PRs in the target repository and assess the PR title and body separately; if no pattern is clear, use an English conventional-commit title and a Simplified Chinese body.
  - For product-facing text, inspect project language rules and nearby product copy; if no pattern is clear, use English.
  - For other project artifacts, inspect same-type outputs at the destination, then the project's dominant developer-facing language; if no pattern is clear, use Simplified Chinese.

## Collaboration

Trigger: Apply this section when starting work, deciding next actions, before task execution, before choosing workspace strategy, before choosing validation strategy, or before any planning or repository modification.

- When replying to the user in this repository, communicate in Simplified Chinese.
- Prioritize functional implementation and verification over commit packaging, branch cleanup, or presentation work.
- Before asking the user to choose a workspace strategy, inspect local branches and branches already checked out in git worktrees. Compare those branch names with the user's task description using concrete identifiers from the request, such as feature names, bug IDs, ticket numbers, product areas, module names, and meaningful keywords.
- When the user's task describes a pull request, PR URL, PR number, or PR conflict resolution, inspect the PR metadata before ranking workspace candidates. Use the PR head branch as the strongest match key, the base branch as required conflict context, and the PR title or description as secondary keywords. If the head branch exists in a local branch or git worktree, rank that exact match first. If the head branch only exists as a remote-tracking branch, present it as a candidate that would require creating or checking out a local workspace. If the PR comes from a fork, present the fork owner and head ref and state that fetching the fork branch may be required before work can start.
- If any local branch or git worktree branch plausibly matches the user's task, include those candidates in the workspace strategy prompt before the standard generic options. Sort them from highest to lowest relevance, and show enough context for each candidate to choose confidently: branch name, whether it is in the current workspace or another git worktree, and the worktree path when applicable.
- Do not automatically switch to, reuse, create from, or modify a matched branch. Present the ranked candidates as numbered choices and wait for the user's explicit selection or a described alternative.
- When the task may require any planning artifact, repository change, implementation, fix, refactor, behavior change, test change, or other development work, stop before planning, editing, or task execution and ask the user to choose the required start strategies with numbered quick-reply lists.
- The workspace strategy prompt MUST be easy to answer with one number and MUST include an "Other" option. When no task-matching branch candidates exist, use these standard options:
  1. Use a git worktree: isolate the task in a separate checkout so unrelated current-workspace changes stay untouched.
  2. Create a separate branch in the current workspace: keep the same directory, but separate the task history from the current branch.
  3. Continue on the current branch without a git worktree: use the existing branch and workspace for the task.
  4. Other: describe the preferred workspace or branch strategy.
- When the task may require completion validation, the start prompt MUST also ask the user to choose the e2e or substitute validation coverage before execution begins. The coverage prompt MUST be easy to answer with one number, MUST use this order, and MUST include an "Other" option:
  1. Directly related functional tests: validate business behavior directly touched by the change, component wrappers/usages/importers directly connected to the changed code, and direct logic or data-flow paths.
  2. Indirectly related functional tests: also validate derived data, derived state, downstream display, or behavior that depends on the changed paths.
  3. Full test suite: run the full available e2e or closest substitute validation suite.
  4. Other: describe the desired test scope or command; if the user selects this without providing details, choose the coverage scope based on implementation risk and explain the choice before running validation.
- Only create plans or modify code, config, tests, generated files, or any other repository content after the user explicitly selects or describes the required start strategies.
- Unless the user explicitly asks for it, do not spend effort on commit planning, branch cleanup, or pull request packaging.

## Development Plan Storage

Trigger: Apply this section when creating or moving any in-progress plan, checklist, scratchpad, or temporary spec.

- When creating working development plans, implementation checklists, scratchpads, temporary specs, or other in-progress planning artifacts, store them under a project-level private directory by default.
- When an in-progress planning artifact already exists outside that project-level private directory, move it into the appropriate private plans directory before continuing to update it.
- When choosing that private location, prefer a tool-specific directory under the project root: use `.codex/plans/` for Codex work, `.claude/plans/` for Claude Code work, and `.ai/plans/` only when no tool-specific directory is available.
- Name each in-progress plan file with the current date and a concise summary of the planned changes, such as `YYYY-MM-DD-update-payment-retry-plan.md`.
- When an in-progress plan changes materially, rename the file so its date and summary still match the latest revision and planned changes.
- Keep those in-progress planning artifacts out of git. Only update `.gitignore` when needed to keep them untracked.
- Select the language of every development plan, task breakdown, spec, or other planning document through Output Language Selection. Inspect same-type artifacts in the target private directory first, then the nearest project planning or documentation scope; use Simplified Chinese only when no clear precedent exists.
- Only move a plan into tracked `docs/`, `specs/`, or another shared location when the user explicitly asks for a shared, reviewable, or long-term document.

## Git And PR Conventions

Trigger: Apply this section when committing, naming branches, force-adding ignored files, choosing a PR target, drafting a PR title or body, or preparing a pull request.

- Only create a pull request when the user gives an explicit instruction to create a pull request. Do not infer pull request authorization from general completion requests.
- When the user explicitly asks to include an ignored file in a commit, force-add only that file, such as with `git add -f <file>`. Do not modify `.gitignore` unless the user explicitly asks to change ignore rules.
- When a new branch must be created and the user has not provided a branch name, include `user` in the branch name and use the format `<type>/user/<summary-branch-name>`, such as `feat/user/add-admin-login` or `fix/user/resolve-payment-timeout`.
- When the user explicitly requests a pull request, treat the current branch's source branch as the default merge target candidate before considering fixed fallback branches.
- Before proposing a pull request target, first inspect the current branch's upstream branch with `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}`.
- Only use `git merge-base --fork-point <candidate-branch> HEAD` when the upstream result is missing, ambiguous, or insufficient to confirm the source branch.
- Before creating the pull request, prepare the viable merge target branches and submit the recommended target together with the alternatives to the user for explicit selection and authorization.
- Only fall back to this target branch priority when the source branch cannot be determined reliably or does not exist: `dev/main`, `devlope`, `master`, `main`.
- Verify that the user's selected target branch exists before using it.
- Before drafting pull request content, inspect recent comparable pull requests in the target repository and select the language for the PR title and body separately through Output Language Selection.
- Preserve any repository-required pull request title format. When no clear local language precedent exists, use an English conventional commit title such as `feat: add admin login` or `fix: resolve payment timeout`.
- When no clear local language precedent exists for the pull request body, use Simplified Chinese.
- Structure the pull request body with standard sections equivalent to Summary, Highlights, Impact, Test Results, and Potential Issues. Write the headings in the selected body language and match established repository wording when available.
- In the summary section, describe the change as functional outcomes or business-facing behavior rather than a plain code-file or implementation checklist.
- Use the highlights section only for concise product-facing changes introduced by the PR. Each bullet must describe changed user or product behavior, entry points, naming, URLs, discoverability, compatibility, business capability, data behavior, integrations, or operationally relevant outcomes.
- Do not include unchanged existing functionality, tests, builds, lint, validation, file moves, component names, internal refactors, config edits, or implementation mechanics in the highlights section; place those in test results, impact, or potential issues when relevant.
- For merge or release pull requests, write highlight bullets about the product changes being released, not merge mechanics, source branches, target branches, commit plumbing, or repository synchronization.
- If a technical change has no direct product-facing effect, omit it from the highlights section unless it affects compatibility, discoverability, user access, data behavior, integrations, or operations.
- Avoid highlight bullets that merely say a page or flow continues to support existing content or behavior. Preserve unchanged scope in the impact section when needed.
- Include an impact section that explains affected user flows, business paths, modules, data or state flows, integrations, and operational concerns when applicable.
- If related pull requests exist, include them in a separate related pull requests section, written in the selected body language, with each pull request's title or purpose and link.
- Automatically identify and mention relevant authors from commits, PR metadata, or changed work when that information is available.
- Associate relevant assignees with the pull request when assignee information is available.
- Include a separate authors section at the bottom of the pull request body, with its heading written in the selected body language.

## Post-Merge Cleanup Constraints

Trigger: Apply this section when cleaning up after a pull request or completed feature has been merged, including deleting branches, removing worktrees, pruning local files, deleting temporary artifacts, archiving or renaming related threads, transitioning bound project-management work items, or running any cleanup script for that delivery.

- Before cleanup, prepare a cleanup plan for the user's review. The plan MUST list the delivery contents that make cleanup relevant, including the PR identifier or branch when available, local branches, worktrees, temporary planning artifacts, generated files, scripts, commands, repository files that the delivery created, modified, or used, and every confirmed project-management work item bound to that delivery.
- Determine bound work items from existing session or delivery binding records, PR metadata, task artifacts, or explicit user context. Do not discover or infer a new binding merely because an unbound item looks related during cleanup.
- For each bound work item, list its platform, stable identifier or link, current status, proposed action and target status, and the exact read and mutation commands or platform operations. If the item is nonterminal and the user gives no different requirement, default the proposed action to transition it to a successful terminal state resolved from that project's current workflow and the item's work-item type. Never assume a status label such as `Done` or `已完成` is universally terminal.
- A user's cleanup-specific requirement for a bound work item overrides the default terminal transition. Reflect the requested status or action in the reviewed plan before performing it.
- If the platform or required workflow metadata is unavailable, mark the work item as leave untouched with the reason, do not claim it was cleaned up, and continue with other independent items already covered by the reviewed plan.
- Include the exact cleanup script or command sequence with the cleanup plan, and wait for the user's explicit approval before executing it.
- The cleanup plan MUST identify each item as delete, keep, archive, move, transition, or leave untouched, and explain why that action belongs to this delivery's cleanup.
- During cleanup, only act on items and commands included in the reviewed cleanup plan. Do not delete, move, reset, prune, archive, transition, or otherwise modify any branch, worktree, file, thread, automation, project-management work item, or artifact outside the approved plan.
- If cleanup reveals new items or requires different commands, stop and submit an updated cleanup plan and script for the user's review before continuing.
- After cleanup, report which planned items were completed and any approved items left unchanged. Read back every attempted project-management transition. Report its final status as verified only when that read-back succeeds; otherwise report the final status as unverified without treating other successful cleanup actions as evidence that the transition succeeded.

## Product Language

Trigger: Apply this section when writing UI copy or any user-facing product message.

- Select the language through Output Language Selection. Inspect project language rules and nearby product copy before writing; use English only when no clear local precedent exists.
- Apply this section only to end-user-visible text, including visible UI copy, form validation messages, toast messages, dialog text, API response messages exposed to users, and similar prompts.
- Do not apply this section to internal-only tooling, developer-facing output, logs, comments, or planning artifacts unless the task explicitly makes them user-facing.

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
- Only comment untouched existing code when the user explicitly asks for comment-only cleanup or the untouched code must be explained to make your new code understandable.
- When the logic is simple, keep the comment brief and focused on block responsibility or UI section purpose rather than line-by-line narration.
- When the logic involves tricky behavior, feature rules, implementation constraints, or important tradeoffs, add a more detailed comment that explains the non-obvious part.
- Select comment language through Output Language Selection. Match the target file's dominant existing comment language when it is clear.
- When the target file has mixed or sparse comments, inspect the nearest surrounding comments and then similar nearby files.
- Use Simplified Chinese only when no clear comment-language precedent exists after that inspection.
- Do not add comments that only restate the code.

## Third-Party Packages And Component Libraries

Trigger: Apply this section when introducing or integrating a third-party package, library, registry item, or generated component.

- When introducing a third-party package or component library, prefer the official recommended installation or integration approach.
- Do not manually copy implementations when an official installation path, generator, CLI, registry, or documented setup flow is available.
- Only fall back to manual copy or custom in-project implementation when the official path is unavailable, incompatible, or clearly insufficient for the task, and state that reason briefly when doing so.

## Delivery Workflow

Trigger: Apply this section when development work is complete, after any implementation/fix/refactor step is ready for validation, before running the initially selected e2e or substitute validation scope, or when the user explicitly asks for a `docker compose` build.

- Unit tests are usually fast; when relevant unit tests exist, run the directly relevant unit tests without asking the user to choose a scope first.
- Before running e2e tests or the closest substitute validation, summarize what was completed in the immediately preceding development step and state the validation scope selected at task start.
- The pre-validation summary MUST mention changed user behavior, affected business paths, changed components or modules, and important direct data or state flow changes when applicable.
- Do not ask the user to choose the e2e or substitute validation coverage again unless no start-of-task scope exists or the implementation materially broadened the risk beyond the selected scope.
- When development work is complete, run the initially selected e2e tests or closest substitute validation before reporting completion.
- If the project has no e2e test setup, use the closest available end-to-end or integration validation path and state that substitution in the report.
- If e2e or substitute validation fails, investigate the issue, implement fixes, and rerun the relevant validation before reporting back.
- Only report completion to the user after the required validation passes, or after a concrete blocker has been isolated and explained clearly.
- Only start the following Docker Compose workflow when the user explicitly asks to build with `docker compose` or Compose.
- Step 1: Search the repository for available Compose file paths and present all viable options to the user for explicit selection.
- Step 2: Only after the user selects the Compose file, ask which `service` entries should be built.
- Step 3: Only after the target `service` entries are confirmed, review the `.env`-managed environment variables used by those services and ask the user whether any values need to be changed before the build.
- Step 4: Before starting the build, ask the user whether the build should use cache.
- Step 5: Do not start the build until the Compose file, target services, required environment variable changes, and cache preference are all confirmed.
- Step 6: Before rebuilding the selected services, remove the existing images for those services and then run a clean build from scratch according to the user's cache preference.
- Step 7: After the build completes, present the container or service network access addresses for the built services.
