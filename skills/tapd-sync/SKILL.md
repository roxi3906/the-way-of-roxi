---
name: tapd-sync
description: Proactively synchronizes every substantive work session with TAPD work, even when the user does not mention TAPD. It activates for coding, implementation, fixes, debugging, refactoring, review, research, design, decision analysis, documentation, testing, releases, operations, repository maintenance, or other deliverables; explicit TAPD or work-item requests about requirements, defects, tasks, binding, or sync; contextual confirmations that bind a candidate or approve a proposed top-level item; and follow-up changes, questions, validation, or commits. It excludes casual conversation, unrelated acknowledgements, simple status checks, simple translations, time queries, and requests without an independent outcome. Mixed requests activate when they include substantive work. After binding, it maintains valuable child requirements and completes only children covered by successful Git commits. It selects an installed TAPD skill, authenticated CLI, or configured HTTP access by runtime capability.
---

# TAPD Sync

Connect the current work context to TAPD capabilities already configured in the runtime. Perform a read-only match first. Automatically maintain follow-up child requirements only after the user binds a parent work item.

## Establish the Work Context

- Treat `session`, `conversation`, `task`, and `thread` as the current continuous work context, regardless of the host runtime's terminology.
- Initialize as soon as the first substantive request provides enough repository, topic, or deliverable context for reliable matching. If it does not, wait until that context becomes available.
- Do not depend on a product-specific invocation prefix. Explicit invocation is optional and uses whatever syntax the host runtime supports.
- If the runtime loads this skill again in the same work context, reuse the existing state rather than initializing again.

## Core Constraints

- Do not let unavailable TAPD integration block the user's original task unless that task specifically requires TAPD.
- Never expose tokens, authorization headers, passwords, or configuration values.
- Do not create child requirements automatically before the user binds a parent work item.
- Do not request a second TAPD business confirmation before automatically creating child requirements or completing bound child requirements. Always honor the host runtime's permission controls for tools, commands, network access, and writes.
- Send the bind-or-create reminder only once, after completing the first request.

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
- `tapd_reminder_sent`: Whether the one-time reminder has been sent.
- `tapd_session_children`: Child requirements created or reused in this session and the user requests they represent.
- `tapd_partial_writes`: Work items that were created but failed post-write verification, recording workspace, parent ID or top-level absence, normalized title, item ID, and failure reason.
- `tapd_write_owner`: The stable identity of the single context currently responsible for TAPD writes.

Keep this state only in the current work context. Restore it after context compaction only from a trusted summary of this same context. Restore `tapd_project_name` only when its status, exact value, normalized value, and evidence remain available; otherwise rerun project-name resolution and treat the binding's project name as one evidence source rather than an automatic answer. A binding is restorable only when its complete workspace, project name, type, ID, and title remain available; mark every restored binding as unverified. Before the first TAPD write after restoration, resolve `tapd_identity` and `tapd_owner` again from the current adapter instead of trusting their restored values, rerun project-name conflict checks, then fetch the parent and confirm that it exists, remains open, belongs to a configured workspace, and does not conflict with the resolved project name. Mark the binding verified only after all checks succeed. If owner resolution fails, keep the binding unverified and skip TAPD writes while continuing the user's original task. If the parent check fails, clear the binding, allow a fresh read-only initialization, and perform no TAPD write until the user binds again. If project-name evidence conflicts, keep the binding unverified and ask the user to resolve the name before any TAPD write. Never claim that the binding persists into a new work context.

## Keep One TAPD Write Owner

- Make the primary work context the default `tapd_write_owner`.
- Treat forked contexts and subagents as read-only TAPD workers unless the current write owner completes an explicit ownership handoff for one specific write.
- Perform a handoff before delegated work starts: set `tapd_write_owner` to the delegate's stable context identity, provide the complete verified binding, the resolved `tapd_project_name` with its evidence, `tapd_owner` with its source, matching `tapd_partial_writes`, and exact write responsibility, and make the previous owner read-only for TAPD. If these changes cannot be represented as one exclusive handoff, do not delegate the write.
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
2. Query requirements, defects, and tasks in every workspace. Process all pages with the largest reasonable page size supported by the adapter. Retain terminal items as possible project-name evidence while excluding them from current matching candidates.
3. Query each workspace's workflow or field configuration for terminal states and exclude terminal work items from current matching candidates. Never apply one workspace's hardcoded status values to another workspace.
4. If an item's terminal state cannot be determined, mark its status as uncertain, lower its rank, and never treat it as a perfect match.
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

Show up to three candidates in this format, including the resolved project name, type, ID, title, match level, and a short reason:

```text
1. [Project] [Type #ID] Title - Perfect match/Related/Weak match - Reason
```

Do not label a workspace display name as the project when project-name resolution is ambiguous or missing. Show the workspace separately from the project-name evidence in that case. Do not pad the list with unreliable candidates when fewer than three exist. Initial matching is read-only and does not require TAPD business confirmation, but it must still honor host runtime permissions for tools and network access. Continue the user's original task without waiting for a binding.

## Remind Once After the First Request

Complete the user's first request, then append one concise reminder based on the matching result and set `tapd_reminder_sent` to true:

