---
name: session-cleanup
description: Use for session cleanup after a pull request is merged, including 会话清理, PR 合并后清理, deleting the remote and local task branches, removing clean worktrees, archiving task documents, and reviewing development data. Verify merge and ownership evidence, produce a risk-tagged cleanup plan, and require explicit approval before mutation. Do not use for ordinary development, an open or merely closed PR, branch creation, committing, pushing, PR preparation, or general Git questions.
---

# Session Cleanup

Own the complete cleanup lifecycle for a merged delivery: read-only detection, a risk-tagged plan, explicit approval, exact execution, and read-back. Loading this Skill, a merged PR, a general cleanup request, delivery authorization, or a `tpad` marker does not approve mutations.

Maintain this skill's instructions and metadata in English. Communicate and render cleanup plans in the user's preferred language while preserving commands, paths, tags, identifiers, and branch names.

## Route And Scope

- Apply to cleanup of a delivery whose PR is confirmed merged, including its branches, worktrees, task-owned documents and development data, temporary services, threads, and confirmed bound project-management work items.
- Yield ordinary development, review, branch creation, commits, pushes, and PR preparation to the repository workflow. Do not turn an open, reopened, or merely closed PR into a cleanup candidate.
- Reuse the current delivery's established repository, PR, worktree, branch, ledger, and binding evidence. Do not infer a new project-management binding from a similar title, and do not start development-start interviews.
- Use only confirmed bindings from session or delivery records, PR metadata, task artifacts, or explicit user context. Include the `tapd-sync` parent and task-scoped children, including marker-authorized or suspended bindings. Never create or match a work item merely because cleanup is requested.
- If this delivery used `auto-develop`, stop only its task-owned report service through its documented status/stop commands when included in the approved plan. Never kill unrelated processes.

## Detect Before Planning

Detection is read-only. Do not fetch with prune, delete, move, transition, archive, or otherwise mutate during this phase.

### Delivery And Remote Branch

1. Read the PR from the hosting platform and verify `merged`, not just `closed`. Record the base repository and branch, head repository and branch, PR head SHA, merged SHA, and merge commit SHA when available. Stop branch and data cleanup if identity or merged state is unresolved.
2. Resolve the Git remote from the PR head repository and local branch upstream evidence; never assume `origin`. For a fork, the deletion target is the head repository, never the base repository.
3. Use a read-only remote query such as `git ls-remote --heads <remote> <branch>` and hosting metadata to compare the current head with the merged PR head. A branch that advanced after merge is `[BLOCKED]`; preserve all branch tips. An already absent branch is reported as already absent, without a deletion command.
4. Confirm the candidate is neither the default nor base branch and is not protected. If protection or repository identity cannot be resolved, mark remote deletion `[BLOCKED]`.

### Local Branch And Worktrees

1. Resolve the main repository root using `git worktree list --porcelain` and `git rev-parse --git-common-dir`; do not assume the current worktree is the main checkout.
2. Enumerate every worktree and branch using `git worktree list --porcelain`, `git branch -vv`, and `git status --porcelain=v1 --untracked-files=all --ignored=matching` in each candidate worktree. Record the current checkout and every other checkout of the task branch.
3. Inspect staged, unstaged, untracked, and ignored files. Classify only task-owned files with session, ledger, PR, or path evidence. Unknown or user-owned content stays untouched and blocks removal of its containing worktree.
4. Compare the local branch tip with the merged PR head. It is deletable only when its tip is the PR head or an ancestor of it, with no unmerged or unpushed commits. Use `git merge-base --is-ancestor <local-branch> <pr-head-sha>` plus the log and upstream evidence; a squash-merged PR does not make new post-PR commits safe.
5. Never delete a branch still checked out in a worktree. Plan clean worktree removal first, run later commands from the main repository root, and re-check occupancy before local branch deletion. Never substitute `git branch -D`, `git worktree remove --force`, or a force push for a failed safety check.

### Documents And Development Data

1. Inventory task-created or task-used plans, research, reports, decision ledgers, generated files, scripts, logs, caches, temporary databases, and other development artifacts. Distinguish durable documents and audit evidence from regenerable ephemeral data.
2. Leave product documentation, source files, and documents already tracked in the merged PR or base branch in place. Do not move the product's source of truth into a private archive.
3. Move task-private documents and durable audit evidence to `<main-repository-root>/.ai/session-archive/<delivery-id>/`, where the delivery ID uses safe components such as `pr-42-<short-merge-sha>`, never raw branch text or path traversal.
4. Before archiving, verify the destination is inside the main repository, `git check-ignore -q -- .ai/session-archive/<delivery-id>/` succeeds, and `git ls-files -- .ai/session-archive/` returns no tracked entries. If the archive is not ignored, include an exact approved addition of `/.ai/session-archive/` to the main repository's `.git/info/exclude`; do not edit tracked `.gitignore` without separate explicit authorization.
5. Check every source and destination. Never overwrite an existing archive file. A collision, unresolved ownership, tracked archive entry, or destination outside the main repository marks the move and all dependent core Git, worktree, and document cleanup `[BLOCKED]`.
6. Delete only task-owned, reproducible caches, logs, or temporary data explicitly covered by the plan. Preserve binding records, pending-transition evidence, non-reproducible data, credentials, and unknown files. Keep binding and audit evidence outside every worktree being removed until all required read-backs finish.

