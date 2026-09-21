# Track Valuable Intermediate Outcomes

Read before the first tracked stage and reuse these rules throughout delivery. Use the user's configured integration and its native work-item model; never require TAPD or install a second tracking mechanism.

## Identify and Bind Before Work

At planning and at every stage boundary, identify each distinct result with a reviewable output and acceptance criterion. Track all such results, including work discovered during execution. Do not dismiss research, design, verification, or review as routine merely because they are intermediate stages or cannot ship alone.

| Stage | Examples of valuable outcomes |
| --- | --- |
| Preparation | A reusable isolated environment or independently verifiable migration readiness result |
| Research | Root-cause report, dependency compatibility assessment, or measured feasibility result |
| Design | Chosen architecture, interface contract, or migration plan with acceptance criteria |
| Implementation | A coherent feature, fix, or independently testable behavior |
| Verification | Compatibility matrix, regression evidence package, or acceptance result |
| Review | Review report with dispositions or scoped remediation and re-review evidence |
| Closeout | Reviewable delivery package, release notes, or operational handoff |

These are examples, not mandatory template tickets. A routine command, source read, repeated test run, acknowledgement, or formatting adjustment stays progress on its existing item. Internal steps for one outcome share one item even across stage boundaries. A separate result with its own acceptance criterion gets its own item.

Once scope and acceptance are known, bind or create the item before substantive work, without another business confirmation. A finished artifact is completion evidence, not a prerequisite for creation. For an outcome discovered mid-stage, do this as soon as it is identified. After late binding, reconcile earlier outcomes from preserved evidence and label backfilled progress honestly.

Persist the delivery/outcome identity, scope, acceptance criterion, platform/project/parent, bound item ID and URL, owner, type, actual status, evidence, and synchronization result in the existing private ledger's evidence fields. Keep identity stable through title changes, retries, turns, and context restoration; do not add keys to the fixed decision schema. Keep a single write owner; delegates return outcomes and evidence to that owner.

Before creating, restore persisted bindings and partial writes by exact ID. Continue a verified nonterminal binding directly through its lifecycle, even if its title changed; do not rediscover or recreate it. Only when no binding can be recovered, search all relevant pages for an equivalent open item under the bound parent. Verify scope, owner, type, and relationship before reuse; title similarity alone is insufficient. Require one unambiguous match or verified creation fields. Use the integration's idempotency and ambiguous-write recovery before retrying. A verified completed item for the same delivery and unchanged outcome is restored without creation, reopening, or another completion write. A closed item from unrelated work is not reusable for a new outcome.

Use a direct child or the platform's documented equivalent linked work item with a verified parent relationship. If that relationship cannot be represented or read back, record child tracking as unavailable; do not fabricate a child or silently substitute a comment for a required work item.

## Follow Each Item Through Its Workflow

Fetch current item and type-specific workflow metadata before a transition. If the intended status already matches the verified current state, omit the transition and record only new progress. Use only a unique legal mapping or an unambiguous supported transition path, verifying every step. Never hardcode a status label, skip a required approval, or treat a phase name as a workflow state.

| Observed event | Required update |
| --- | --- |
| Work starts | Record scope, acceptance criteria and next action; transition into the mapped active state. |
| Meaningful progress | Update evidence, acceptance progress and next action on the same item. |
| Work is blocked | Record the concrete blocker and resumption condition; use the mapped blocked state when supported. |
| Work resumes | Re-fetch current state, record resolution and next action, and transition back into the mapped active state. |
| Acceptance is satisfied | Attach durable evidence and perform the mapped successful completion transition only when its completion gate passes. |

A code-bearing item's completion gate requires both satisfied acceptance criteria and a successful commit covering its outcome. A non-code item's gate requires a durable artifact or explicit acceptance evidence; it does not require a code commit. Uncommitted code may enter active or blocked states; the commit gate restricts successful completion only. Mixed outcomes use the code gate. Never complete the parent merely because its children or a delivery phase completed.

When no unique legal status mapping exists, keep the workflow state and record the observed progress or blocker using supported activity/fields, with the missing mapping noted. Skipping or withdrawing work records its reason and pending disposition; it is not successful completion.

Read back every mutation, including owner, relationship, activity payload and status as applicable. Persist stable event IDs before activity writes and reconcile uncertain results before retrying. A timeout or failed read-back remains unsynchronized even if the request may have succeeded. Retry only within the integration's bounded policy; credentials, permissions, ambiguous ownership, and unsupported workflows never justify guessed writes.

## Reconcile at Stage Boundaries and Closeout

Compare all identified valuable outcomes with their persisted item bindings, actual statuses and acceptance evidence at each boundary, after restoration, and before final delivery. Repair missing bindings and pending updates when supported; restore completed same-delivery items without duplicates. Do not reopen an accepted outcome for a repeated instruction or status question.

Report verified clickable links and actual states for created, reused, advanced, blocked, completed, or restored items, plus unresolved tracking actions and reasons. Put the parent directly below the HTML summary and corresponding children below their stage, review, or decision-node headings through `trackingItems` and `decisionTracking`; show the actual platform workflow status and link both title and status to the item; the plain-text audit alone is insufficient. When URL resolution fails, show the item title and explicit reason without inventing a link. Keep synchronization failures separate from work completion. Unavailable optional tracking does not block delivery unless successful synchronization is an explicit acceptance criterion; it must remain visible in the report. Reconciliation is not permission to manufacture missing evidence or declare all work complete.
