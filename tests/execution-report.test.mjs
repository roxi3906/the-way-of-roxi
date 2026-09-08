import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { renderExecutionReport as render } from "../skills/auto-develop/scripts/render-execution-report.mjs";

const rendererUrl = new URL("../skills/auto-develop/scripts/render-execution-report.mjs", import.meta.url);

function fixture() {
  const decision = {
    id: "D-01", type: "implementation", title: "Render safely",
    createdAt: "2026-09-07T10:00:00+08:00", parentId: "", trigger: "A report is requested",
    evidence: ["Reviewed the current contract"],
    options: [{ id: "O-1", label: "Static HTML", description: "Works offline", recommended: true }],
    recommendation: "O-1", selection: "O-1", reason: "Keep output portable",
    risk: { level: "low", description: "No external resources" },
    reversibility: "Regenerate the report", userInvolvement: "Authorized",
    outcome: { status: "Implemented", evidence: ["Rendering verified"], updatedAt: "2026-09-07T10:01:00+08:00" },
  };
  return {
    ledger: {
      schemaVersion: 1, session: { id: "session-1", name: "Report", language: "en" },
      task: { summary: "HTML execution report", ledgerPath: "/tmp/report-decision-tree.json" },
      decisions: [decision, { ...structuredClone(decision), id: "D-01.1", parentId: "D-01", title: "Escape content" }],
    },
    report: {
      status: "completed", summary: "Acceptance criteria passed",
      startedAt: "2026-09-07T10:00:00+08:00", endedAt: "2026-09-07T02:02:05+00:00",
      context: [{ label: "Task branch", value: "codex/report" }],
      stages: [{ title: "Compatibility check", summary: "Original schema retained", evidence: ["Schema validation passed"] }],
      reviews: [{ severity: "P2", finding: "Unsafe report content", fix: "Escape all values", verification: "Injection case passed", status: "fixed", evidence: ["D-01.1"] }],
      reviewSummary: "Re-review clean",
      verification: [{ command: "node --test", result: "2 passed" }],
      pr: { url: "https://example.invalid/pull/42", state: "draft", base: "main", head: "codex/report" },
      records: ["Validation status: passed after fixes."],
    },
  };
}

test("HTML report renders all decisions and evidence without modifying the ledger", () => {
  const { ledger, report } = fixture();
  const before = JSON.stringify(ledger);
  const html = render(ledger, report);
  assert.equal(JSON.stringify(ledger), before);
  assert.match(html, /2m 5s/);
  assert.match(html, /https:\/\/example.invalid\/pull\/42/);
  for (const decision of ledger.decisions) {
    assert.equal(html.split(`data-decision-id="${decision.id}"`).length - 1, 1);
    assert.ok(html.includes(decision.createdAt));
  }
  for (const value of ["Schema validation passed", "Escape all values", "Injection case passed", "Validation status: passed after fixes."]) {
    assert.ok(html.includes(value), value);
  }
  assert.ok(html.indexOf('id="overview"') < html.indexOf('id="stages"'));
  assert.ok(html.indexOf('id="stages"') < html.indexOf('id="review"'));
  assert.ok(html.indexOf('id="review"') < html.indexOf('id="decisions"'));
});

