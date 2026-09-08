# HTML Report Rendering

Read this when starting the presentation record or rendering a terminal delivery report. The evidence and decision-tree requirements remain in [execution-report.md](execution-report.md).

## Inputs and Output

Keep the report inputs, snapshot, and service state in the same Git-ignored agent-private planning directory:

- `{task-summary}-decision-tree.json`: the original version-1 decision ledger, with its exact existing schema and update protocol.
- `{task-summary}-report.json`: presentation inputs collected during this delivery; it does not replace decision evidence or change the ledger schema.
- `{task-summary}-report.html`: the self-contained report delivered to the user.
- `{task-summary}-service.json`: private service identity, address, and management token, created by the service with owner-only permissions. Never paste its token into chat or the report.

Apply the ledger's existing Git-isolation checks to the two presentation artifacts as well. Runtime reports stay out of commits and PR diffs unless the user explicitly requests the exact files. Do not publish or upload a report merely to make it viewable.

Capture `startedAt` when delivery begins. Capture `endedAt` at successful closeout or the current pause, after reconciling the ledger and evidence. Use RFC 3339 timestamps with a timezone. Elapsed time is wall-clock time, including waiting and pauses; it is not model compute time. Preserve the original start on continuation and refresh the cutoff on each terminal report. If an earlier start cannot be verified, use an empty string and show timing as unrecorded. Never use the first decision timestamp as an invented task start.

The presentation input has this shape. The following is an example, not evidence for a real delivery:

```json
{
  "status": "completed",
  "summary": "All mapped acceptance criteria passed.",
  "analysis": "Preserve the decision schema while adding a live report view.",
  "repository": "owner/repository",
  "branch": "codex/example",
  "workdir": "/absolute/project-worktree",
  "reviewedAt": "2026-09-07T10:22:00+08:00",
  "startedAt": "2026-09-07T10:00:00+08:00",
  "endedAt": "2026-09-07T10:24:18+08:00",
  "context": [
    { "label": "Source branch", "value": "main" },
    { "label": "Starting commit", "value": "0123456789abcdef0123456789abcdef01234567" },
    { "label": "Task branch", "value": "codex/example" },
    { "label": "Worktree", "value": "/absolute/project-worktree" }
  ],
  "stages": [
    {
      "title": "Existing schema compatibility",
      "summary": "The report can consume the original decision ledger without migration.",
      "evidence": ["Decision D-04; original-ledger compatibility check passed."]
    }
  ],
  "reviews": [
    {
      "severity": "P2",
      "finding": "Report content could be interpreted as HTML.",
      "fix": "Escape all data before rendering.",
      "verification": "The injection regression passed after the repair.",
      "status": "fixed",
      "reviewedAt": "2026-09-07T10:18:00+08:00",
      "fixedAt": "2026-09-07T10:20:00+08:00",
      "verifiedAt": "2026-09-07T10:22:00+08:00",
      "evidence": ["Decision D-07; repaired diff re-reviewed."]
    }
  ],
  "reviewSummary": "Re-review found no remaining actionable recommendations.",
  "verification": [
    { "command": "node --test tests/report.test.mjs", "result": "Direct coverage: 5 passed, 0 failed." }
  ],
  "pr": {
    "number": 42,
    "url": "https://example.invalid/pull/42",
    "state": "draft",
    "base": "main",
    "head": "codex/example"
  },
  "records": [
    "Validation status: passed after fixes.",
    "Draft PR read-back: URL https://example.invalid/pull/42; state draft; base main; head codex/example."
  ]
}
```

Use `running` during execution, `completed` only after the existing successful-delivery preflight, and `paused` for a real risk-gate pause. Update `endedAt` to the evidence cutoff each time presentation data is saved, preserving `startedAt`; running status never implies successful delivery. The renderer checks structure and some contradictions; it cannot establish whether tests ran, PR read-back occurred, or acceptance criteria passed. Supply every applicable status record from the execution-report contract in `records`, not just those shown in the short example. Include tracking event payloads and residual risks there. The complete audit is always expanded in normal page flow.

Fill `repository` from verified repository/remote identity without credentials, `branch` from the actual task branch, `workdir` from the absolute current worktree path, and `pr.number` from verified PR read-back. Use `analysis` for a short task analysis, not a second execution log. Existing reports without these optional presentation fields remain readable and show unknown metadata honestly; do not duplicate the same branch/workdir in `context`. Capture the report-level `reviewedAt` and each finding's `reviewedAt`, `fixedAt`, and `verifiedAt` from actual events as RFC 3339 strings. Empty or missing times show as unrecorded; never fabricate them from the report cutoff. Review/fix/reverification times must be chronological.

After verified draft-PR creation, append the short post-merge cleanup reminder in chat. Otherwise chat closeout only needs a short result and the live report, offline snapshot, original JSON, and verified PR links, plus any material blocker or required action. Preserve detailed evidence in the report instead of repeating it in chat.

