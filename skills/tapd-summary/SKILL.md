---
name: tapd-summary
description: Generate a read-only TAPD daily work summary and next-day plan only when the user explicitly invokes or selects `tapd-summary`. Trigger for `$tapd-summary`, `/tapd-summary` where the host supports it, a host skill selection, or a direct instruction to use the tapd-summary skill. Verify all configured workspaces, pagination, current-user scope, terminal transitions, and project grouping. Never invoke automatically for ordinary TAPD, task summary, daily report, today's tasks, tomorrow's plan, 日报, 今日任务, 明日计划, coding, or work-session requests.
---

# TAPD Summary

Produce a verified TAPD summary without changing TAPD. Treat every rule in this skill as mandatory.

## Enforce the Invocation Gate

Before accessing TAPD, confirm that the current user request explicitly invokes this skill by one of these mechanisms:

- The request contains `$tapd-summary`.
- The host reports that the user selected the `tapd-summary` skill.
- The user explicitly says to use `tapd-summary` for the request.

If none applies, stop this skill immediately. Do not discover adapters, query TAPD, or produce a TAPD summary. Never infer invocation from words such as "TAPD", "summary", "daily report", "today's tasks", or "tomorrow's plan".

## Apply Non-Negotiable Safety Rules

- Keep the entire workflow read-only.
- Never create, update, bind, delete, transition, or otherwise mutate a TAPD entity.
- Never invoke a write-capable workflow from `tapd-sync` or another skill.
- Never print tokens, passwords, authorization headers, configuration values, or internal identity records.
- Never install a TAPD tool, start authentication, expand runtime permissions, or connect to a virtual machine.
- Stop and report the non-sensitive reason when identity, dates, or completion evidence cannot be verified. Use the required unresolved-project group when only project evidence is missing; never fabricate a project name.

## Resolve the Requested Report

1. Resolve the target date independently: use the user's explicit date when present; otherwise use the runtime's current date in the runtime timezone. Use one half-open interval, `[start_of_day, start_of_next_day)`, for every timestamp comparison.
2. Resolve the requested sections independently: follow explicit section requests; otherwise select both the daily summary and the next-day plan.
3. When the user requests only the daily summary, produce only that section.
4. When the user requests only the next-day plan, produce only that section, using the independently resolved target date.
5. Treat a next-day plan for any target date as a live report of work created on that date that remains unfinished at query time. Do not reconstruct a historical open-state snapshot unless the user explicitly asks for one and the adapter can prove it.

## Select One Read-Only TAPD Adapter

Evaluate adapters in this order:

1. Inspect an installed TAPD skill when the runtime exposes one. Read its complete instructions first and consider only read operations.
2. Otherwise or when that skill lacks a required read capability, inspect an installed and authenticated TAPD CLI. Read its actual `--help`, authentication status, filters, pagination, and entity commands before querying. Do not assume its executable name or arguments.
3. Otherwise or when that CLI lacks a required read capability, inspect configured HTTP access only when the endpoint, token, and at least one workspace are already present. Consult the current official TAPD API documentation before choosing endpoints or fields. Report only whether required configuration names exist, never their values.
4. Before selecting an adapter, require it to resolve the current user, enumerate every configured workspace, read every relevant work-item model and page, resolve per-workspace terminal states, read required completion evidence, and refresh individual candidate statuses. If any capability is missing, continue to the next adapter instead of locking in a partial adapter.
5. Select the first adapter that passes the complete capability preflight and keep it for the whole request. Do not combine partial results from different adapters.
6. If no adapter passes, report that a complete TAPD summary is unavailable and stop. Do not fall back to guessed or cached work items.

For a skill or CLI adapter, use its documented configured-workspace enumeration and reject the adapter when it cannot prove that the enumeration is complete. For HTTP, prefer `TAPD_WORKSPACE_IDS` when configuration exposes multiple comma-separated workspace IDs and trim every value; fall back to `TAPD_WORKSPACE_ID` only when the plural setting is absent. Query every configured workspace.

## Resolve the Current User

- Resolve the authenticated user from the selected adapter before filtering work items.
- Use adapter-documented creator and owner fields. Do not substitute a display name, email address, token subject, or undocumented internal ID.
- Normalize semicolon-delimited owner responses by splitting, trimming, and removing empty values before exact comparison.
- If the adapter cannot map the authenticated user reliably to creator and owner fields, report that the current-user scope cannot be verified and stop.

## Read Every Relevant Work-Item Model

For every configured workspace:

1. Resolve its display name for container identity only. Never treat that name as the project name.
2. Query every type exposed by the unified requirements or stories model, including generic requirements and task-like work-item types; also query defects or bugs and the separate legacy Task model. Do not filter the unified model down to requirement types only.
3. Follow every page using the largest reasonable supported page size. Continue until the adapter proves there is no next page.
4. Avoid querying two aliases that return the same underlying model. Do not double-count an item merely because an adapter exposes it through multiple read commands.
5. Query the workspace's workflow or field metadata to identify terminal states. Never reuse hardcoded terminal values across workspaces.
6. Fetch status histories or change logs needed to verify completion events.
7. Continue with other workspaces after an isolated read failure, but mark the final result incomplete.

## Build the Daily Summary

Build two internal sets for the target day:

### Created Set

Include a work item only when:

- Its documented creation timestamp is inside the target-day interval.
- Its documented creator exactly matches the current user.

### Completed Set

Include a unified requirement, story, or defect only when all of these are true:

- Its documented owner includes the current user.
- Its completion timestamp is inside the target-day interval.
- Its status history proves a transition into a workspace-defined successful terminal state inside the same interval.

For a legacy Task, require the documented owner to include the current user, the documented `completed` field to fall inside the interval, and the current status to be terminal. Cross-check status history when the legacy API exposes it; do not reject an otherwise verified legacy Task solely because that model exposes no history endpoint.

Never treat an updated timestamp, arbitrary status change, closed-looking label, or terminal status without a dated completion event as proof of completion.

## Build the Next-Day Plan

Start only from the Created Set for the target day. Immediately before rendering:

1. Fetch the current status of every candidate again.
2. Resolve that status against the candidate's workspace workflow.
3. Include only candidates that are currently non-terminal.
4. Exclude completed items even when they were incomplete in an earlier page or query result.

Do not include older unfinished work unless the user explicitly broadens the plan beyond the default rule.

## Deduplicate by Entity Identity

- Use workspace, underlying model, and work-item ID as the identity key.
- Render one entry when the same work item appears in both the Created Set and Completed Set.
- Preserve separate entries when model or ID differs, even if titles are identical.
- Never deduplicate by normalized title alone.
- Keep IDs internal; never render them in the final summary.

## Resolve Projects Independently from Workspaces

For every selected work item:

1. Extract a leading `【project name】` prefix when present.
2. Inspect the title body, parent work item, description, module, and labels for independent project evidence even when a prefix exists.
3. Treat a prefix as invalid when it equals a TAPD workspace display name or conflicts with consistent independent project evidence.
4. When the prefix is missing or invalid, accept an inferred project only when the independent evidence is mutually consistent and has no conflicting project name.
5. Preserve the established spelling of the resolved project name. Use case-insensitive comparison with whitespace and hyphens removed only to detect equivalent names.
6. Group unresolved items under `未识别项目`. Never replace the missing project with a workspace name.

The workspace answers where an item is stored. The project prefix and independent work-item evidence answer which project it belongs to. Never collapse these concepts.

## Render the Exact Output Contract

- Use unordered lists only for the summary body.
- When both sections target the runtime's current day, use `今天` and `明日计划` as the top-level list items. For another explicit date, preserve the user's section labels when supplied; otherwise use the exact date and `次日计划`.
- When only one section is requested, omit the section wrapper and start with project list items, matching the established compact format.
- Under each project, render only the original title after removing one leading `【...】` prefix and adjacent whitespace. Remove the prefix even when it was an invalid workspace-name prefix; do not rewrite the remaining title body.
- Do not render IDs, statuses, types, Created/Completed labels, counts, workspace names, or explanatory suffixes.
- Preserve distinct duplicate titles when their work-item identities differ.
- Do not add prose before or after a complete result.
- For an empty requested section, render `无符合条件的工作项` at that section's title level.

Use this shape when both sections are requested:

```text
- 今天
  - Project A
    - First title
- 明日计划
  - Project A
    - Unfinished title
```

Use this shape when one section is requested:

```text
- Project A
  - First title
```

## Verify Before Responding

Before rendering a complete result:

1. Confirm every configured workspace was attempted.
2. Confirm every relevant model was attempted and every page was exhausted.
3. Confirm creator and owner comparisons use the resolved current user.
4. Confirm completion classifications follow the model-specific evidence rules.
5. Confirm every next-day candidate was refreshed against its workspace's current terminal states.
6. Confirm the union identity count equals `created + completed - intersection` before project grouping.
7. Confirm stripping project prefixes did not change title bodies.
8. Confirm no workspace name was substituted for an unresolved project.

If any required verification fails, do not claim a complete summary. Return the verified partial summary body only when useful, then place one concise completeness warning outside the list. Name the failed workspace or evidence category without exposing IDs or credentials.
