---
name: tapd-sync
description: Automatically match the first substantive work-session response with TAPD and lightly recommend a parent work item binding. If that exchange ends unbound without parent intent, suspend later TAPD checks and output until the user explicitly resumes binding or creation. After binding, record delivery phases on the parent, create children only for independently valuable outcomes, and complete code-bearing children only from successful commits. Use for coding, fixes, debugging, refactoring, review, research, design, decisions, documentation, testing, releases, operations, repository maintenance, or explicit TAPD, requirement, defect, task, 需求, 缺陷, 任务, 工作项, binding, or sync requests. Do not use for `tapd-summary`, casual chat, acknowledgements, simple status or time queries, translations, or requests without an independent outcome.
---

# TAPD Sync

Connect the current work context to TAPD capabilities already configured in the runtime. Perform one read-only match before the first final answer and lightly recommend a parent binding there. If that first exchange ends without parent intent or a binding, suspend TAPD for later requests. After the user binds a parent, keep its delivery phase current and maintain child requirements only for independently valuable outcomes.

## Establish the Work Context

- Treat `session`, `conversation`, `task`, and `thread` as the current continuous work context, regardless of the host runtime's terminology.
- When the current request explicitly invokes or selects `tapd-summary`, do not initialize, match, remind, bind, create, reuse, complete, or otherwise process TAPD through this skill. Yield the entire request to `tapd-summary`, even when this session already has a binding.
- On the first substantive request, initialize `tapd_first_reply_sent` to false and `tapd_sync_mode` to `active` before capability detection.
- Initialize as soon as the first substantive request provides enough repository, topic, or deliverable context for reliable matching, and always before sending the first final answer for that request. If reliable matching context is still unavailable at the final-answer gate, report the missing non-sensitive context there instead of silently skipping TAPD.
- When `tapd_sync_mode` is `dormant`, inspect only whether the user unambiguously selects a retained first-reply candidate or proposal, or explicitly requests parent binding or creation. If not, stop this skill before capability detection, adapter access, work-item matching, child evaluation, or footer composition.
- Do not depend on a product-specific invocation prefix. Explicit invocation is optional and uses whatever syntax the host runtime supports.
- If the runtime loads this skill again in the same work context, reuse the existing state rather than initializing again.

## Core Constraints

- Do not let unavailable TAPD integration block the user's original task unless that task specifically requires TAPD.
- Never expose tokens, authorization headers, passwords, or configuration values.
- Do not create child requirements automatically before the user binds a parent work item.
- Do not request a second TAPD business confirmation before automatically creating child requirements or completing bound child requirements. Always honor the host runtime's permission controls for tools, commands, network access, and writes.
- Run the final-answer gate only for the first substantive reply, an explicit parent binding or creation flow, or a session with a verified binding. Never add TAPD output while the session is dormant.

## Default Work-Item Discovery to Nonterminal Scope

- Whenever another section authorizes TAPD discovery, apply a nonterminal-only default to its user-driven work-item search, query, list, candidate match, and returned result. This scope rule never initializes TAPD, reactivates dormant synchronization, or changes existing pagination, ranking, and presentation limits. Resolve terminal states from the current workspace's workflow and work-item type metadata rather than hardcoded status names.
- Treat broad quantity words such as `all`, `every`, `全部`, `所有`, and `完整` as quantity language only; they do not expand the status scope beyond nonterminal items. Expand discovery to terminal items only when the user explicitly asks to include terminal, completed, closed, rejected, archived, or otherwise finished work items.
- When the user's scope language is ambiguous, proceed without clarification using the nonterminal default. After presenting the results, state concisely that the default nonterminal scope was applied and that the user can explicitly request terminal items to expand it.
- Under the nonterminal default, exclude an item whose terminal status cannot be determined and report that the workflow metadata was insufficient to classify it reliably. Under an explicit terminal-inclusive scope, retain such an item with an uncertain-status label instead of implying that its terminal state was verified.
- Before describing a terminal-inclusive result as complete, confirm that the adapter and workflow metadata can enumerate every relevant status and that every result page was processed. When either guarantee is unavailable, present the result as partial and report the terminal-coverage limitation.
- Treat exact-ID fetches, post-write read-backs, transition verification, partial-write recovery, and all-status idempotency checks as internal safety reads rather than discovery. They may inspect terminal items without additional user scope authorization, but never add terminal items found only through those reads to user-facing discovery results.

