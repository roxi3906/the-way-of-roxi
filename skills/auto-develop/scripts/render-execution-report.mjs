import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertDecisionLedgerJson, readDecisionLedger } from "./decision-ledger.mjs";

const copy = {
  en: {
    report: "Execution report", overview: "Task overview", stages: "Milestones", review: "Code review & fixes", decisions: "Decision tree",
    completed: "Completed", paused: "Paused", elapsed: "Elapsed time", started: "Started", ended: "Report cutoff", pr: "Pull request",
    running: "In progress", analysis: "Analysis", repository: "Repository", workdir: "Working directory", branch: "Task branch", prNumber: "PR number", reviewedAt: "Reviewed at", fixedAt: "Fixed at", verifiedAt: "Reverified at", live: "Live updates", liveError: "Update failed; showing last valid report", disconnected: "Disconnected; reconnecting",
    notRecorded: "Not recorded", notCreated: "Not created", pending: "Pending", none: "None recorded",
    context: "Delivery context", verification: "Verification", command: "Command", result: "Result", records: "Status & audit evidence",
    finding: "Finding", fix: "Fix", recheck: "Verification", fixed: "Fixed", unresolved: "Unresolved", deferred: "Deferred",
    goal: "User goal", details: "Decision details", ledger: "Decision ledger", recommended: "Recommended", option: "Option",
    node: "Node", created: "Created at", trigger: "Trigger", evidence: "Evidence", options: "Options", recommendation: "Recommendation",
    selection: "Selection", reason: "Reason", risk: "Risk", reversibility: "Reversibility", involvement: "User involvement", outcome: "Outcome",
    updated: "Updated at", emptyTree: "No decisions recorded", selected: "Selected", parent: "Parent decision", outline: "Decision outline",
    type: "Decision type", schema: "Schema version", sessionId: "Session ID", sessionName: "Session name", language: "Language", root: "Root decision", riskLevel: "Risk level", base: "Base branch", head: "Head branch", prState: "PR state",
  },
  zh: {
    report: "执行结果报告", overview: "任务概览", stages: "有价值的中间阶段", review: "代码审查与修复", decisions: "决策树",
    completed: "已完成", paused: "已暂停", elapsed: "总耗时", started: "开始时间", ended: "报告截止时间", pr: "Pull request",
    running: "进行中", analysis: "任务分析", repository: "仓库", workdir: "工作目录", branch: "任务分支", prNumber: "PR 编号", reviewedAt: "审查时间", fixedAt: "修复时间", verifiedAt: "复验时间", live: "实时更新", liveError: "更新失败，正在显示上一次有效报告", disconnected: "连接已断开，正在重连",
    notRecorded: "未记录", notCreated: "未创建", pending: "待确定", none: "无记录",
    context: "交付上下文", verification: "验证结果", command: "命令", result: "结果", records: "状态与审计证据",
    finding: "审查发现", fix: "对应修复", recheck: "修复验证", fixed: "已修复", unresolved: "未解决", deferred: "已延期",
    goal: "用户目标", details: "决策明细", ledger: "决策账本", recommended: "推荐", option: "选项",
    node: "节点", created: "创建时间", trigger: "触发原因", evidence: "证据", options: "选项", recommendation: "推荐方案",
    selection: "选择方案", reason: "决策理由", risk: "风险", reversibility: "可逆性", involvement: "用户参与", outcome: "最终结果",
    updated: "更新时间", emptyTree: "尚未记录决策", selected: "已选择", parent: "父决策", outline: "决策大纲",
    type: "决策类型", schema: "结构版本", sessionId: "会话 ID", sessionName: "会话名称", language: "语言", root: "根决策", riskLevel: "风险级别", base: "目标分支", head: "来源分支", prState: "PR 状态",
  },
};

const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const requireText = (value, name, allowEmpty = false) => {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`Invalid report ${name}`);
};
const textArray = (value, name) => {
  if (!Array.isArray(value)) throw new Error(`Invalid report ${name}`);
  for (const item of value) requireText(item, name);
};
const entries = (value, name, fields) => {
  if (!Array.isArray(value)) throw new Error(`Invalid report ${name}`);
  for (const item of value) {
    if (!item || typeof item !== "object") throw new Error(`Invalid report ${name}`);
    for (const field of fields) requireText(item[field], `${name}.${field}`);
    if (name === "stages" || name === "reviews") textArray(item.evidence, `${name}.evidence`);
  }
};

function validateTime(value, name) {
  requireText(value, name, true);
  if (value && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)))) {
    throw new Error(`Invalid report time: ${name}`);
  }
  if (value) {
    const date = value.slice(0, 10);
    if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || Number(value.slice(11, 13)) > 23) {
      throw new Error(`Invalid report calendar time: ${name}`);
    }
  }
}

