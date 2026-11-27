import assert from "node:assert/strict";
import test from "node:test";
import { assertTriggerBehavior, selectTriggerCases } from "../scripts/verify-codex-triggers.mjs";

const marker = "eval-session-cleanup-preflight";
const marked = decisions => `SKILL_ACTIVATED: ${marker}\n${JSON.stringify(decisions)}`;

const safeMerged = {
  id: "merged-clean",
  action: "plan",
  remoteBranch: "delete:origin",
  localBranch: "delete",
  worktree: "remove",
  documents: "move",
  riskTag: "[MEDIUM]",
  approvalRequired: true,
};

const preflightDecisions = [
  safeMerged,
  { ...safeMerged, id: "merged-fork", remoteBranch: "delete:fork" },
  {
    id: "closed-unmerged",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
  {
    id: "advanced-head",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
  {
    id: "dirty-worktree",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
  {
    id: "archive-collision",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
  { ...safeMerged, id: "archive-ignore-missing", documents: "ignore-and-move" },
  {
    id: "protected-head",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
  {
    id: "unpushed-local",
    action: "block",
    remoteBranch: "keep",
    localBranch: "keep",
    worktree: "keep",
    documents: "keep",
    riskTag: "[HIGH]",
    approvalRequired: false,
  },
];

test("session cleanup owns its preflight probe instead of roxis-way", () => {
  const [preflight] = selectTriggerCases("session-cleanup-preflight");
  assert.equal(preflight.sourceSkillId, "session-cleanup");
  assert.equal(preflight.mode, "explicit");
  assert.match(preflight.prompt, /remoteBranch/);
  assert.match(preflight.prompt, /archive-collision/);
});

test("preflight permits only evidence-backed cleanup and blocks unsafe branch or document actions", () => {
  assert.doesNotThrow(() => assertTriggerBehavior("session-cleanup-preflight", marked(preflightDecisions), marker));

  for (const [index, patch] of [
    [0, { remoteBranch: "keep" }],
    [1, { remoteBranch: "delete:origin" }],
    [2, { action: "plan", remoteBranch: "delete:origin" }],
    [3, { action: "plan", remoteBranch: "delete:origin" }],
    [4, { action: "plan", worktree: "remove" }],
    [5, { action: "plan", documents: "move" }],
    [6, { documents: "move" }],
    [7, { action: "plan", remoteBranch: "delete:origin" }],
    [8, { action: "plan", localBranch: "delete" }],
    [0, { riskTag: "[LOW]" }],
    [0, { approvalRequired: false }],
  ]) {
    const decisions = structuredClone(preflightDecisions);
    decisions[index] = { ...decisions[index], ...patch };
    assert.throws(() => assertTriggerBehavior("session-cleanup-preflight", marked(decisions), marker));
  }
});

test("merged cleanup plan includes both branch deletions, document archiving and risk tags", () => {
  const plan = [
    "SKILL_ACTIVATED: eval-session-cleanup",
    "清理计划（尚未执行，等待批准）：",
    "- PR：#42 已确认 merged；base 为 main，head 为 origin/feat/docs，远端 head 未在合并后变化。",
    "- [MOVE] [LOW] 任务文档：/tmp/feat-docs/plan.md -> /repo/.ai/session-archive/pr-42-deadbeef/plan.md；命令：mv -n /tmp/feat-docs/plan.md /repo/.ai/session-archive/pr-42-deadbeef/plan.md",
    "- [DELETE] [MEDIUM] 工作树：/tmp/feat-docs；命令：git worktree remove /tmp/feat-docs",
    "- [DELETE] [MEDIUM] 本地任务分支：feat/docs；命令：git branch -d feat/docs",
    "- [DELETE] [MEDIUM] 远端任务分支：origin/feat/docs；命令：git push origin --delete feat/docs",
    "- [TRANSITION] [MEDIUM] 项目管理工作项：TAPD STORY-42，当前状态 In Progress。",
    "  证据：工作项类型 STORY；当前项目工作流元数据解析出的成功终态为 status_9（Verified Done）。",
    "  平台读取命令：pmctl workflow terminal --item STORY-42",
    "  平台流转命令：pmctl work-item transition --id STORY-42 --to status_9",
    "  用户覆盖：若用户要求其他状态或动作，则按该要求调整。",
    "批准门槛：获得用户明确批准后才执行以上清理命令和平台写操作。",
  ].join("\n");
  const verify = output => assertTriggerBehavior("session-cleanup", output, "eval-session-cleanup");

  assert.doesNotThrow(() => verify(plan));
  assert.doesNotThrow(() => verify(plan.replace(
    "；命令：git worktree remove /tmp/feat-docs",
    "\n  ```sh\n  git worktree remove /tmp/feat-docs\n  ```",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "远端任务分支：origin/feat/docs；命令：git push origin --delete feat/docs",
    "Delete origin/feat/docs; command: git push origin --delete feat/docs",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "  证据：工作项类型 STORY；当前项目工作流元数据解析出的成功终态为 status_9（Verified Done）。",
    "  Evidence: current workflow metadata identifies status_9 as the successful terminal state for type STORY (Verified Done).",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "清理计划（尚未执行，等待批准）",
    "Cleanup plan; no mutations were performed",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "清理计划（尚未执行，等待批准）",
    "Cleanup plan pending explicit approval",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "用户覆盖：若用户要求其他状态或动作，则按该要求调整。",
    "A cleanup-specific request to leave STORY-42 in place or use a different legal transition would override the default and require a revised approved plan.",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "用户覆盖：若用户要求其他状态或动作，则按该要求调整。",
    "A cleanup-specific request to keep STORY-42 open or take a different valid action would replace the default transition in the plan submitted for approval.",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "用户覆盖：若用户要求其他状态或动作，则按该要求调整。",
    "An explicit cleanup-specific request for STORY-42, such as keeping it In Progress, would replace the default transition in a revised plan. A different target would require verification against the current workflow before approval.",
  )));
  assert.doesNotThrow(() => verify(plan.replace(
    "用户覆盖：若用户要求其他状态或动作，则按该要求调整。",
    "A cleanup-specific TAPD request would override the default transition. The requested action requires a revised plan, verification against the current STORY workflow, and explicit approval of the revised commands.",
  )));
  for (const invalid of [
    plan.replace(/^- \[DELETE\] \[MEDIUM\] 远端任务分支.*\n/m, ""),
    plan.replace(/^- \[DELETE\] \[MEDIUM\] 本地任务分支.*\n/m, ""),
    plan.replace(/^- \[DELETE\] \[MEDIUM\] 工作树.*\n/m, ""),
    plan.replace("；命令：git worktree remove /tmp/feat-docs", ""),
    plan.replace(/^- \[MOVE\] \[LOW\] 任务文档.*\n/m, ""),
    plan.replace("- [DELETE] [MEDIUM] 远端任务分支", "- [DELETE] 远端任务分支"),
    plan.replace("- [DELETE] [MEDIUM] 远端任务分支", "- [DELETE] [MEDIUM] [HIGH] 远端任务分支"),
    plan.replace("git push origin --delete feat/docs", "git push origin --delete feat/docs [HIGH]"),
    plan.replace(/(- \[MOVE\].*\n)(- \[DELETE\] \[MEDIUM\] 工作树.*\n)/, "$2$1"),
    plan.replace("清理计划（尚未执行，等待批准）", "清理结果（已执行）"),
  ]) {
    assert.throws(() => verify(invalid));
  }
});

test("transition report accepts a read-back verified from-to status claim", () => {
  const report = [
    "SKILL_ACTIVATED: eval-session-cleanup-lifecycle",
    "TAPD Story `STORY-42` transitioned from **In Progress** to **Verified Done**. The pre-transition checks matched the approved plan, and the read-back confirmed the exact status label and ID (`status_9`) resolved from the Story type’s current workflow metadata.",
  ].join("\n");
  const verify = output => assertTriggerBehavior("session-cleanup-transitioned", output, "eval-session-cleanup-lifecycle");

  assert.doesNotThrow(() => verify(report));
  assert.throws(() => verify(report.replace("the read-back confirmed", "the read-back failed to confirm")));
});

test("read-back failure keeps the resulting work-item status unverified", () => {
  const report = [
    "SKILL_ACTIVATED: eval-session-cleanup-readback-failed",
    "TAPD STORY-42 — Unverified. The approved transition was attempted, but the required status read-back failed. The item’s resulting status is unknown, so overall cleanup remains unresolved.",
    "Preserve the failure evidence. Recovery requires a successful TAPD status read-back confirming the approved target status before considering a retry.",
  ].join("\n");
  const verify = output => assertTriggerBehavior("session-cleanup-readback-failed", output, "eval-session-cleanup-readback-failed");

  assert.doesNotThrow(() => verify(report));
  assert.doesNotThrow(() => verify(report.replace("The item’s resulting status is unknown", "The transition outcome remains unverified")));
  assert.throws(() => verify(report.replace("resulting status is unknown", "resulting status is Verified Done")));
});

test("unavailable work items stay high-risk blocked while independent local cleanup remains tagged", () => {
  const plan = [
    "SKILL_ACTIVATED: eval-session-cleanup-unavailable",
    "清理计划（尚未执行，等待批准）：",
    "- [KEEP] [HIGH] [BLOCKED] 项目管理工作项：TAPD STORY-42，当前状态 In Progress。",
    "  平台和工作流元数据不可用；leave untouched，不执行平台写操作。Command: none。",
    "- [DELETE] [MEDIUM] 本地分支 feat/docs 和工作树 /tmp/feat-docs；命令：git worktree remove /tmp/feat-docs && git branch -d feat/docs",
    "获得用户明确批准后才执行独立本地清理。",
  ].join("\n");
  const verify = output => assertTriggerBehavior("session-cleanup-unavailable", output, "eval-session-cleanup-unavailable");

  assert.doesNotThrow(() => verify(plan));
  assert.doesNotThrow(() => verify(plan.replace("leave untouched，不执行平台写操作", "Leave it untouched")));
  assert.throws(() => verify(plan.replace("[KEEP] [HIGH] [BLOCKED]", "[KEEP]")));
  assert.throws(() => verify(plan.replace("[DELETE] [MEDIUM]", "[DELETE]")));
});
