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
- `tapd_identity`: The token user's ID, English ID, or other owner identifier accepted by the selected adapter.
- `tapd_workspaces`: Configured workspace IDs and project names.
- `tapd_candidates`: Up to three candidates ranked by relevance.
- `tapd_binding`: The bound parent's workspace, project name, type, ID, and title.
- `tapd_reminder_sent`: Whether the one-time reminder has been sent.
- `tapd_session_children`: Child requirements created or reused in this session and the user requests they represent.
- `tapd_write_owner`: The stable identity of the single context currently responsible for TAPD writes.

Keep this state only in the current work context. Restore it after context compaction only from a trusted summary of this same context. A binding is restorable only when its complete workspace, project name, type, ID, and title remain available; mark every restored binding as unverified. Before the first TAPD write after restoration, fetch the parent again and confirm that it exists, remains open, and belongs to a configured workspace. Only then mark the binding verified. Otherwise clear it, allow a fresh read-only initialization, and perform no TAPD write until the user binds again. Never claim that the binding persists into a new work context.

## Keep One TAPD Write Owner

- Make the primary work context the default `tapd_write_owner`.
- Treat forked contexts and subagents as read-only TAPD workers unless the current write owner completes an explicit ownership handoff for one specific write.
- Perform a handoff before delegated work starts: set `tapd_write_owner` to the delegate's stable context identity, provide the complete verified binding and exact write responsibility, and make the previous owner read-only for TAPD. If these changes cannot be represented as one exclusive handoff, do not delegate the write.
- Return ownership only after the delegate reports a final write result or a confirmed no-write result and can no longer retry. The primary context remains read-only until it observes that explicit return.
- Allow only one context to create or complete TAPD work items for a given user request. Other contexts return their work result to the write owner without writing to TAPD.
- If write ownership or the binding snapshot is incomplete, do not infer either one. Continue the user's original task without the TAPD write.

## Select TAPD Capabilities by Runtime

Probe capabilities instead of detecting or branching on the host product name. Select one available adapter in this order and continue using it throughout the work context:

1. **TAPD skill**: If the runtime can discover and invoke an installed TAPD skill, such as `tapd-openapi`, read its complete instructions first and follow its authentication, workspace, and API rules.
2. **TAPD CLI**: Otherwise, find an installed and authenticated TAPD CLI. Inspect the actual command's `--help`, authentication status, and subcommands before using it. Do not assume its executable name or arguments. Do not install it or start a new login automatically.
3. **Environment and HTTP**: Otherwise, read the runtime TAPD configuration. Prefer `TAPD_WORKSPACE_IDS`, split it on commas, and trim whitespace. Fall back to `TAPD_WORKSPACE_ID` when the list is unset. Use HTTP only when `TAPD_API_ENDPOINT`, `TAPD_TOKEN`, and at least one workspace ID are present. Consult the current official TAPD API documentation before calling endpoints. Never guess paths or fields.
4. **Unavailable**: If no method is usable or the configuration is incomplete, set the adapter to unavailable and continue the user's original task.

Report only whether configuration names are available and which names are missing. Never display their values. If an adapter exists but cannot perform the required operations, continue to the next configured adapter. Never install tools, start authentication, bypass runtime permissions, or expand runtime access automatically.

## Initialize and Match Work Items

After selecting an adapter, perform this read-only initialization:

1. Resolve the token identity and project names for every configured workspace.
2. Query requirements, defects, and tasks in every workspace. Process all pages with the largest reasonable page size supported by the adapter.
3. Query each project's workflow or field configuration for terminal states and exclude closed work items. Never apply one project's hardcoded status values to another project.
4. If an item's terminal state cannot be determined, mark its status as uncertain, lower its rank, and never treat it as a perfect match.
5. Derive the work-context topic from the first substantive request, current repository or project name, branch name, explicit work-item identifiers, and intended deliverable.
6. Rank items using workspace, title, description, module, labels, type, and actual delivery goal.

Treat these signals as progressively weaker evidence:

1. An explicit TAPD ID or exact title supplied by the user.
2. Matching repository or project context and the same delivery goal.
3. A title, module, or label describing the same goal.
4. Isolated shared keywords.

Mark an item as a perfect match only when it represents the same actual delivery goal. Treat insufficient evidence conservatively as a non-perfect match.

Show up to three candidates in this format, including project, type, ID, title, match level, and a short reason:

```text
1. [Project] [Type #ID] Title - Perfect match/Related/Weak match - Reason
```

Do not pad the list with unreliable candidates when fewer than three exist. Initial matching is read-only and does not require TAPD business confirmation, but it must still honor host runtime permissions for tools and network access. Continue the user's original task without waiting for a binding.

## Remind Once After the First Request

Complete the user's first request, then append one concise reminder based on the matching result and set `tapd_reminder_sent` to true:

- When a perfect match exists, recommend the candidates in rank order and ask the user to bind one. Never choose for the user automatically.
- When no perfect match exists, use the most relevant workspace to propose `【{project_name}】{work_description}` and state that the top-level work item can be created and bound automatically.
- When multiple workspaces are equally reasonable, ask the user to choose a project before creation. Never guess.
- If the user declines, ignores, or does not complete the binding, do not remind again in this session and do not create child requirements automatically.

## Bind the Parent Work Item

When the user confirms a binding by candidate number, ID, or explicit work item:

1. Fetch the item again and confirm that it exists, remains open, and belongs to a configured workspace.
2. Accept any work-item type currently supported by the project as the parent.
3. Save `tapd_binding`. Do not create a child requirement for the binding message itself.

When the user confirms creation with the proposed title:

1. Resolve the workspace. If multiple projects remain equally reasonable, ask the user to choose first.
2. Resolve the project's work-item type named `TASK` or `任务`, case-insensitively. Use the project's default type when no such type exists.
3. Use `【{project_name}】{work_description}` as the title.
4. Set the owner to `tapd_identity`, the start date to the runtime's current date, and the due date to one calendar day later. Calculate dates in the runtime timezone.
5. Create a top-level requirement without a parent and save it as `tapd_binding` after success.

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
2. Generate a concise, specific, and verifiable `【{project_name}】{work_description}` title.
3. Query every page of the bound parent's open child requirements and compare normalized titles. Reuse an existing match instead of creating a duplicate.
4. Before issuing a new create, query every page and status for the logical idempotency key and record all matching item IDs. Do not reuse a closed match for a new request.
5. Prefer the selected TAPD skill or CLI's generic create-child-requirement operation. Require it to create a requirement in TAPD's unified work-item model, use the item in `tapd_binding` as the parent regardless of its displayed type, and verify the returned parent relationship. Never substitute a legacy task creation operation.
6. When falling back to HTTP, follow the current official TAPD API and unified work-item model, create the child through `/stories`, and set `parent_id`. Never claim success if the API does not support the current parent relationship.
7. Dynamically resolve the `workitem_type_id` named `TASK` or `任务`. Use the project's default work-item type when it is absent. Never hardcode a type ID from another project.
8. Set the owner to `tapd_identity`, the start date to the runtime's current date, and the due date to one calendar day later.
9. Add the created or reused item and its corresponding user request to `tapd_session_children`, then continue the user's requested work.

Attach every automatic child directly to the session's bound parent. Never turn the previous turn's child into the next turn's parent.

If the token identity cannot be resolved, do not create the child because the owner requirement cannot be satisfied. Report the non-sensitive reason and continue the user's original task.

## Complete Corresponding Children After Code Commits

A lifecycle hook is not required. Whenever the write owner directly observes a successful code commit during the work:

1. Inspect the commit diff and the delivery goal represented by each child in `tapd_session_children`.
2. Identify every child actually covered by the commit, including children created in earlier turns but completed by this commit.
3. Query the currently allowed workflow transitions in each project.
4. Select a legal terminal state that the project's workflow metadata identifies as successful completion. Prefer states explicitly named `Done`, `已完成`, or `完成`, and complete every child actually covered by the commit.
5. Never complete children that the commit does not cover. Never complete the bound parent automatically.

Keep child requirements in their current state when no code commit occurs. If workflow metadata does not identify a successful completion state, multiple completion states remain ambiguous, or no legal transition exists from the current state, never guess another closed state. Record the reason and continue delivering the code result.

## Keep Writes Traceable and Idempotent

- Retry transient read failures a limited number of times.
- Treat workspace, parent ID or top-level absence, and normalized title as the logical idempotency search key, not by itself as proof that an item came from the current create attempt.
- When a create request times out or returns an ambiguous result, prefer an adapter-provided idempotency key or returned ID. Otherwise query every page and status for the logical key and compare matching IDs with the pre-create snapshot. Treat only a newly appeared matching ID as the result of this attempt; a pre-existing closed item is not reusable and is not evidence of success. Retry only after confirming that no new item was created.
- Continue processing other workspaces when one workspace fails, and record failures separately.
- Never claim successful synchronization after a failed TAPD create or transition.
- Never write when TAPD is unavailable or the current context is not the write owner. Except for a user-confirmed top-level requirement creation, require a complete binding before every write.

## Summarize TAPD Results

After any TAPD write, include these details concisely in the original task summary:

- Created or reused work-item ID and title.
- Parent work-item ID.
- Current status.
- Work items completed because of a code commit.
- Any create, bind, or transition failure and its non-sensitive reason.

Do not add an empty TAPD section when TAPD is configured and no write occurred.

When the adapter is unavailable, include this message once in the first completed-work summary:

> TAPD is not configured on this device, so sync is disabled. Once configured, I can automatically match and maintain work items. Ask me when you want help setting it up.