`stages`, `reviews`, `verification`, and `records` are arrays. Keep empty arrays when no entries exist; `reviewSummary` must explain whether review ran and found nothing or has not run. A review entry's `status` is `fixed`, `unresolved`, or `deferred`; describe a missing repair or verification honestly in the corresponding strings. Only `fixed` findings are compatible with completed delivery. Sort findings by severity. Omit `pr` entirely when no verified PR exists. Never insert a placeholder PR link.

Use the current session language for all human-readable input. The renderer provides English and Simplified Chinese interface labels according to `session.language`; for another language, pass a `labels` object translating every key in the renderer's `copy.en` map. `labels` also allows explicit destination wording overrides. Technical literals and status enum values remain unchanged. For ledger text recorded in an earlier language, use the exported `renderExecutionReport` function with a display-only clone whose human-readable values have been translated; preserve all fixed keys, IDs, references, timestamps, technical literals, and decision ordering. Reconcile that clone with the original ledger before rendering and never persist it over the original. The standard CLI renders the ledger as recorded and does not translate content.

An optional `notice` string appears above the report. Use it to clearly label mock data in a visual preview. Do not present a preview's durations, PRs, or test results as real delivery evidence.

## Render and Verify

### Start, Inspect, and Stop the Live Service

Use Node.js 22 or later and the bundled dependency-free service. First initialize both JSON inputs with real metadata, `status: "running"`, empty arrays for unfinished work, and honest summary/review status. Start it through the host's managed background process/session facility:

```bash
node /absolute/skill/scripts/serve-execution-report.mjs start \
  --ledger /absolute/project/.codex/plans/task-decision-tree.json \
  --report /absolute/project/.codex/plans/task-report.json \
  --output /absolute/project/.codex/plans/task-report.html \
  --state /absolute/project/.codex/plans/task-service.json
```

The start command runs in the foreground until stopped; retain its host process/session handle. It binds only `127.0.0.1`, selects an available port by default (`--port` can request one), and prints a receipt containing the URL, PID, and paths without the management token. Open that verified HTTP URL instead of the file preview for live updates. A repeat start using the same state and input paths reuses the running service; different tasks need separate state files. Do not create a global daemon, autostart entry, or external deployment.

```bash
node /absolute/skill/scripts/serve-execution-report.mjs status --state /absolute/project/.codex/plans/task-service.json
node /absolute/skill/scripts/serve-execution-report.mjs stop --state /absolute/project/.codex/plans/task-service.json
```

Status verifies the instance and reports the last successful revision/update time and any input/render error. Stop uses the private state token to request shutdown of this exact service; verify the state file disappears and the URL no longer responds. Ctrl-C or SIGTERM through the retained process handle also shuts it down cleanly. Never use broad process kills or trust an old PID alone. If a state file survives a crash, verify the recorded instance is no longer reachable and inspect its recorded process; then remove only the stale state file and restart. Keep the JSON inputs and offline HTML snapshot.

The service checks both inputs every 500ms, validates and renders a complete update, writes the offline HTML atomically, and notifies open pages to refresh while preserving scroll position. Save presentation inputs atomically, and continue updating the ledger through its existing writer. Invalid or partially written input leaves the last valid page/snapshot available; the live page displays an update warning until recovery. The served page uses a same-origin event stream; the saved HTML has no network dependency. Source files and decisions are never edited by the service.

Keep the user-facing report service running through task continuations and while delivering its live link. Stop temporary test services after validation. Stop the task service when the user requests it, when cleaning the task's worktree, or when explicitly ending its live reporting session. Before a later continuation or final reply, check status and reuse the instance; if hosting is unavailable, disclose it and link the offline snapshot. A live URL is local to the machine where the service runs.

### Visual Reference

The report's visual baseline is the user-selected Marrs Green direction, implemented in [execution-report.css](../assets/execution-report.css). Use `#008C8C` as the primary accent, `#006764` for accent text and selected-option tags with white lettering, `#EDF7F5` for recommendation and success tags, white for the page, and `#242B2A` for body text. Use `#EAF5F3` for full-width chapter banners and selected-option explanation blocks. Chapter numbers are 30px and bold. Amber and red are reserved for warning and unresolved states. Separate content using spacing, without divider lines, outlines, or decorative separator characters. Preserve punctuation inside original data and technical literals. This is a new report-specific visual baseline, not a reproduction of an external product.

Use system sans-serif typography for headings and prose, and system monospace for commands and decision literals. Keep the overview compact: a 24px desktop task title (21px on narrow screens), one outcome sentence, and separate rows for duration, timestamps, PR information, and branch references. Use an unframed, left-aligned reading column, with a right sidebar for the decision outline. Avoid justified or space-between alignment, narrow split content columns, and forced line breaks within values. All sections, context, and audit evidence are fully expanded, without collapsible content or nested scroll regions. Limit links, hover/focus states, and optional list scrolling to the decision outline. Show PR URLs as plain text; wrap long values only when needed to fit.