## Use User-Readable TAPD References

- In every user-facing response, refer to TAPD entities by a user-readable title or display name rather than an internal ID. Use work-item titles for requirements, defects, tasks, parents, and children; use display names for workspaces, projects, users, statuses, and work-item types.
- Keep IDs in session state, API calls, adapter inputs, idempotency keys, verification, and link destinations. Never render an ID as plain user-facing text or as a link label.
- When the user supplies an ID or selects a candidate by number, resolve the current entity and respond with its title or display name without echoing the ID. A user-readable title or display name may be a link whose destination contains the ID.
- Distinguish duplicate names with user-readable context such as workspace display name, project name, work-item type, parent title, or status. Never append an ID for disambiguation.
- If no user-readable value can be resolved, state that the TAPD entity's name is temporarily unavailable and include only a non-sensitive reason. Do not fall back to its ID. If the missing name prevents a reliable user choice, pause that TAPD operation while continuing unrelated user work.
- Treat every instruction elsewhere in this skill to store, compare, fetch, return, or verify an ID as internal processing unless it explicitly defines user-facing output. Apply this section to candidate lists, reminders, binding confirmations, write summaries, parent-child descriptions, partial-write reports, and errors.

## Maintain Session State

Maintain the following state in the current session context:

- `tapd_initialized`: Whether capability detection and initial matching have run.
- `tapd_adapter`: The TAPD skill, CLI, HTTP integration, or unavailable state selected for this session.
- `tapd_identity`: The complete token-user identity returned by the selected adapter. Keep it for identity checks, but do not assume that every identifier in it is valid for TAPD owner fields.
- `tapd_owner`: A record containing the exact owner-field `value` and its adapter-documented `source` field.
- `tapd_workspaces`: Configured workspace IDs and workspace display names. Treat these as TAPD containers, never as code-project names.
- `tapd_project_name`: The current code project's name resolution, containing `status` (`resolved`, `ambiguous`, or `missing`), exact `value` when resolved, comparison-only `normalized` value, and the code or work-item `evidence` for every candidate.
- `tapd_candidates`: Up to three candidates ranked by relevance.
- `tapd_binding`: The bound parent's workspace, project name, type, ID, and title.
- `tapd_first_reply_sent`: Whether the first substantive request has received its final answer.
- `tapd_sync_mode`: `active` before the first reply or during an explicit parent flow, `dormant` after an unbound first exchange without parent intent or after an explicit decline, and `bound` after a parent binding verifies successfully.
- `tapd_session_children`: Child requirements created or reused in this session and the user requests or independently acceptable phase outcomes they represent.
- `tapd_phase_events`: Phase events attempted for the bound delivery, keyed by a stable event ID persisted before the first write, with delivery, parent, stage, state, summary, event time, evidence, next stage, write result, and read-back result.
- `tapd_reply_items`: The parent, candidates, phase updates, and children relevant to the current final answer, including each user-readable title, URL, status, and action taken. Reset it for every substantive user request.
- `tapd_partial_writes`: Work items that were created but failed post-write verification, recording workspace, parent ID or top-level absence, normalized title, item ID, and failure reason.
- `tapd_write_owner`: The stable identity of the single context currently responsible for TAPD writes.

Keep this state only in the current work context. Restore it after context compaction only from a trusted summary of this same context. Preserve a trusted `dormant` mode and do not initialize again; if the summary proves the first reply was sent but contains neither a complete binding nor a mode, default to `dormant`. Restore `tapd_project_name` only when its status, exact value, normalized value, and evidence remain available; otherwise rerun project-name resolution and treat the binding's project name as one evidence source rather than an automatic answer. A binding is restorable only when its complete workspace, project name, type, ID, and title remain available; mark every restored binding as unverified. Restore `tapd_phase_events` only with their complete idempotency keys and results, mark their writes unverified, and fetch the parent fields or activity before reusing or retrying them. Before the first TAPD write after restoration, resolve `tapd_identity` and `tapd_owner` again from the current adapter instead of trusting their restored values, rerun project-name conflict checks, then fetch the parent and confirm that it exists, remains open, belongs to a configured workspace, and does not conflict with the resolved project name. Mark the binding verified and set `tapd_sync_mode` to `bound` only after all checks succeed. If owner resolution fails, keep the binding unverified and skip TAPD writes while continuing the user's original task. If the parent check fails, clear the binding, set `tapd_sync_mode` to `dormant`, and perform no TAPD write until the user explicitly requests parent binding or creation. If project-name evidence conflicts, keep the binding unverified and ask the user to resolve the name before any TAPD write. Never claim that the binding persists into a new work context.

