import assert from "node:assert/strict";
import test from "node:test";
import { assertTriggerBehavior, selectTriggerCases } from "../scripts/verify-codex-triggers.mjs";

const marker = "eval-tapd-sync-task-entry";
const answer = (value) => `SKILL_ACTIVATED: ${marker}\n${JSON.stringify(value)}`;

test("task-entry probe rejects a missed execution checkpoint and repeated binding approval", () => {
  const cases = [
    ["analysis", { action: "recommend", timing: "before-result", needsConfirmation: true }],
    ["discussion", { action: "none", timing: "none", needsConfirmation: false }],
    ["execution", { action: "recommend", timing: "before-edit", needsConfirmation: true }],
    ["authorize", { action: "bind", timing: "now", needsConfirmation: false }],
    ["progress", { action: "track", timing: "now", needsConfirmation: false }],
    ["cleanup", { action: "plan-terminal", timing: "now", needsConfirmation: true }],
  ];
  for (const [checkpoint, decision] of cases) {
    const id = `tapd-task-${checkpoint}`;
    assert.doesNotThrow(() => assertTriggerBehavior(id, answer(decision), marker));
    assert.throws(() => assertTriggerBehavior(id, answer({ ...decision, action: "wrong" }), marker));
    assert.throws(() => assertTriggerBehavior(id, answer({ ...decision, needsConfirmation: !decision.needsConfirmation }), marker));
  }
  const probe = selectTriggerCases("tapd-sync-task-entry")[0];
  assert.equal(probe.mode, "stateful");
  assert.equal(probe.turns.length, 6);
  assert.ok(probe.turns.every(turn => turn.toolPolicy === "none"));
});

test("authorization probe rejects overbroad markers, unsafe matches and unapproved cleanup", () => {
  const decisions = [
    ["prefix", "bind", false], ["suffix", "create", false],
    ["body", "none", false], ["quote", "none", false],
    ["substring", "none", false], ["maintenance", "none", false],
    ["multiple", "clarify", true], ["wrong-project", "create", false],
    ["missing-owner", "clarify", true], ["declined", "none", false],
    ["restored-missed", "recommend", true], ["restored-notice", "none", false],
    ["new-task", "recommend", true], ["already-bound", "track", false],
    ["cleanup-plan", "plan-terminal", true], ["cleanup-approved", "transition", false],
    ["bare-marker", "bind", false], ["terminal-candidate", "create", false],
    ["failed-bind", "recover", false], ["explicit-no", "none", false],
    ["revoked-restored", "none", false],
    ["authorized-analysis", "track", false],
  ].map(([id, action, needsConfirmation]) => ({ id, action, needsConfirmation }));
  const check = (value) => assertTriggerBehavior("tapd-sync-authorization", answer(value), marker);
  assert.doesNotThrow(() => check(decisions));
  for (let index = 0; index < decisions.length; index++) {
    const invalid = structuredClone(decisions);
    invalid[index].action = "wrong";
    assert.throws(() => check(invalid));
  }
  assert.throws(() => check(decisions.slice(1)));
  assert.throws(() => assertTriggerBehavior("tapd-sync-authorization", `${answer(decisions)}\nAll writes succeeded.`, marker));
  assert.throws(() => assertTriggerBehavior("tapd-sync-authorization", answer(decisions).replace('"action":"bind"', '"action":"create","action":"bind"'), marker));
});

test("approved cleanup cannot reconcile children or phases outside its operation list", () => {
  const decision = { transitionTitles: ["Accepted verification"], createChildren: false, syncPhases: false, needsConfirmation: false };
  const check = value => assertTriggerBehavior("tapd-sync-cleanup-scope", answer(value), marker);
  assert.doesNotThrow(() => check(decision));
  for (const patch of [
    { transitionTitles: ["Accepted verification", "Keep parent"] },
    { createChildren: true }, { syncPhases: true }, { needsConfirmation: true },
  ]) assert.throws(() => check({ ...decision, ...patch }));
});