- When a perfect match exists, recommend the candidates in rank order and ask the user to bind one. Never choose for the user automatically.
- When no perfect match exists and `tapd_project_name` is resolved, use the most relevant workspace and propose `【{tapd_project_name.value}】{work_description}`, then state that the top-level work item can be created and bound automatically.
- When `tapd_project_name` is ambiguous or missing, present its evidence and ask the user to resolve the project name before proposing creation. Never substitute the workspace display name.
- When multiple workspaces are equally reasonable, ask the user to choose a workspace before creation. Never guess.
- If the user declines, ignores, or does not complete the binding, do not remind again in this session and do not create child requirements automatically.

## Bind the Parent Work Item

When the user confirms a binding by candidate number, ID, or explicit work item:

1. Fetch the item again and confirm that it exists, remains open, and belongs to a configured workspace.
2. Resolve `tapd_project_name` and compare it with any leading project prefix on the item. Treat normalized-equivalent spellings as the same project and keep the stable historical spelling. If non-equivalent evidence conflicts, ask the user to choose the project name before binding.
3. Accept any work-item type currently supported by the workspace as the parent.
4. Save `tapd_binding` with `tapd_project_name.value` only after project-name resolution succeeds. Do not create a child requirement for the binding message itself.

When the user confirms creation with the proposed title:

1. Resolve the workspace. If multiple workspaces remain equally reasonable, ask the user to choose first.
2. Require `tapd_project_name.status` to be `resolved`. If it is ambiguous or missing, ask the user to resolve it and do not create the item. Never use the workspace display name instead.
3. Resolve the workspace's work-item type named `TASK` or `任务`, case-insensitively. Use the workspace's default type when no such type exists.
4. Use `【{tapd_project_name.value}】{work_description}` as the title.
5. Require a resolved `tapd_owner`. If it is unresolved, skip creation, report the non-sensitive reason, and continue the user's original task.
6. Check `tapd_partial_writes` for the top-level logical idempotency key before issuing a create. If a recorded item now passes verification, reuse it and continue at step 9 without creating another item.
7. Set the owner to `tapd_owner.value`, the start date to the runtime's current date, and the due date to one calendar day later. Calculate dates in the runtime timezone.
8. Create a top-level requirement without a parent, then verify the returned or fetched owner and confirm that the item has no parent.
9. Save the newly created or recovered item as `tapd_binding` with `tapd_project_name.value` only after every required verification succeeds.

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

## Create or Reuse Child Requirements Automatically

For a valuable request, perform these steps before starting the user's requested work without asking for another TAPD business confirmation. Continue to honor host runtime permission prompts for tools, network access, and writes:

1. Confirm that the current context is `tapd_write_owner` and still has a complete, verified binding. Otherwise skip the TAPD write and continue the user's requested work.
2. Confirm that `tapd_project_name.status` is `resolved` and its value matches `tapd_binding.project_name`. If not, skip the TAPD write, report the project-name conflict, and continue the user's requested work.
3. Generate a concise, specific, and verifiable `【{tapd_project_name.value}】{work_description}` title.
4. Check `tapd_partial_writes` for the child logical idempotency key before querying reusable items or issuing a create. If a recorded child now passes verification, reuse it and continue at step 12 without creating another item.
5. Query every page of the bound parent's open child requirements and compare normalized titles. Reuse only an open title match whose parent relationship and semicolon-normalized owner both verify against `tapd_binding` and `tapd_owner.value`. If matching items exist but none pass verification, do not reuse them, do not create a duplicate, report the conflict, and continue the user's original task.
6. Before issuing a new create, query every page and status for the logical idempotency key and record all matching item IDs. Do not reuse a closed match for a new request.
7. Prefer the selected TAPD skill or CLI's generic create-child-requirement operation. Require it to create a requirement in TAPD's unified work-item model, use the item in `tapd_binding` as the parent regardless of its displayed type, and verify the returned parent relationship. Never substitute a legacy task creation operation.
8. When falling back to HTTP, follow the current official TAPD API and unified work-item model, create the child through `/stories`, and set `parent_id`. Never claim success if the API does not support the current parent relationship.
9. Dynamically resolve the `workitem_type_id` named `TASK` or `任务`. Use the workspace's default work-item type when it is absent. Never hardcode a type ID from another workspace.
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
- When a create request times out or returns an ambiguous result, prefer an adapter-provided idempotency key or returned ID. Otherwise query every page and status for the logical key and compare matching IDs with the pre-create snapshot. Treat only a newly appeared matching ID as the result of this attempt; a pre-existing closed item is not reusable and is not evidence of success. Retry only after confirming that no new item was created.
- Continue processing other workspaces when one workspace fails, and record failures separately.
- Never claim successful synchronization after a failed TAPD create or transition.
- Never retry a create merely because owner verification failed; preserve the `tapd_partial_writes` record because the returned work-item ID proves that the write may already exist.
- Never write when TAPD is unavailable or the current context is not the write owner. Except for a user-confirmed top-level requirement creation, require a complete binding before every write.

## Summarize TAPD Results

After any TAPD write, include these details concisely in the original task summary:

- Created or reused work-item ID and title.
- Parent work-item ID.
- Current status.
- Work items completed because of a code commit.
- Any create, owner verification, bind, or transition failure and its non-sensitive reason.

Do not add an empty TAPD section when TAPD is configured and no write occurred.

When the adapter is unavailable, include this message once in the first completed-work summary:

> TAPD is not configured on this device, so sync is disabled. Once configured, I can automatically match and maintain work items. Ask me when you want help setting it up.