## Keep One TAPD Write Owner

- Make the primary work context the default `tapd_write_owner`.
- Treat forked contexts and subagents as read-only TAPD workers unless the current write owner completes an explicit ownership handoff for one specific write.
- Perform a handoff before delegated work starts: set `tapd_write_owner` to the delegate's stable context identity, provide the complete verified binding, the resolved `tapd_project_name` with its evidence, `tapd_owner` with its source, matching `tapd_partial_writes`, relevant `tapd_phase_events`, and exact write responsibility, and make the previous owner read-only for TAPD. If these changes cannot be represented as one exclusive handoff, do not delegate the write.
- Return ownership only after the delegate reports a final write result or a confirmed no-write result and can no longer retry. The primary context remains read-only until it observes that explicit return.
- Allow only one context to create or complete TAPD work items for a given user request. Other contexts return their work result to the write owner without writing to TAPD.
- If write ownership, the project-name resolution, or the binding snapshot is incomplete, do not infer them. Continue the user's original task without the TAPD write.

## Select TAPD Capabilities by Runtime

Probe capabilities instead of detecting or branching on the host product name. Select one available adapter in this order and continue using it throughout the work context:

1. **TAPD skill**: If the runtime can discover and invoke an installed TAPD skill, such as `tapd-openapi`, read its complete instructions first and follow its authentication, workspace, and API rules.
2. **TAPD CLI**: Otherwise, find an installed and authenticated TAPD CLI. Inspect the actual command's `--help`, authentication status, and subcommands before using it. Do not assume its executable name or arguments. Do not install it or start a new login automatically.
3. **Environment and HTTP**: Otherwise, read the runtime TAPD configuration. Prefer `TAPD_WORKSPACE_IDS`, split it on commas, and trim whitespace. Fall back to `TAPD_WORKSPACE_ID` when the list is unset. Use HTTP only when `TAPD_API_ENDPOINT`, `TAPD_TOKEN`, and at least one workspace ID are present. Consult the current official TAPD API documentation before calling endpoints. Never guess paths or fields.
4. **Unavailable**: If no method is usable or the configuration is incomplete, set the adapter to unavailable and continue the user's original task.

Report only whether configuration names are available and which names are missing. Never display their values. If an adapter exists but cannot perform the required operations, continue to the next configured adapter. Never install tools, start authentication, bypass runtime permissions, or expand runtime access automatically.

When a bound delivery supplies phase events, probe whether the selected adapter can inspect compatible parent fields or append and read back work-item activity or comments. Keep an otherwise usable adapter when this optional capability is absent, but mark phase synchronization unavailable and do not substitute an unverified write path.

## Resolve a Writable TAPD Owner

- Resolve `tapd_identity` and `tapd_owner` separately. A stable user identifier is not automatically a writable work-item owner.
- Prefer an owner-specific login, username, English ID, or equivalent field documented by the selected adapter. For `tapd-openapi` or direct HTTP, fetch `/users/info`, keep the complete returned user record as `tapd_identity`, and set `tapd_owner.value` to its non-empty `nick` with `tapd_owner.source` set to `/users/info.nick`.
- Treat `/users/info.id` and equivalent internal user IDs as lookup identifiers only, even when the adapter documents them as unique. Never substitute an internal ID, display-name field, email address, or token subject for a missing owner-specific field.
- Preserve the owner value exactly as returned by its source field. Always write the single un-delimited `tapd_owner.value`; never append the semicolon used by TAPD response serialization.
- When the adapter returns account status, reject an explicitly disabled, frozen, departed, or otherwise inactive user. Missing status fields alone do not make an otherwise documented owner field invalid.
- Record the owner value together with its source field so compacted or delegated contexts cannot replace it with another identifier. If no documented owner-specific field can be resolved, leave `tapd_owner` unresolved and do not fall back to `tapd_identity`.