test("all report content is inline with navigation limited to the decision outline", () => {
  const { ledger, report } = fixture();
  const html = render(ledger, report);
  assert.doesNotMatch(html, /<(?:details|summary|button|input|select|table)\b/i);
  const outline = html.match(/<nav class="decision-outline"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(outline);
  assert.doesNotMatch(html.replace(outline, ""), /<a\b/i);
  assert.doesNotMatch(html, /\b(?:tabindex|onclick|onmouseover|hidden)=/i);
  for (const value of ["codex/report", ledger.task.ledgerPath, report.records[0], report.pr.url]) {
    assert.ok(html.includes(value), value);
  }
});

test("outline links every decision to a unique local target and preserves child ordering", () => {
  const { ledger, report } = fixture();
  const html = render(ledger, report);
  const outline = html.match(/<nav class="decision-outline"[\s\S]*?<\/nav>/)?.[0] || "";
  const links = [...outline.matchAll(/href="#([^"]+)"/g)];
  assert.equal(links.length, ledger.decisions.length);
  assert.equal(new Set(links.map(link => link[1])).size, links.length);
  links.forEach(([_, target], index) => {
    assert.equal(html.split(`id="${target}"`).length - 1, 1);
    assert.ok(outline.includes(ledger.decisions[index].title));
    assert.ok(outline.includes(ledger.decisions[index].id));
  });
  assert.match(outline, /--depth:1/);
  assert.match(outline, /aria-label="D-01\.1 Escape content, Parent decision D-01"/);
  const empty = render({ ...ledger, decisions: [] }, { ...report, status: "paused" });
  assert.doesNotMatch(empty, /<nav class="decision-outline"/);
});

test("overview and review preserve repository metadata and recorded event times", () => {
  const { ledger, report } = fixture();
  Object.assign(report, { repository: "owner/project", workdir: "/absolute/task-worktree", analysis: "Verified task analysis", branch: "codex/task", reviewedAt: "2026-09-07T10:02:00+08:00" });
  report.pr.number = 42;
  Object.assign(report.reviews[0], { reviewedAt: "2026-09-07T10:00:30+08:00", fixedAt: "2026-09-07T10:01:00+08:00", verifiedAt: "2026-09-07T10:01:30+08:00" });
  const html = render(ledger, report);
  for (const value of [report.repository, report.workdir, report.analysis, report.branch, "#42", report.reviewedAt, report.reviews[0].reviewedAt, report.reviews[0].fixedAt, report.reviews[0].verifiedAt]) assert.ok(html.includes(value), value);
  assert.throws(() => render(ledger, { ...report, workdir: "relative/path" }), /workdir/);
  report.reviews[0].fixedAt = "2026-09-07T09:00:00+08:00";
  assert.throws(() => render(ledger, report), /time/i);
});

test("in-progress reports and live enhancement do not imply completed delivery", () => {
  const { ledger, report } = fixture();
  report.status = "running";
  delete report.pr;
  ledger.decisions[0].selection = "";
  const html = render(ledger, report, { live: true });
  assert.match(html, /In progress/);
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /EventSource/);
  assert.doesNotMatch(render(ledger, report), /EventSource/);
});

test("report permits only its bundled sticky-shadow script via a CSP hash", () => {
  const { ledger, report } = fixture();
  const html = render(ledger, report);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  const hash = createHash("sha256").update(scripts[0][1]).digest("base64");
  assert.ok(html.includes(`script-src 'sha256-${hash}'`));
  assert.doesNotMatch(html, /script-src 'unsafe-inline'/);
});

test("timeline distinguishes recommended options from a different actual selection", () => {
  const { ledger, report } = fixture();
  ledger.decisions[0].options.push({ id: "O-2", label: "Alternate path", description: "Chosen for deployment constraints", recommended: false });
  ledger.decisions[0].selection = "O-2";
  const html = render(ledger, report);
  const firstNode = html.split('data-decision-id="D-01"')[1].split('data-decision-id="D-01.1"')[0];
  assert.match(firstNode, /class="decision-option recommended"[^>]*data-option-id="O-1"/);
  assert.match(firstNode, /class="decision-option"[^>]*data-option-id="O-2"/);
  assert.match(firstNode, /Recommended/);
  assert.match(firstNode, /Selected/);
  const recommendedOption = firstNode.split('data-option-id="O-1"')[1].split('</li>')[0];
  const selectedOption = firstNode.split('data-option-id="O-2"')[1].split('</li>')[0];
  assert.doesNotMatch(recommendedOption, /selection-explanation/);
  assert.match(selectedOption, /class="selection-explanation"/);
  assert.ok(selectedOption.indexOf("Keep output portable") > selectedOption.indexOf("Chosen for deployment constraints"));
  assert.equal(firstNode.split("Keep output portable").length - 1, 1);
  assert.match(html, /data-parent-id="D-01"/);
  assert.ok(html.indexOf('data-decision-id="D-01"') < html.indexOf('data-decision-id="D-01.1"'));
  for (const value of ["A report is requested", "Reviewed the current contract", "Keep output portable", "No external resources", "Regenerate the report", "Authorized", "Implemented", "Rendering verified", "2026-09-07T10:01:00+08:00"]) {
    assert.ok(firstNode.includes(value), value);
  }
});

test("timeline exposes ledger metadata and every option with timestamps above its title", () => {
  const { ledger, report } = fixture();
  ledger.session.id = "session-visible-73";
  ledger.session.name = "Complete audit session";
  ledger.decisions[0].type = "compatible_report_strategy";
  ledger.decisions[0].options.push(
    { id: "O-2", label: "Second option", description: "Second complete description", recommended: false },
    { id: "O-3", label: "Third option", description: "Third complete description", recommended: false },
  );
  const html = render(ledger, report);
  for (const value of [ledger.session.id, ledger.session.name, ledger.decisions[0].type, "Second complete description", "Third complete description"]) {
    assert.ok(html.includes(value), value);
  }
  const node = html.split('data-decision-id="D-01"')[1].split('data-decision-id="D-01.1"')[0];
  assert.equal((node.match(/data-option-id=/g) || []).length, 3);
  assert.ok(node.indexOf(ledger.decisions[0].createdAt) < node.indexOf(`<h3>${ledger.decisions[0].title}</h3>`));
  assert.ok(node.indexOf(ledger.decisions[0].outcome.updatedAt) < node.indexOf(`<h3>${ledger.decisions[0].title}</h3>`));
});