## Produce The Risk-Tagged Plan

Before any mutation, submit the complete plan and exact command sequence for explicit user approval. A previous general cleanup request is not approval of this plan.

List the PR identity and merge evidence, remote and local branches, every worktree, documents, development data, services, threads, and all confirmed bound work items. Every item MUST have:

- An action tag: `[DELETE]`, `[MOVE]`, `[KEEP]`, `[ARCHIVE]`, `[TRANSITION]`, or `[MODIFY]`.
- Exactly one risk tag: `[LOW]`, `[MEDIUM]`, or `[HIGH]`.
- `[BLOCKED]` when a safety gate fails, plus the evidence and resolution required to unblock it.
- Delivery-ownership evidence, the exact command or platform operation, and a recovery or rollback note. Use `Command: none` for an item that must not execute.

Use this shape:

```text
- [MOVE] [LOW] <task-document> -> <main-root>/.ai/session-archive/<delivery-id>/
  Evidence: <task-owned untracked document; destination absent and ignored>
  Command: <exact no-overwrite move command>
  Recovery: move the archived file back to its recorded source
- [DELETE] [MEDIUM] <remote>/<task-branch>
  Evidence: <merged PR head unchanged; non-base, non-default, non-protected head branch>
  Command: git push <remote> --delete <task-branch>
  Recovery: restore the recorded PR head SHA as a new branch if the hosting policy permits
```

Risk meanings:

- `[LOW]`: reversible archive moves with no overwrite, or deletion of verified task-owned reproducible temporary data.
- `[MEDIUM]`: verified clean worktree removal, local or remote task-branch deletion, and authorized external transitions whose target and scope are fully resolved.
- `[HIGH]`: unpushed or post-merge commits, dirty or occupied worktrees, non-reproducible or unknown data, ambiguous ownership, destructive commands, or unresolved external state. Keep these items untouched unless a revised plan resolves the evidence and receives explicit approval for that exact high-risk action.

When every branch gate passes, the plan MUST include separate `[DELETE] [MEDIUM]` entries for the remote head branch and the local task branch. Do not downgrade them to an optional reminder. Core Git, worktree, and document cleanup is all-or-nothing by default: if any of their gates fails, mark every core item `[KEEP] [HIGH] [BLOCKED]` with `Command: none`. Independent non-core items may remain separately actionable when their own evidence passes and the plan clearly separates them; an unavailable bound work item does not block otherwise safe core cleanup. A user-requested partial core cleanup requires a revised plan and explicit approval of that exact scope.

If detection or execution reveals a new item, changed state, or a need for different commands, stop and submit a revised plan for approval. Do not silently expand scope.

## Bound Work Items

For each confirmed bound item, list its platform, stable identifier or link, current status, proposed action and target status, and exact read and mutation operations. Resolve a successful terminal state from the item type and current project workflow; never assume a label such as `Done` is terminal. Default an accepted nonterminal item to that verified successful state unless the user requests a different cleanup-specific action, which must appear in the approved plan.

Do not close unrelated children or a parent that still covers unfinished work outside this delivery. If the platform, item, workflow, legal transition, or acceptance evidence is unavailable, use `[KEEP] [HIGH] [BLOCKED]`, explain the reason, and invent neither a target state nor a mutation command. Continue only independent items explicitly covered by the approved plan.

## Execute And Verify Approval

1. Obtain explicit approval of the complete item list and exact commands. Approval of one item does not authorize others.
2. Change to the main repository root before removing a worktree. Immediately before each mutation, revalidate its PR head, remote head, local ancestry, worktree cleanliness, occupancy, archive destination, and item state as applicable. For a work-item transition, run the approved current-item read and current-workflow terminal-state resolution again, in that order, and stop unless both still match the approved plan. Stop on any difference.
3. Execute only approved commands in their approved order: stop task-owned services, add an approved ignore rule if needed, archive documents and evidence, remove approved ephemeral data, remove clean worktrees, delete the local branch, delete the remote head branch, then perform approved thread or work-item operations. A different order required by dependencies must be explicit in the plan.
4. Use no-overwrite moves and ordinary safe Git deletion. Do not use force flags, broad clean/reset/prune commands, wildcard paths, or recursive deletion against an unresolved directory.
5. Read back every mutation where the platform supports it. Confirm archive files at their destination, worktree and local-branch absence, remote-branch absence or recorded pre-absence, service stop, thread state, and work-item status. A command sent or an attempted transition is not success.
6. If a read-back fails, report that item's final state as unverified and preserve recovery evidence. Do not let successful independent actions prove an unverified action succeeded.

Finish with completed, already absent, unchanged, blocked, and unverified items separately. Include the absolute archive path, recorded PR and branch SHAs for recovery, every failed or skipped approved action, and the next recovery condition. Do not claim full cleanup while any planned item remains unresolved.

## Apply Across Agent Runtimes

Use the same safety and approval workflow in every host runtime and with the host's actual Git, hosting-platform, filesystem, and project-management tools. Do not depend on a product-specific invocation prefix; allow implicit activation from the description and accept host-supported explicit invocation forms. Keep host-specific installation paths out of this workflow.