After creating a work item, verify its owner from the create response or fetch the item by its returned ID when the response omits owner data. TAPD may return multiple owners as a semicolon-delimited string with a trailing semicolon; split that response, trim each value, ignore empty entries, and require an exact match for `tapd_owner.value`. If owner or parent verification fails, add a `tapd_partial_writes` record, do not retry the create, do not add the item to `tapd_binding` or `tapd_session_children`, do not claim successful synchronization, and report the mismatch without exposing unrelated identity data.

Before creating or reusing the same logical idempotency key, inspect `tapd_partial_writes` and fetch each recorded item by ID. If an item now passes every required owner and parent verification, remove the partial-write record and reuse it. If it still exists but remains invalid, keep the record, skip both reuse and creation, and report the unresolved partial write. Remove the record and allow a new create only after confirming that the recorded item no longer exists.

## Initialize and Match Work Items

After selecting an adapter, perform this read-only initialization:

1. Resolve the token identity and `tapd_owner` once, then resolve the display name of every configured workspace. Preserve the distinction between workspace identity and code-project identity.
2. Apply the current user request's work-item discovery scope, then query requirements, defects, and tasks in every workspace. Process every page in that scope with the largest reasonable page size supported by the adapter. Under the default scope, do not retain terminal items as matching candidates or project-name evidence. Include terminal items only when the user explicitly requested a terminal-inclusive scope.
3. Query each workspace's workflow or field configuration to classify terminal states according to the discovery-scope rules. Never apply one workspace's hardcoded status values to another workspace.
4. Apply the discovery-scope rule when an item's terminal state cannot be determined. Never treat an uncertain item as a perfect match.
5. Derive the work-context topic and independent code-project identifiers from the repository name, branch name, explicit work-item identifiers, and intended deliverable. Collect project-name candidates separately from an explicit user-supplied project name and human-facing repository introductions such as a README title or a project manifest's display name or description. Do not treat a directory name, repository slug, branch name, or machine package identifier as the display project name unless the repository introduction explicitly presents it that way. Never use a TAPD workspace display name as project-name evidence.
6. Identify historical work items that belong to the same code project using evidence independent of their workspace and project-name prefix, such as repository or product identifiers in their title body, description, module, labels, and delivery goal. Neither sharing a workspace nor carrying a particular prefix is sufficient by itself.
7. Extract leading `【project name】` prefixes only from independently identified same-project work items. Keep each exact spelling, occurrence count, most recent use, and source item as evidence.
8. Resolve `tapd_project_name` before proposing or creating a work item:
   - Compare candidates case-insensitively after removing whitespace and hyphens. Use this normalized form only to determine whether names are equivalent.
   - When code evidence and historical prefixes are equivalent, preserve the exact historical spelling used most often; break an occurrence-count tie with the most recently used spelling.
   - When all reliable evidence has one normalized name, set `status` to `resolved`. Use the stable historical spelling when available; otherwise preserve the exact code-project spelling.
   - When reliable evidence has multiple non-equivalent names, set `status` to `ambiguous`, show the conflicting names and their sources, and ask the user to choose. Do not resolve the conflict by frequency or source precedence.
   - When no reliable project-name evidence exists, set `status` to `missing` and ask the user to supply the project name.
   - After the user resolves an ambiguous or missing name, preserve that exact value as the resolved name for the current work context.
   - Never fall back to a TAPD workspace display name.
9. Rank current matching candidates using workspace, resolved project context, title, description, module, labels, type, and actual delivery goal.

Treat these signals as progressively weaker evidence:

1. An explicit TAPD ID or exact title supplied by the user.
2. Matching repository or project context and the same delivery goal.
3. A title, module, or label describing the same goal.
4. Isolated shared keywords.

Mark an item as a perfect match only when it represents the same actual delivery goal. Treat insufficient evidence conservatively as a non-perfect match.