Chapter headings have pale green backgrounds spanning the report width including its side padding, and stick at the viewport top. The title of the current context, stage, verification, review, decision, or audit block sticks immediately below the chapter heading, bounded by its own content. At every level, show a subtle lower shadow only while the heading is actually pinned; remove it before pinning, on reverse scrolling, and when its container pushes it out of the sticky position. Use opaque backgrounds and separate stacking layers to prevent overlapping headings. Small field labels and option tags remain in normal content flow.

Render the decision tree as a vertical timeline with 12px round Marrs Green nodes, soft outer rings, and 2px pale green segments connecting consecutive node centers. Stop the connector at the last node; this timeline connection is the exception to the report's no-divider styling. Keep enough left padding for markers and lines to remain separate from the text on narrow screens. Each ledger decision appears once, in execution order, with original creation and update times above its title. Show its immutable ID, type, parent reference (or root state), and full detail fields inline. List every option with its ID, full label and description; use independent visible tags for recommended and selected options. Both tags appear when the same option satisfies both conditions. Unselected alternatives remain visible, and recommendation never implies selection. Favor full-width option rows and nearby labels/values to reduce unnecessary wrapping. Preserve `schemaVersion`, all session fields, and the ledger path in the audit block; `task.summary` is the report title.

Place the existing ledger `reason` in a pale green explanation block immediately below the selected option's description, once per decision. Preserve its complete text rather than inventing an explanation. When selection is pending, display the reason as a regular decision field without an option explanation block. Check this placement with a selected option that differs from the recommendation.

Build the outline from the same ledger order, showing every decision ID and title with child indentation and accessible parent labels. Place it in a pale green floating panel to the right, sticky below the chapter banner and bounded by the timeline. Use native local anchors with scroll clearance so the target title remains visible; highlight the current reading entry with `aria-current="location"`, and provide keyboard focus styling. Long desktop outlines may scroll within their list; when the current entry changes, bring it into the list's visible area without moving the page. At 700px and below, put the full outline above the timeline in normal flow so it cannot cover the reading area. Omit the outline when there are no decisions. No ledger fields are added or rewritten.

### Generate the Report

Run the bundled script with absolute paths; resolve its location relative to the installed Skill rather than assuming a host-specific installation directory:

```bash
node /absolute/skill/scripts/render-execution-report.mjs \
  --ledger /absolute/project/.codex/plans/task-decision-tree.json \
  --report /absolute/project/.codex/plans/task-report.json \
  --output /absolute/project/.codex/plans/task-report.html
```

The script validates the original ledger, escapes content, rejects unsafe PR URLs, calculates duration, embeds the bundled CSS, atomically writes HTML, and reads the output back. Its JSON receipt reports the absolute HTML path, decision count, and supplied delivery status. That receipt proves rendering, not the truth of the input's delivery claims. The ledger is read-only throughout rendering. Unknown CLI arguments or an output path that could replace either input fail.

Keep all twelve former decision-detail fields in each timeline entry, including trigger, evidence, option descriptions, recommendation and selection references, rationale, risk, reversibility, involvement, and outcome evidence. Retain the ledger's original timestamps and parent relationships. Reuse [the bundled CSS](../assets/execution-report.css) and [sticky-heading enhancement](../assets/sticky-headings.js). Inline the enhancement with its exact SHA-256 CSP hash; it tracks scroll/layout changes for shadows and the current outline entry. All content, native outline links, and CSS sticky positioning remain available if JavaScript is disabled, with dynamic shadows and current-entry highlighting omitted. No network access is introduced.

Open the actual HTML using the host's preview or browser tools when available. Check desktop and narrow layouts, compact overview, complete context/audit content, every option and timeline entry, timestamps above titles, independent tags, and the absence of unrelated dividers or controls. Verify timeline segments join consecutive node centers and stop at the final node. Test every outline link, keyboard navigation, current-entry highlighting, long-list visibility, sidebar boundaries, and unobscured jump targets; verify native links also work without JavaScript. Scroll within multiple chapters and blocks to verify their headings stick in separate layers, gain shadows only while pinned, and release at content boundaries. Compare displayed session metadata, IDs, types, parent references, options, and original timestamps against parsed JSON. Include a choice that differs from the recommendation. Verify report generation left source JSON unchanged. State any unavailable visual check precisely; do not call uninspected output visually verified.

If Node.js is unavailable, generate equivalent standalone HTML from parsed inputs, preserve the timeline and evidence contract, and perform the same checks. A rendering failure is a report-delivery failure: repair it or disclose it, rather than silently replacing the requested artifact with chat prose.
