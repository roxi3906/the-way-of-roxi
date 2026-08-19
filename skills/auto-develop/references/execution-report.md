# Execution Report Contract

Use this contract to keep autonomous delivery traceable without turning the report into a command transcript.

## Contents

- [Maintain the Decision Ledger](#maintain-the-decision-ledger)
- [Use Unambiguous Status Records](#use-unambiguous-status-records)
- [Render the Final Report](#render-the-final-report)
- [End After a Verified Draft PR or Risk-Gate Pause](#end-after-a-verified-draft-pr-or-risk-gate-pause)

## Maintain the Decision Ledger

Create the ledger before the first material decision at `<project-root>/<agent-private-plans>/<task-summary>-decision-tree.md`. Use the applicable tool-specific hidden directory, such as `.codex/plans/` or `.claude/plans/`; use `.ai/plans/` only when no tool-specific private directory exists. Normalize the short task summary into a filesystem-safe name without path separators. Keep the full path absolute.

Before creating the file, prove that the directory is private to the agent and ignored by Git, and that the target path is not tracked. If the directory is not ignored, add its root-relative pattern to the repository-local exclude file returned by `git rev-parse --git-path info/exclude`, then repeat the checks. Do not edit a tracked ignore file for the ledger. After creation, read back Git evidence that the file remains ignored and untracked.

Initialize the ledger with this header. Use exact host session metadata when exposed. When the host does not expose a session ID, record `not exposed by host` instead of inventing one; derive a concise session name from the current task only when no host name exists.

```text
# Decision Tree

Session ID: <host session ID or not exposed by host>
Session name: <host session name or concise derived name>
Task summary: <short task summary>
Decision ledger: <absolute path>
```

Immediately after each material decision, append this immutable record and read the appended content back:

```text
D-<sequence> <decision title>
Parent: <root or earlier decision>
Trigger: <fact or event requiring a choice>
Evidence: <repository, runtime, tool, test, or user evidence>
Options: <credible alternatives considered>
Recommendation: <recommended option>
Selection: <option actually selected>
Reason: <why this option best satisfies the task>
Risk: <low, medium, high and the concrete exposure>
Reversibility: <how the choice can be undone, or irreversible>
User involvement: <not required, authorized by invocation, or explicitly required>
Outcome: pending verification
```

Never edit, replace, or reorder an earlier record. When the result becomes known, append an outcome update and read it back:

```text
Update D-<sequence> Outcome
Evidence: <tool, repository, runtime, test, or read-back evidence>
Outcome: <verified final result>
```

Record material choices about workflow precedence, source branch, worktree, tracking, requirements, implementation approach, validation, review fixes, and pull-request delivery. Omit trivial shell syntax and mechanically determined steps. Keep rejected alternatives when they explain why the chosen branch was safer or more correct. Use child identifiers such as `D-05.1` when a phase contains multiple material decisions.

At the start of every later turn, resumed session, or context-restored continuation, read the ledger before deciding or acting. If it is missing, recover only from verified preserved evidence and append a recovery record; never silently reconstruct an audit trail from memory.

Keep the ledger ignored, untracked, and outside every commit and pull-request diff by default. Before every commit, verify that its exact path is absent from the index. After commits and before push or draft-PR creation, verify that the path is absent from task history and the complete delivery diff. If it appears, remove only that path from Git delivery state while preserving the working file, then repeat the checks. Invocation alone never authorizes committing the ledger.

An explicit user request for the current delivery may include the original ledger. In that case, force-add only the exact file, keep the directory ignore rule intact, and record the exception and user evidence in the ledger and terminal report.

## Use Unambiguous Status Records

Keep status claims separate from explanatory prose so a later reader can distinguish a verified result from an attempted action. Emit at most one record for each status label. Status records and decision-table outcomes describe the final state only. Explanatory prose may record an earlier failure only when the same sentence states the verified recovery. Never place a successful status beside an unresolved contradictory qualification or emit mutually exclusive success and pause records in the same report.

For English reports, use these labels when their phase applies; translate them consistently for another destination language:

```text
Authorization: worktree; task branch; modify task files; commit; push; draft PR; bind or create tracking item.
Source priority: develop > dev/main > main > master.
Selected source branch: <verified branch>
Starting commit: <full verified commit hash>.
Task branch: <verified Git-valid task branch>.
Worktree: <absolute path>; state ready.
Decision ledger read-back: <absolute private .md path>; format Markdown; append-only updates verified; all reported nodes reconciled.
Decision ledger header: session ID <value>; session name <value>; task summary <value>.
Decision ledger Git state: agent-private directory <root-relative hidden plans directory>; ignored; untracked; excluded from commits.
Tracking match: unique candidate at <score>.
Tracking creation readiness: <score, when creation is considered>
Tracking action: <automatically bound | automatically created and bound | unavailable>
Tracking read-back: verified <bound | created and bound> item <identifier>.
Tracking write: none.
Risk gate status: paused.
Deep review: <actionable recommended findings or none>
Review fix status: applied.
Re-review status: no actionable recommended findings remain.
Validation status: passed after fixes.
Draft PR read-back: URL <url>; state draft; base <source>; head <task branch>.
External dependency blocker: <verified blocker>
Safe alternatives: exhausted.
Preserved work: <paths and state>
Resume condition: <observable condition>
```

Use `Tracking match: none.` when no candidate qualifies. For a conflict, list every qualifying candidate's distinct identity and score as semicolon-delimited entries in the single `Tracking match` record, omit `Tracking action`, and report `Tracking write: none.`.

After a successful bind or create-and-bind action, include `Tracking read-back` only after the destination item has been fetched and its bound state verified. A successful delivery must also include the worktree path with `state ready`, the decision-ledger header and absolute-path read-back records, and the verified default Git state. When the user explicitly requested the ledger in Git, replace the default Git-state suffix with `ignored; force-added exact ledger; included by explicit user request` and include the request evidence. Attempted, failed, pending, or placeholder states are not success evidence.

Use exactly four semicolon-delimited fields for a successful draft PR record: `URL`, `state draft`, `base`, and `head`, in that order. The head must exactly equal the recorded task branch and differ from the base. Do not append another state or a conflicting qualification.

Pause evidence fields must contain concrete facts or choices. Values such as `none`, `unknown`, `TBD`, `not available`, `unspecified`, or equivalent placeholders do not satisfy the pause contract.

Use only the records that describe the actual path. For example, a tracking conflict reports `Tracking write: none.` and omits a successful `Tracking action`; an external PR blocker omits draft-PR success and the post-merge cleanup reminder.

## Render the Final Report

Use destination language rules and include these sections when applicable:

1. **Outcome**: State whether every acceptance criterion passed or identify the exact blocker.
2. **Delivery Context**: Show the source branch and full starting commit, task branch, worktree, tracking or monitoring result, and the absolute decision-tree document path.
3. **Implemented**: Describe observable behavior and affected business or content paths.
4. **Verification**: List commands or checks with their final results. For every command, emit `Command: <actual command>` followed by `Result: <verified result>`. Distinguish direct, expanded, and substituted coverage.
5. **Deep Review**: List findings by severity, the recommended fixes applied, re-review outcome, and any residual risk.
6. **Draft PR**: Link the verified draft PR and state its base and head branches.
7. **Decision Tree**: Render every ledger decision record as a connected tree rooted at the user's goal. Consolidate each record with its latest verified outcome update; do not omit child decisions.

Render the tree in execution order and include every delivery phase:

```text
User goal
|- D-01 Source branch
|- D-02 Worktree
|- D-03 Tracking
|- D-04 Requirements
|- D-05 Implementation
|- D-05.1 Implementation approach
|- D-06 Verification
|- D-07 Review fixes
`- D-08 Draft PR
```

Follow the tree with this decision-details table. Populate every cell for every decision; use `not applicable` only when the decision genuinely had no alternative or user-involvement state.

```text
| Node | Trigger | Evidence | Options | Recommendation | Selection | Reason | Risk | Reversibility | User involvement | Outcome |
| Source branch | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Worktree | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Tracking | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Requirements | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Implementation | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Implementation approach | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Verification | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Review fixes | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| Draft PR | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

Include one table row for every tree node, including child decisions, in the same order as the tree. For English reports, use these exact `Outcome` values for the eight required phase rows in phase order: `Base recorded`, `Worktree ready`, `Read-back verified`, `Criteria mapped`, `Behavior implemented`, `Passed`, `Re-review clean`, and `URL and refs verified`. Use the actual verified outcome for child decisions. Put details and the next decision in `Evidence` or explanatory prose. Translate these values consistently for a non-English destination. Keep failed attempts and recovered history in explanatory prose, not in the final outcome cell.

Do not invent branches or evidence that were not considered during execution.

Before emitting the terminal response, re-read this contract and the ledger, then verify all of the following:

- the decision-ledger read-back record contains its absolute private Markdown path ending in `-decision-tree.md`;
- the header records the session ID, session name, and task summary;
- the Git-state record proves the default ignored, untracked, and commit-excluded state or the exact explicit-user exception;
- every appended decision appears once in the tree and once in the table;
- every table cell is populated and every outcome uses the latest verified update;
- all eight delivery phases appear in order for a successful delivery;
- a paused delivery includes every decision accumulated through the blocker;
- the final status records contain no attempted, stale, or contradictory success claim.

Do not emit a terminal response until this preflight passes.

## End After a Verified Draft PR or Risk-Gate Pause

When the draft PR exists and its state has been read back successfully, include the worktree path and task branch and end with this reminder:

> PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。

Do not present cleanup as part of `auto-develop`. When PR creation is blocked, omit this reminder and report the exact risk-gate blocker, preserved work, and condition required to resume. Identify a human-only action only when one is actually required.