Show up to three candidates in this format, including the resolved project name, type, title, match level, and a short reason. When an item URL is available, use its title as the link label:

```text
1. [Project] [Type] Title - Perfect match/Related/Weak match - Reason
```

Do not label a workspace display name as the project when project-name resolution is ambiguous or missing. Show the workspace separately from the project-name evidence in that case. Do not pad the list with unreliable candidates when fewer than three exist. Initial matching is read-only and does not require TAPD business confirmation, but it must still honor host runtime permissions for tools and network access. Continue the user's original task without waiting for a binding.

## Prefer Work-Item Types by Purpose

Before proposing or creating a work item, query the current workspace's supported types and default type. Compare each type's stable key or code when the adapter exposes one and its display name case-insensitively. Use only the selected type ID from the current workspace; never hardcode or reuse a type ID from another workspace.

- For a top-level parent, prefer an exact `STORY` or `需求` type, then a type whose key, code, or display name unambiguously contains `story` or `需求`, then the workspace's default type.
- For an automatic child, prefer an exact `TASK` or `任务` type, then an exact `开发任务` or `技术任务` type, then a type whose key, code, or display name unambiguously contains `task` or `任务`, then the workspace's default type.

Do not let the absence of a preferred semantic type block creation when the workspace has a default type.

## Recommend Binding in the First Final Answer

Complete the user's first request, then include one concise, low-pressure binding recommendation in the TAPD footer:

- When a perfect match exists, recommend the candidates in rank order and ask the user to bind one. Never choose for the user automatically.
- When no perfect match exists and `tapd_project_name` is resolved, use the most relevant workspace, resolve its preferred top-level parent type, and propose that type's display name with `【{tapd_project_name.value}】{work_description}`, then state that the top-level work item can be created and bound automatically.
- When `tapd_project_name` is ambiguous or missing, present its evidence and ask the user to resolve the project name before proposing creation. Never substitute the workspace display name.
- When multiple workspaces are equally reasonable, ask the user to choose a workspace before creation. Never guess.
- Keep this first recommendation to one compact footer. Do not repeat it in later unrelated replies.

After sending the first final answer, set `tapd_first_reply_sent` to true and transition exactly once:

- When a parent has verified successfully, set `tapd_sync_mode` to `bound`.
- When the first user request explicitly asked to bind or create a parent and the operation is still being resolved, keep `tapd_sync_mode` as `active` for that explicit flow.
- Otherwise set `tapd_sync_mode` to `dormant`, even when candidates or a creation proposal were shown. Silence is not a pending binding request.
- When the user explicitly declines binding, set `tapd_sync_mode` to `dormant` immediately.

## Reactivate Only for Explicit Parent Intent

While `tapd_sync_mode` is `dormant`, do not probe TAPD capabilities, refresh candidates, inspect children, evaluate commits, or add a TAPD footer. Reactivate only when the user does one of these:

- Selects an offered candidate or approves the proposed parent creation in a way that is unambiguous from the retained first-reply context.
- Explicitly asks to bind, link, associate, create, or resume a TAPD parent work item for the current work context.

An ordinary substantive request, an isolated TAPD keyword, or discussion about work items without an explicit parent action does not reactivate synchronization. On valid reactivation, set `tapd_sync_mode` to `active` before adapter access, refresh any retained candidate before reuse, and process the requested parent operation. Set it to `bound` after successful verification. If the explicit attempt finishes without a verified binding, return to `dormant` after its final answer unless that answer asks for one specific user choice required to complete the same parent operation; an explicit decline always returns to `dormant` immediately.

## Bind the Parent Work Item

When the user confirms a binding by candidate number, ID, or explicit work item:

1. Fetch the item again and confirm that it exists, remains open, and belongs to a configured workspace.
2. Resolve `tapd_project_name` and compare it with any leading project prefix on the item. Treat normalized-equivalent spellings as the same project and keep the stable historical spelling. If non-equivalent evidence conflicts, ask the user to choose the project name before binding.
3. Accept any work-item type currently supported by the workspace as the parent.
4. Save `tapd_binding` with `tapd_project_name.value` and set `tapd_sync_mode` to `bound` only after project-name resolution and parent verification succeed. Do not create a child requirement for the binding message itself.