test("report text stays inert and PR links accept only HTTP(S)", () => {
  const { ledger, report } = fixture();
  report.summary = '</script><img src=x onerror="alert(1)">';
  ledger.decisions[0].reason = "<svg onload=alert(1)>";
  const html = render(ledger, report);
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<svg"));
  report.pr.url = "javascript:alert(1)";
  assert.throws(() => render(ledger, report), /PR URL/);
});

test("pauses and missing timestamps do not fabricate success or elapsed time", () => {
  const { ledger, report } = fixture();
  report.status = "paused";
  report.summary = "PR service unavailable; retry after recovery";
  report.startedAt = "";
  report.endedAt = "";
  delete report.pr;
  report.stages = [];
  report.reviews = [];
  report.reviewSummary = "Review has not started";
  ledger.decisions[1].selection = "";
  ledger.decisions[1].outcome.status = "";
  const html = render(ledger, report);
  assert.match(html, /Paused/);
  assert.match(html, /Not recorded/);
  assert.match(html, /Not created/);
  assert.match(html, /Pending/);
  const pendingNode = html.split('data-decision-id="D-01.1"')[1];
  assert.doesNotMatch(pendingNode, /class="selection-explanation"/);
  assert.ok(pendingNode.includes(ledger.decisions[1].reason));
  assert.ok(!html.includes("2m 5s"));
  assert.throws(() => render(ledger, { ...report, status: "completed" }), /incomplete decision/);
});

test("invalid timestamps, schemas and parent references fail before rendering", () => {
  const { ledger, report } = fixture();
  assert.throws(() => render(ledger, { ...report, endedAt: "2026-09-07T09:00:00+08:00" }), /time/i);
  assert.throws(() => render(ledger, { ...report, startedAt: "yesterday" }), /time/i);
  assert.throws(() => render({ ...ledger, elapsed: 5 }, report), /fixed root keys/);
  ledger.decisions[1].parentId = "missing";
  assert.throws(() => render(ledger, report), /parent/i);
});

test("completed decisions require recorded outcome evidence and update time", () => {
  for (const patch of [{ evidence: [] }, { updatedAt: "" }]) {
    const { ledger, report } = fixture();
    Object.assign(ledger.decisions[0].outcome, patch);
    assert.throws(() => render(ledger, report), /incomplete decision/);
  }
});

test("nonexistent calendar dates cannot become plausible elapsed time", () => {
  const { ledger, report } = fixture();
  for (const startedAt of ["2026-02-30T10:00:00+08:00", "2025-02-29T10:00:00+08:00", "2026-04-31T10:00:00+08:00", "2026-09-06T24:00:00+08:00"]) {
    assert.throws(() => render(ledger, { ...report, startedAt, endedAt: "2026-09-07T10:00:00+08:00" }), /time/i);
  }
  assert.match(render(ledger, { ...report, startedAt: "2024-02-29T10:00:00+08:00", endedAt: "2024-02-29T10:01:00+08:00" }), /1m 0s/);
});

test("CLI reads real inputs, writes standalone HTML and leaves source bytes intact", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "execution-report-"));
  try {
    const { ledger, report } = fixture();
    ledger.task.ledgerPath = path.join(root, "report-decision-tree.json");
    const reportPath = path.join(root, "report.json");
    const output = path.join(root, "report.html");
    const original = JSON.stringify(ledger);
    await writeFile(ledger.task.ledgerPath, original);
    await writeFile(reportPath, JSON.stringify(report));
    const { stdout } = await promisify(execFile)(process.execPath, [rendererUrl.pathname, "--ledger", ledger.task.ledgerPath, "--report", reportPath, "--output", output]);
    assert.equal(JSON.parse(stdout).reportPath, output);
    assert.equal(await readFile(ledger.task.ledgerPath, "utf8"), original);
    const html = await readFile(output, "utf8");
    assert.match(html, /<!doctype html>/i);
    assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)=/);
    await assert.rejects(promisify(execFile)(process.execPath, [rendererUrl.pathname, "--ledger", ledger.task.ledgerPath, "--report", reportPath, "--output", ledger.task.ledgerPath]));
    assert.equal(await readFile(ledger.task.ledgerPath, "utf8"), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
