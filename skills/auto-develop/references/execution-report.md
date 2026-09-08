# Execution Report Contract

Use this contract to keep autonomous delivery traceable without turning the report into a command transcript.

## Contents

- [Maintain the Decision Ledger](#maintain-the-decision-ledger)
- [Use Unambiguous Status Records](#use-unambiguous-status-records)
- [Render the Final Report](#render-the-final-report)
- [End After a Verified Draft PR or Risk-Gate Pause](#end-after-a-verified-draft-pr-or-risk-gate-pause)

## Maintain the Decision Ledger

Create the ledger before the first material decision at `<project-root>/<agent-private-plans>/<task-summary>-decision-tree.json`. Use the applicable tool-specific hidden directory, such as `.codex/plans/` or `.claude/plans/`; use `.ai/plans/` only when no tool-specific private directory exists. Normalize the short task summary into a filesystem-safe name without path separators. Keep the full path absolute.

Before creating the file, prove that the directory is private to the agent and ignored by Git, and that the target path is not tracked. If the directory is not ignored, add its root-relative pattern to the repository-local exclude file returned by `git rev-parse --git-path info/exclude`, then repeat the checks. Do not edit a tracked ignore file for the ledger. After creation, read back Git evidence that the file remains ignored and untracked.

Initialize the file as valid JSON with these exact, case-sensitive English keys. Record exposed host metadata and the current session language when known; otherwise keep the string default `""`. Use `[]` for unavailable lists, `false` for unavailable booleans, and the complete nested default object for unavailable structured content. Never omit a fixed key, use `null`, or translate a JSON key.

```json
{
  "schemaVersion": 1,
  "session": {
    "id": "",
    "name": "",
    "language": ""
  },
  "task": {
    "summary": "",
    "ledgerPath": ""
  },
  "decisions": []
}
```

Immediately after each material decision, push one object with this exact shape into `decisions`, atomically replace the file, parse the complete JSON document, and read the new object back. Populate every value that is already known and retain the typed default only for content that has not been generated yet.

```json
{
  "id": "",
  "type": "",
  "title": "",
  "createdAt": "",
  "parentId": "",
  "trigger": "",
  "evidence": [],
  "options": [],
  "recommendation": "",
  "selection": "",
  "reason": "",
  "risk": {
    "level": "",
    "description": ""
  },
  "reversibility": "",
  "userInvolvement": "",
  "outcome": {
    "status": "",
    "evidence": [],
    "updatedAt": ""
  }
}
```

Assign every decision a unique immutable `id` such as `D-05.1` and a stable `type` such as `implementation_approach`. Capture `createdAt` immediately before the first write with seconds and an explicit numeric UTC offset, for example `2026-08-19T09:15:30+08:00`; never change it during later updates. Every option uses exactly these keys and typed defaults:

```json
{
  "id": "",
  "label": "",
  "description": "",
  "recommended": false
}
```

Once options exist, give every option a unique stable `id`, meaningful label and description, and mark exactly one option as recommended. Store the recommended and selected option IDs in `recommendation` and `selection`; `selection` may stay `""` only while a required user choice is unresolved.

For every later update, acquire an exclusive per-ledger lock before the read-modify-write transaction, parse the current file, and locate the decision by exact `id`. Require exactly one match, update that same object with newly generated evidence, selection, reason, risk, involvement, or outcome content, then write valid JSON to a sibling temporary file and atomically replace the ledger. Hold the lock through parsed read-back so concurrent writers cannot overwrite another decision's newer state. Never target an update by array position and never edit serialized JSON with string replacement. Parse the replaced file and verify the exact updated object before relying on it. A missing or duplicate ID is a ledger integrity failure; recover from verified evidence instead of inserting a second version of the same decision. Preserve already verified non-default values unless newer verified evidence explicitly corrects them; never change `id`, `type`, or `createdAt` after the object is first pushed.

Record material choices about workflow precedence, source branch, worktree, tracking, requirements, implementation approach, validation, review fixes, and pull-request delivery. Omit trivial shell syntax and mechanically determined steps. Keep rejected alternatives when they explain why the chosen branch was safer or more correct. Use child identifiers such as `D-05.1` when a phase contains multiple material decisions.

At the start of every later turn, resumed session, or context-restored continuation, parse the ledger and validate its schema, typed defaults, unique decision IDs, and recorded absolute `task.ledgerPath` against the file actually opened before deciding or acting. If it is missing or invalid, recover only from verified preserved evidence and add a recovery decision; never silently reconstruct an audit trail from memory.

Keep the ledger ignored, untracked, and outside every commit and pull-request diff by default. Before every commit, verify that its exact path is absent from the index. After commits and before push or draft-PR creation, verify that the path is absent from task history and the complete delivery diff. If it appears, remove only that path from Git delivery state while preserving the working file, then repeat the checks. Invocation alone never authorizes committing the ledger.

An explicit user request for the current delivery may include the original ledger. In that case, force-add only the exact file, keep the directory ignore rule intact, and record the exception and user evidence in the ledger and terminal report.

## Use Unambiguous Status Records

Keep status claims separate from explanatory prose so a later reader can distinguish a verified result from an attempted action. Emit at most one record for each status label. Status records and decision-table outcomes describe the final state only. Explanatory prose may record an earlier failure only when the same sentence states the verified recovery. Never place a successful status beside an unresolved contradictory qualification or emit mutually exclusive success and pause records in the same report.

For English reports, use these labels when their phase applies; translate them consistently for another destination language:

```text
Authorization: worktree; task branch; modify task files; commit; push; draft PR; bind or create tracking item; synchronize tracking phases.
Source priority: develop > dev/main > main > master.
Selected source branch: <verified branch>
Starting commit: <full verified commit hash>.
Task branch: <verified Git-valid task branch>.
Worktree: <absolute path>; state ready.
Decision ledger read-back: <absolute private .json path>; format JSON; decision updates by immutable id verified; all reported nodes reconciled.
Decision ledger header: session ID <value>; session name <value>; task summary <value>.
Decision ledger Git state: agent-private directory <root-relative hidden plans directory>; ignored; untracked; excluded from commits.
Decision ledger schema: version 1; fixed root keys schemaVersion, session, task, decisions; fixed decision keys with typed defaults.
Tracking match: unique candidate at <score>.
Tracking creation readiness: <score, when creation is considered>
Tracking action: <automatically bound | automatically created and bound | unavailable>
Tracking read-back: verified <bound | created and bound> item <identifier>.
Tracking phase synchronization: <stage>=<ordered states>,<read-back verified | unsynchronized reason>; <next stage>=<ordered states>,<read-back verified | unsynchronized reason>.
Tracking phase children: <independent outcome>=<created or reused lifecycle>,<read-back verified | unsynchronized reason>; routine stages=none.
Tracking phase event <stable event ID>: delivery=<stable delivery identity>; stage=<stage>; state=<state>; summary=<outcome>; evidence=<durable evidence>; next stage=<stage or terminal report>; event time=<RFC 3339>; write=<appended | field history | backfilled | unsynchronized>; read-back=<verified | failed with reason>.
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

When tracking is bound, emit exactly one `Tracking phase synchronization` record in canonical order for preparation and isolation, technical research, solution design, implementation, verification, code review, and delivery closeout. A completed ordinary stage records `started and completed,read-back verified`; preparation may instead record `completed,backfilled,read-back verified`. Preserve `blocked` or `skipped` with its concrete reason and read-back result. Never label an unsynchronized write as verified.

Immediately after the aggregate record, emit one `Tracking phase event <stable event ID>` record for every attempted event in original order. Persist the ID before the first write and include exactly the stable delivery identity, stage, state, summary, evidence, next stage, RFC 3339 event time, write result, and read-back result. For a successful delivery, preparation has one completed backfill event and every later stage has a started event followed by a completed event. A risk-gate pause must stop at the actual blocker and must not report `delivery closeout=completed`; record a blocked event only when it was accepted and read back, otherwise record the attempt as unsynchronized.

Emit exactly one `Tracking phase children` record when tracking is bound. List each independently acceptable outcome that created, reused, advanced, or completed a child, including its read-back result, then end with `routine stages=none`. When no stage has an independently acceptable outcome, use `independent outcomes=none; routine stages=none`. A generic stage name is not an independent outcome.

Use exactly four semicolon-delimited fields for a successful draft PR record: `URL`, `state draft`, `base`, and `head`, in that order. The head must exactly equal the recorded task branch and differ from the base. Do not append another state or a conflicting qualification.

Pause evidence fields must contain concrete facts or choices. Values such as `none`, `unknown`, `TBD`, `not available`, `unspecified`, or equivalent placeholders do not satisfy the pause contract.

Use only the records that describe the actual path. For example, a tracking conflict reports `Tracking write: none.` and omits a successful `Tracking action`; an external PR blocker omits draft-PR success and the post-merge cleanup reminder.

## Render the Final Report

Use the current session language for the terminal report. Resolve it immediately before rendering, store its language tag in `session.language`, and use it for every human-readable decision-tree heading, root label, node title, table heading, option label and description, recommendation marker, reason, risk, involvement value, and outcome. Keep JSON keys, decision and option IDs, Git refs, RFC 3339 timestamps, paths, commands, URLs, and other technical literals unchanged. Validate the expected technical literals in their corresponding tree and table fields, then exclude those literals when checking that the remaining human-readable content contains no text from another language. If ledger values were recorded before the session language changed, translate them for display without translating the stored keys.

Deliver a single self-contained HTML report, following [html-report.md](html-report.md). Keep a restrained palette, readable typography, left alignment, and spacing without divider lines or decorative separator characters, except for the decision timeline's node connectors. All content must be expanded in normal page flow without collapsible content or internal scroll regions. The decision outline is the only exception: a sticky right sidebar containing local jump links to all nodes, current-entry highlighting, and optional list scrolling; narrow screens place it above the timeline. Chapter and block titles stick in separate layers while scrolling and show a subtle lower shadow only while pinned. No external fonts, CDN scripts, or network access are needed to read the report. The four main chapters are:

1. **Task Overview**: State current progress, whether every acceptance criterion passed, or the exact blocker. Show concise task analysis, repository identity, task branch, absolute working directory, recorded start and report-cutoff times, elapsed wall-clock duration, and verified PR number, URL, draft state, base, and head. Keep supplementary context compact with the source branch, full starting commit, and tracking or monitoring result. Put session metadata and the absolute decision-ledger path in the decision chapter's audit block. Missing timing is explicitly unrecorded; a missing PR is explicitly not created.
2. **Valuable Intermediate Stages**: Include material research findings, design choices, implemented behavior, and independently useful stage outcomes with their evidence. Omit routine command narration. Preserve verification commands and final results in this chapter: `Command: <actual command>` followed by `Result: <verified result>`, translated consistently. Distinguish direct, expanded, and substituted coverage. An empty chapter states that no valuable intermediate outcome was recorded.
3. **Code Review and Fixes**: Pair each finding with its severity, concrete evidence, corresponding fix, repair verification, and final status. Record actual review, fix, and reverification timestamps and the latest report-level review time, including when no findings exist; leave unavailable times unrecorded. Include re-review outcome and residual risk. Distinguish a completed review with no findings from a review that has not run. Never display a pending, deferred, or unverified fix as resolved.
4. **Decision Tree**: Render every decision object once as a vertical timeline rooted at the user's goal, with creation/update times above its title and all details inline. Preserve execution order, child decisions, type, parent references, IDs, and every field previously shown in the details table. List all options with full descriptions and IDs, using independent recommendation and selection tags. Both tags may mark the same option; keep every alternative visible. The HTML is a presentation of the current ledger, never a replacement or a schema migration. Preserve schema/session/task metadata, all applicable final status records, aggregate phase synchronization, per-event payloads, and hybrid-child results in an always-expanded audit block in this chapter.

The HTML is the detailed delivery record, served live by the task-owned Node service and retained as an offline snapshot. Default chat closeout is one short outcome sentence plus one compact line of links to the verified live URL, offline HTML, original JSON, and verified draft PR when available. Add a short sentence for any blocker, material residual risk, or necessary user action, and the cleanup reminder after verified draft-PR creation. Do not repeat report sections, implementation lists, validation counts or commands, review details, or worktree metadata. These brevity rules change presentation, not the required work or evidence. Follow an explicit request for detail; when the user requests text-only output or prohibits report file creation, retain the evidence contract in text and state that no HTML artifact was generated. If report delivery fails, disclose the failure and give the essential result or blocker directly; never imply an unavailable artifact was delivered.

### Text-Only Simulation Compatibility

The following tree and table examples apply only when the user explicitly requests a text-only simulation. Real HTML reports use the timeline above, retaining the same decision fields and evidence. For text-only output, use these audit sections in order: Outcome, Delivery Context, Implemented, Verification, Deep Review, Draft PR, Decision Tree. Follow the tree with the full Markdown decision-details table below. Render the tree in execution order and include every delivery phase. The English example below illustrates structure, not fixed display copy:

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

For text-only simulations, follow the tree with this Markdown decision-details table. Populate every cell for every completed decision. Translate the table headings and human-readable values consistently into the current session language. When only one credible path exists, list it as option `1.`, explain it, and mark it as recommended. Never use a default placeholder for completed decisions. On a risk-gate pause, preserve unfinished typed defaults in JSON and display them honestly as pending or unrecorded, without inventing an outcome.

```text
| Node | Created at | Trigger | Evidence | Options | Recommendation | Selection | Reason | Risk | Reversibility | User involvement | Outcome |
| Source branch | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Worktree | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Tracking | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Requirements | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Implementation | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Implementation approach | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Verification | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Review fixes | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
| Draft PR | ... | ... | ... | 1. ... - ... [Recommended]<br>2. ... - ... | Option 1 - ... | Option 1 - ... | ... | ... | ... | ... | ... |
```

Include one table row for every tree node, including child decisions, in the same order as the tree. Copy each object's original `createdAt` value into its row. Render numbered options and their explanations in one cell separated by `<br>`, preserving the single recommendation marker and the explicit option references in the recommendation and selection columns. For English reports, use these exact outcome values for the eight required phase rows in phase order: `Base recorded`, `Worktree ready`, `Read-back verified`, `Criteria mapped`, `Behavior implemented`, `Passed`, `Re-review clean`, and `URL and refs verified`. Translate those values for another session language. Use the actual verified outcome for child decisions. Put details and the next decision in evidence or explanatory prose. Keep failed attempts and recovered history in explanatory prose, not in the final outcome cell.

Do not invent branches or evidence that were not considered during execution.

### Report Preflight

Before emitting the terminal response, re-read this contract and the ledger, then verify all of the following for the active output format:

- the HTML report exists at an absolute private path, opens offline, and contains all four chapters; its content matches the ledger and verified presentation inputs;
- any linked live service reports the expected instance/input paths, latest revision, and no update error; its management state stays private and outside Git;
- the HTML, its presentation input, and the original ledger remain ignored and untracked unless the user explicitly requested specific artifacts in Git;
- elapsed time comes from recorded start and cutoff timestamps, with waiting time included; unavailable timing is not inferred from decision timestamps;
- every review finding remains paired with its fix or explicit unresolved disposition and actual verification evidence;
- the decision-ledger read-back record contains its absolute private JSON path ending in `-decision-tree.json`;
- the complete file parses as JSON with `schemaVersion: 1`, the exact fixed root and nested keys, the required typed defaults, and no `null` values;
- the session and task objects record the available session ID, session name, current session language, task summary, and ledger path;
- the Git-state record proves the default ignored, untracked, and commit-excluded state or the exact explicit-user exception;
- every decision has a unique immutable ID, and every later change read back from the same object selected by that ID;
- every timeline entry or text-only decision row contains its original valid RFC 3339 creation time;
- every option list is consecutively numbered, gives every option a meaningful explanation, marks exactly one recommendation, and matches the explicit `Recommendation` and `Selection` option references;
- every stored decision appears once in the HTML timeline, with its parent reference when present; text-only simulations instead contain one tree node and one table row per decision;
- every completed decision's detail fields are populated and every outcome uses the latest verified update;
- all HTML content is directly readable without collapsed content, with links and optional list scrolling limited to the decision outline; recommended options are visually distinct from alternatives and actual selections;
- every human-readable decision-tree label and value uses the current session language while fixed JSON keys and technical literals remain unchanged;
- all eight delivery phases appear in order for a successful delivery;
- every canonical project-management phase appears once in order with its attempted states and read-back result when tracking is bound;
- every aggregate phase state is backed by an ordered, uniquely identified event payload with durable evidence and historical read-back;
- every phase child represents an independently acceptable outcome and routine stages created no child;
- a paused delivery includes every decision accumulated through the blocker;
- the final status records contain no attempted, stale, or contradictory success claim.

Do not emit a terminal response until this preflight passes.

## End After a Verified Draft PR or Risk-Gate Pause

When the draft PR exists and its state has been read back successfully, keep the worktree path and task branch in the HTML overview, and append this short reminder once in chat:

> PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。

For an explicitly requested text-only simulation, retain the worktree metadata and reminder in the text report. Do not present cleanup as part of the current `auto-develop` delivery. A later cleanup request also stops this task's report service before removing its worktree. When PR creation is blocked, omit the reminder: put preserved work and detailed evidence in the report, and state the exact blocker and condition required to resume briefly in chat. Identify a human-only action only when one is actually required.