Confirm the binding with the parent's type and title, linked when a URL is available. Do not echo an ID supplied by the user.

When the user confirms creation with the proposed title:

1. Resolve the workspace. If multiple workspaces remain equally reasonable, ask the user to choose first.
2. Require `tapd_project_name.status` to be `resolved`. If it is ambiguous or missing, ask the user to resolve it and do not create the item. Never use the workspace display name instead.
3. Resolve the workspace's preferred top-level parent type using the purpose-based type rules. Query the types again if the earlier proposal is stale.
4. Use `【{tapd_project_name.value}】{work_description}` as the title.
5. Require a resolved `tapd_owner`. If it is unresolved, skip creation, report the non-sensitive reason, and continue the user's original task.
6. Check `tapd_partial_writes` for the top-level logical idempotency key before issuing a create. If a recorded item now passes verification, reuse it and continue at step 9 without creating another item.
7. Set the owner to `tapd_owner.value`, the start date to the runtime's current date, and the due date to one calendar day later. Calculate dates in the runtime timezone.
8. Create a top-level requirement without a parent, then verify the returned or fetched owner and confirm that the item has no parent.
9. Save the newly created or recovered item as `tapd_binding` with `tapd_project_name.value` and set `tapd_sync_mode` to `bound` only after every required verification succeeds.

A user-confirmed top-level creation is the only TAPD write allowed before a binding exists, and the current context must still be the write owner. Child requirements created after binding do not require further confirmation.

## Decide Whether a Follow-Up Deserves a Child Requirement

Before handling each follow-up request after binding, evaluate whether it has independent tracking value. Judge by a distinct, verifiable outcome rather than message length.

Requests that usually have tracking value include:

- Adding or modifying a deliverable.
- Fixing an independent problem.
- Changing scope or acceptance criteria.
- Producing a distinct research, decision, or verification result.
- Performing work that can be executed and accepted independently.

Requests that usually do not have tracking value include:

- Confirmations, thanks, or approvals.
- Status questions.
- Pure clarification.
- Repeated instructions.
- Tiny adjustments that add no new work outcome.

Create only when independent tracking value is clear, avoiding low-value TAPD noise. Create separate children for multiple independently acceptable goals in one request. Create only one child for internal steps of the same deliverable.

Apply the same test to an orchestrating workflow's delivery stage. A stage name alone has no independent tracking value. Create or reuse a child only for a distinct stage outcome that can be reviewed, accepted, or delivered independently; routine research, planning, implementation, verification, review, and closeout activity remains progress on the bound parent. Name a child for its outcome rather than for a generic stage.

## Record Bound Delivery Phases

Accept phase events from a configured delivery workflow only in `bound` mode and only from `tapd_write_owner`. Require a stable event ID persisted before the first write, stable delivery identity, canonical stage, state (`started`, `completed`, `blocked`, or `skipped`), concise summary, non-sensitive evidence, next stage, and RFC 3339 event time. Keep events in their original order. If preparation occurred before binding or a restored binding has unsynchronized events, backfill them once after parent verification.

Before writing, verify the bound parent and inspect `tapd_phase_events` using the stable event ID as the idempotency key. Reuse only a verified event whose complete payload matches. If an earlier write may have succeeded without verification, fetch the affected parent activity and retrievable audit history before any retry; retry only after proving that exact event ID is absent. A matching ID with a different payload is a conflict and must never be overwritten or retried as a new event.

Represent the event with the first supported option whose meaning is verified:

1. An existing TAPD phase, progress, milestone, or equivalent field with a compatible allowed value and retrievable audit history that retains the exact event payload after later field updates.
2. A parent work-item activity or comment containing the stable event ID, delivery identity, stage, state, summary, evidence, next stage, and event time.

Use a workflow transition only when current TAPD metadata identifies one unique legal nonterminal mapping for that stage. Never create a field, overwrite the parent's description, guess a status, or move the parent to a terminal state for a phase event. After each write, fetch the parent activity or field history and require the exact event ID and exact event payload to be present before adding a successful `tapd_phase_events` record. The current value of a replaceable field alone is never historical read-back evidence.