function elapsedTime(report, labels) {
  for (const name of ["startedAt", "endedAt"]) validateTime(report[name], name);
  if (!report.startedAt || !report.endedAt) return labels.notRecorded;
  const seconds = Math.floor((Date.parse(report.endedAt) - Date.parse(report.startedAt)) / 1000);
  if (seconds < 0) throw new Error("Report end time precedes start time");
  return `${Math.floor(seconds / 3600) ? `${Math.floor(seconds / 3600)}h ` : ""}${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
}

export function renderExecutionReport(document, report, { live = false } = {}) {
  const ledger = assertDecisionLedgerJson(document);
  const language = ledger.session.language || "en";
  const baseCopy = language.startsWith("zh") ? copy.zh : language.startsWith("en") ? copy.en : undefined;
  const labels = { ...baseCopy, ...report.labels };
  for (const key of Object.keys(copy.en)) requireText(labels[key], `labels.${key}`);
  if (!["completed", "paused", "running"].includes(report.status)) throw new Error("Invalid report status");
  requireText(report.summary, "summary");
  requireText(report.reviewSummary, "reviewSummary");
  if (report.notice !== undefined) requireText(report.notice, "notice");
  for (const field of ["analysis", "repository", "workdir", "branch"]) {
    if (report[field] !== undefined) requireText(report[field], field, true);
  }
  if (report.workdir && !path.isAbsolute(report.workdir)) throw new Error("Invalid report workdir: absolute path required");
  validateTime(report.reviewedAt ?? "", "reviewedAt");
  entries(report.context, "context", ["label", "value"]);
  entries(report.stages, "stages", ["title", "summary"]);
  entries(report.reviews, "reviews", ["severity", "finding", "fix", "verification", "status"]);
  entries(report.verification, "verification", ["command", "result"]);
  textArray(report.records, "records");
  const duration = elapsedTime(report, labels);
  const seen = new Set();
  for (const decision of ledger.decisions) {
    if (decision.parentId && !seen.has(decision.parentId)) throw new Error("Decision parent must precede its child");
    seen.add(decision.id);
    const required = [decision.selection, decision.outcome.status, decision.outcome.updatedAt, decision.title, decision.trigger, decision.reason, decision.risk.level, decision.risk.description, decision.reversibility, decision.userInvolvement, ...decision.evidence, ...decision.outcome.evidence];
    if (report.status === "completed" && (!decision.evidence.length || !decision.outcome.evidence.length || required.some((value) => !value.trim()))) {
      throw new Error(`Cannot complete report with incomplete decision ${decision.id}`);
    }
  }
  for (const review of report.reviews) {
    let previousTime = -Infinity;
    for (const field of ["reviewedAt", "fixedAt", "verifiedAt"]) {
      const value = review[field] ?? "";
      validateTime(value, `review.${field}`);
      if (value) {
        if (Date.parse(value) < previousTime) throw new Error("Review event time is out of order");
        previousTime = Date.parse(value);
      }
    }
    if (!["fixed", "unresolved", "deferred"].includes(review.status)) throw new Error("Invalid review status");
    if (report.status === "completed" && review.status !== "fixed") throw new Error("Completed report has unresolved review findings");
  }
  if (report.pr) {
    if (report.pr.number !== undefined && (!Number.isSafeInteger(report.pr.number) || report.pr.number < 1)) throw new Error("Invalid PR number");
    for (const field of ["url", "state", "base", "head"]) requireText(report.pr[field], `pr.${field}`);
    let url;
    try { url = new URL(report.pr.url); } catch { throw new Error("Invalid PR URL"); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid PR URL");
  }
  if (report.status === "completed" && (!report.pr || report.pr.state !== "draft" || report.pr.base === report.pr.head || !ledger.decisions.length)) {
    throw new Error("Completed report requires decisions and a draft PR with distinct refs");
  }

  const text = (value) => escape(value || labels.pending);
  const list = (items) => items.length ? `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : `<p class="muted">${escape(labels.none)}</p>`;
  const badge = (value, label = labels[value]) => `<span class="badge ${value}">${escape(label)}</span>`;
  const detail = (label, html) => `<div><dt>${escape(label)}</dt><dd>${html}</dd></div>`;
  const definition = (label, value) => detail(label, text(value));
  const options = (decision) => decision.options.length ? `<ol class="decision-options">${decision.options.map((option, index) => `<li class="decision-option${option.recommended ? " recommended" : ""}" data-option-id="${escape(option.id)}"><div class="option-heading"><span class="option-number">${index + 1}</span><strong>${escape(option.label)}</strong><code>${escape(option.id)}</code><span class="option-markers">${option.recommended ? badge("recommended") : ""}${decision.selection === option.id ? badge("chosen", labels.selected) : ""}</span></div><p>${escape(option.description)}</p>${decision.selection === option.id ? `<div class="selection-explanation"><h4>${escape(labels.reason)}</h4><p>${text(decision.reason)}</p></div>` : ""}</li>`).join("")}</ol>` : `<p>${text("")}</p>`;
  const optionRef = (decision, id) => {
    const index = decision.options.findIndex((option) => option.id === id);
    return index < 0 ? text("") : `<span>${escape(decision.options[index].label)}</span> <code>${escape(id)}</code>`;
  };
  const timestamp = (label, value) => `<span class="timestamp"><span>${escape(label)}</span>${value ? `<time datetime="${escape(value)}">${escape(value)}</time>` : `<span>${escape(labels.notRecorded)}</span>`}</span>`;
  const depths = new Map();
  const outline = `<nav class="decision-outline" aria-label="${escape(labels.outline)}"><h3>${escape(labels.outline)}</h3><ol>${ledger.decisions.map((decision, index) => {
    const depth = decision.parentId ? depths.get(decision.parentId) + 1 : 0;
    depths.set(decision.id, depth);
    const accessibleName = `${decision.id} ${decision.title || labels.pending}, ${decision.parentId ? `${labels.parent} ${decision.parentId}` : labels.root}`;
    return `<li style="--depth:${Math.min(depth, 3)}"><a href="#decision-${index + 1}" aria-label="${escape(accessibleName)}"><code>${escape(decision.id)}</code><span>${text(decision.title)}</span></a></li>`;
  }).join("")}</ol></nav>`;
  const timeline = ledger.decisions.map((decision, index) => `<li class="decision" id="decision-${index + 1}" data-decision-id="${escape(decision.id)}" data-parent-id="${escape(decision.parentId)}">
<header class="decision-heading block-heading"><div class="decision-times">${timestamp(labels.created, decision.createdAt)}${timestamp(labels.updated, decision.outcome.updatedAt)}</div><div class="decision-title"><code class="decision-id">${escape(decision.id)}</code><h3>${text(decision.title)}</h3></div></header>
<dl class="decision-facts">${definition(labels.type, decision.type)}${definition(labels.parent, decision.parentId || labels.root)}${definition(labels.trigger, decision.trigger)}${detail(labels.evidence, list(decision.evidence))}</dl>
<div class="options"><h4>${escape(labels.options)}</h4>${options(decision)}</div>
<dl class="decision-facts">${detail(labels.recommendation, optionRef(decision, decision.recommendation))}${detail(labels.selection, optionRef(decision, decision.selection))}${decision.selection ? "" : definition(labels.reason, decision.reason)}${definition(labels.riskLevel, decision.risk.level)}${definition(labels.risk, decision.risk.description)}${definition(labels.reversibility, decision.reversibility)}${definition(labels.involvement, decision.userInvolvement)}</dl>
<div class="decision-outcome"><h4>${escape(labels.outcome)}</h4><p>${text(decision.outcome.status)}</p>${list(decision.outcome.evidence)}</div>
</li>`).join("");
  const style = readFileSync(new URL("../assets/execution-report.css", import.meta.url), "utf8");
  const script = readFileSync(new URL("../assets/sticky-headings.js", import.meta.url), "utf8") + (live ? readFileSync(new URL("../assets/live-report.js", import.meta.url), "utf8") : "");
  const scriptHash = createHash("sha256").update(script).digest("base64");
  return `<!doctype html>
<html lang="${escape(language)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${scriptHash}'; ${live ? "connect-src 'self'; " : ""}base-uri 'none'; form-action 'none'">
<title>${escape(ledger.task.summary)} ${escape(labels.report)}</title><style>${style}</style></head>
<body><div class="page">
<header class="masthead"><span>AUTO DEVELOP</span><span class="muted">${escape(labels.report)}</span></header>
${live ? `<p class="live-status" role="status" data-ready="${escape(labels.live)}" data-error="${escape(labels.liveError)}" data-disconnected="${escape(labels.disconnected)}">${escape(labels.live)}</p>` : ""}
${report.notice ? `<aside class="notice">${escape(report.notice)}</aside>` : ""}
<main>
<section id="overview"><h2 class="chapter-heading"><span class="section-number">01</span>${escape(labels.overview)}</h2><div class="task-title"><h1>${escape(ledger.task.summary)}</h1>${badge(report.status)}</div><p class="lead">${escape(report.summary)}</p>
${report.analysis ? `<div class="task-analysis"><h4>${escape(labels.analysis)}</h4><p>${escape(report.analysis)}</p></div>` : ""}
<dl class="overview-context">${definition(labels.repository, report.repository || labels.notRecorded)}${definition(labels.branch, report.branch || report.pr?.head || labels.notRecorded)}${definition(labels.workdir, report.workdir || labels.notRecorded)}</dl>
<div class="summary-facts"><dl class="summary-duration">${definition(labels.elapsed, duration)}</dl><dl>${definition(labels.started, report.startedAt || labels.notRecorded)}${definition(labels.ended, report.endedAt || labels.notRecorded)}</dl><dl>${definition(labels.prNumber, report.pr?.number ? `#${report.pr.number}` : report.pr ? labels.notRecorded : labels.notCreated)}${definition(labels.pr, report.pr?.url || labels.notCreated)}${report.pr ? definition(labels.prState, report.pr.state) : ""}</dl>${report.pr ? `<dl>${definition(labels.base, report.pr.base)}</dl>` : ""}</div>
<div class="context"><h3 class="block-heading">${escape(labels.context)}</h3><dl class="compact-facts">${report.context.map((item) => definition(item.label, item.value)).join("")}</dl></div>
</section>
<section id="stages"><h2 class="chapter-heading"><span class="section-number">02</span>${escape(labels.stages)}</h2>
${report.stages.length ? `<ol class="milestones">${report.stages.map((stage, index) => `<li><h3 class="block-heading"><span class="step">${String(index + 1).padStart(2, "0")}</span>${escape(stage.title)}</h3><p>${escape(stage.summary)}</p>${list(stage.evidence)}</li>`).join("")}</ol>` : `<p class="muted">${escape(labels.none)}</p>`}
<div class="verification"><h3 class="block-heading">${escape(labels.verification)}</h3>${report.verification.length ? `<div class="checks">${report.verification.map((check) => `<div><span class="muted">${escape(labels.command)}</span><code>${escape(check.command)}</code><span class="muted">${escape(labels.result)}</span><p>${escape(check.result)}</p></div>`).join("")}</div>` : `<p>${escape(labels.none)}</p>`}</div>
</section>
<section id="review"><h2 class="chapter-heading"><span class="section-number">03</span>${escape(labels.review)}</h2><div class="review-times">${timestamp(labels.reviewedAt, report.reviewedAt)}</div><p>${escape(report.reviewSummary)}</p>
${report.reviews.map((review) => `<article class="review-item"><header class="block-heading review-heading"><div class="review-times">${timestamp(labels.reviewedAt, review.reviewedAt)}${timestamp(labels.fixedAt, review.fixedAt)}${timestamp(labels.verifiedAt, review.verifiedAt)}</div><div class="review-title"><span class="severity">${escape(review.severity)}</span><h3>${escape(review.finding)}</h3>${badge(review.status)}</div></header><div class="repair"><div><h4>${escape(labels.fix)}</h4><p>${escape(review.fix)}</p></div><div><h4>${escape(labels.recheck)}</h4><p>${escape(review.verification)}</p></div></div>${list(review.evidence)}</article>`).join("")}
</section>
<section id="decisions"><h2 class="chapter-heading"><span class="section-number">04</span>${escape(labels.decisions)}</h2>
${timeline ? `<div class="decision-layout">${outline}<ol class="decision-timeline">${timeline}</ol></div>` : `<p>${escape(labels.emptyTree)}</p>`}
<div class="audit"><h3 class="block-heading">${escape(labels.records)}</h3><dl class="compact-facts">${definition(labels.schema, String(ledger.schemaVersion))}${definition(labels.sessionId, ledger.session.id)}${definition(labels.sessionName, ledger.session.name)}${definition(labels.language, ledger.session.language)}${definition(labels.ledger, ledger.task.ledgerPath)}</dl><pre>${escape(report.records.join("\n") || labels.none)}</pre></div>
</section>
</main><footer>AUTO DEVELOP</footer></div><script>${script}</script></body></html>\n`;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    if (!["--ledger", "--report", "--output"].includes(args[index]) || !args[index + 1] || flags.has(args[index])) throw new Error("Usage: --ledger <absolute.json> --report <absolute.json> --output <absolute.html>");
    flags.set(args[index], args[index + 1]);
  }
  if (flags.size !== 3 || [...flags.values()].some((value) => !path.isAbsolute(value))) throw new Error("All three absolute paths are required");
  const ledgerPath = path.resolve(flags.get("--ledger"));
  const reportPath = path.resolve(flags.get("--report"));
  const output = path.resolve(flags.get("--output"));
  if (!output.endsWith(".html") || [ledgerPath, reportPath].includes(output)) throw new Error("Output must be a separate .html file");
  const ledger = await readDecisionLedger(ledgerPath);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const html = renderExecutionReport(ledger, report);
  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, html, { encoding: "utf8", flag: "wx" });
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch(() => {});
  }
  if (await readFile(output, "utf8") !== html) throw new Error("HTML report read-back mismatch");
  process.stdout.write(`${JSON.stringify({ reportPath: output, decisionCount: ledger.decisions.length, status: report.status })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