For an independently valuable phase outcome, create or reuse one direct child through the existing child-requirement flow and verify its owner and parent. Code-bearing children remain open until a successful Git commit covers their outcome. A non-code child may complete only when its durable artifact or explicit acceptance evidence is available and the workspace exposes one unambiguous legal successful transition. A stage label or an in-memory conclusion alone is not completion evidence.

Apply the adapter's limited retry rules to transient failures. Preserve an unverified or failed event with its non-sensitive reason, continue the original delivery unless phase synchronization is its explicit acceptance criterion, and never claim the phase was synchronized without read-back.

## Create or Reuse Child Requirements Automatically

For a valuable user request, perform these steps before starting the requested work. For an independently acceptable phase outcome discovered during delivery, perform them as soon as that outcome and its evidence are known. Do not ask for another TAPD business confirmation, and continue to honor host runtime permission prompts for tools, network access, and writes:

1. Confirm that `tapd_sync_mode` is `bound`, the current context is `tapd_write_owner`, and the session still has a complete, verified binding. Otherwise skip the TAPD write and continue the user's requested work.
2. Confirm that `tapd_project_name.status` is `resolved` and its value matches `tapd_binding.project_name`. If not, skip the TAPD write, report the project-name conflict, and continue the user's requested work.
3. Generate a concise, specific, and verifiable `【{tapd_project_name.value}】{work_description}` title that names the user outcome or independently acceptable phase outcome, never just the stage.
4. Check `tapd_partial_writes` for the child logical idempotency key before querying reusable items or issuing a create. If a recorded child now passes verification, reuse it and continue at step 12 without creating another item.
5. Query every page of the bound parent's open child requirements and compare normalized titles. Reuse only an open title match whose parent relationship and semicolon-normalized owner both verify against `tapd_binding` and `tapd_owner.value`. If matching items exist but none pass verification, do not reuse them, do not create a duplicate, report the conflict, and continue the user's original task.
6. Before issuing a new create, perform the internal all-status idempotency safety read allowed by the discovery-scope rules: query every page and status for the logical key and record all matching item IDs. Do not reuse a closed match for a new request or expose it as a discovery result.
7. Prefer the selected TAPD skill or CLI's generic create-child-requirement operation. Require it to create a requirement in TAPD's unified work-item model, use the item in `tapd_binding` as the parent regardless of its displayed type, and verify the returned parent relationship. Never substitute a legacy task creation operation.
8. When falling back to HTTP, follow the current official TAPD API and unified work-item model, create the child through `/stories`, and set `parent_id`. Never claim success if the API does not support the current parent relationship.
9. Dynamically resolve the preferred automatic-child `workitem_type_id` using the purpose-based type rules.
10. Require a resolved `tapd_owner`. If it is unresolved, skip creation, report the non-sensitive reason, and continue the user's original task. Otherwise set the owner to `tapd_owner.value`, the start date to the runtime's current date, and the due date to one calendar day later.
11. For a newly created child, verify both its returned parent relationship and its returned or fetched owner before treating synchronization as successful.
12. Add the created or reused item and its corresponding user request to `tapd_session_children`, then continue the user's requested work.

Attach every automatic child directly to the session's bound parent. Never turn the previous turn's child into the next turn's parent.

## Complete Corresponding Children After Code Commits

A lifecycle hook is not required. Whenever the write owner directly observes a successful code commit during the work:

1. Inspect the commit diff and the delivery goal represented by each child in `tapd_session_children`.
2. Identify every child actually covered by the commit, including children created in earlier turns but completed by this commit.
3. Query the currently allowed workflow transitions in each workspace.
4. Select a legal terminal state that the workspace's workflow metadata identifies as successful completion. Prefer states explicitly named `Done`, `已完成`, or `完成`, and complete every child actually covered by the commit.
5. Never complete children that the commit does not cover. Never complete the bound parent automatically.

Keep child requirements in their current state when no code commit occurs. If workflow metadata does not identify a successful completion state, multiple completion states remain ambiguous, or no legal transition exists from the current state, never guess another closed state. Record the reason and continue delivering the code result.

## Keep Writes Traceable and Idempotent

- Retry transient read failures a limited number of times.
- Treat workspace, parent ID or top-level absence, and normalized title as the logical idempotency search key, not by itself as proof that an item came from the current create attempt.
- When a create request times out or returns an ambiguous result, prefer an adapter-provided idempotency key or returned ID. Otherwise use the internal all-status idempotency safety read allowed by the discovery-scope rules: query every page and status for the logical key and compare matching IDs with the pre-create snapshot. Treat only a newly appeared matching ID as the result of this attempt; a pre-existing closed item is not reusable, must not appear in discovery results, and is not evidence of success. Retry only after confirming that no new item was created.
- Continue processing other workspaces when one workspace fails, and record failures separately.
- Never claim successful synchronization after a failed TAPD create or transition.
- Never retry a create merely because owner verification failed; preserve the `tapd_partial_writes` record because the returned work-item ID proves that the write may already exist.
- Never write when TAPD is unavailable or the current context is not the write owner. Except for a user-confirmed top-level requirement creation, require a complete binding before every write.

## Run the Conditional Final-Answer Gate

Immediately before a final answer for a substantive request, determine whether the gate applies. Apply it only to final answers, not interim progress or commentary messages.

1. When `tapd_sync_mode` is `dormant` and the current request has no explicit parent reactivation intent, stop this skill immediately. Do not access an adapter, evaluate work items or children, inspect commits for TAPD completion, or append a TAPD footer.
2. When a dormant request explicitly reactivates parent binding or creation, set `tapd_sync_mode` to `active` and process only that explicit TAPD flow before continuing.
3. On the first substantive final answer, ensure read-only initialization and matching have run, then recommend the best perfect matches or propose creation according to the first-answer rules.
4. When `tapd_sync_mode` is `bound`, reset `tapd_reply_items`, re-evaluate whether the current request and any newly reported phase outcome have independent tracking value, and create or reuse each missing valuable child before sending the final answer.
5. In `bound` mode, process every phase event supplied since the previous applicable gate in event order, recover ambiguous writes before retrying, and read back every successful mutation.
6. Only in `bound` mode, inspect successful Git commits observed since the previous applicable gate and complete every code-bearing bound child actually covered by those commits. Apply the durable-evidence rule to non-code phase children.
7. Refresh only the parent, candidates, phase updates, or children relevant to the applicable first-reply, explicit-parent, or bound flow. Resolve current user-facing URLs through the selected adapter or its documented TAPD URL format. Never invent a URL or expose an ID as fallback text.
8. Record relevant items, statuses, actions, and non-sensitive failures in `tapd_reply_items`.
9. Compose the original task result, then append exactly one compact TAPD footer as the last user-readable block. After the first footer, perform the one-time mode transition defined by the first-answer rules. After a later explicitly reactivated footer without a verified binding, return to `dormant` unless one specific user choice is still required for that same parent operation.

Build the footer according to the current state:

- In `bound` mode, link the parent and every child created, reused, advanced, or completed for the current request. When the request needs no child, link at least the bound parent.
- On the first reply or during an explicit parent flow without a binding, link every recommended candidate. When no matching item exists, show the proposed user-readable work-item title and state that no link exists until the user approves creation; never fabricate a link.
- After a TAPD write or transition failure, still link every verified existing affected item and include the non-sensitive failure beside it.
- When an item exists but its URL cannot be resolved, state that link resolution failed and do not render its ID.
- When TAPD is unavailable, put the unavailable message in the first or explicitly reactivated footer without blocking the original task. After an unbound first reply without parent intent, enter dormant mode and do not repeat it.

Use a single-line footer when practical:

```text
TAPD: [Parent title](parent-url) | [Child title](child-url) - Completed
```

Include these details concisely when they apply:

- Created or reused work-item title, linked when a URL is available.
- Parent work-item title, linked when a URL is available.
- Current status display name.
- Titles of work items completed because of a code commit.
- Any create, owner verification, bind, link-resolution, or transition failure and its non-sensitive reason, referring to affected entities only by user-readable titles or display names.

When the adapter is unavailable, use this exact footer text:

> TAPD is not configured on this device, so sync is disabled.
