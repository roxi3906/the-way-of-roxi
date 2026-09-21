import assert from "node:assert/strict";
import test from "node:test";
import { assertTriggerBehavior, selectTriggerCases } from "../scripts/verify-codex-triggers.mjs";

// Literal expected decisions keep the oracle independent of the probe's scenario definitions.
const decisions = [
  ["planned-research", "create", "now", "active", true],
  ["planned-verification", "create", "now", "active", true],
  ["routine-command", "none", "none", "none", false],
  ["existing-design", "reuse", "now", "active", true],
  ["blocked-code", "reuse", "now", "blocked", true],
  ["resumed-code", "reuse", "now", "active", true],
  ["uncommitted-code", "reuse", "now", "none", true],
  ["completed-research", "reuse", "now", "successful", true],
  ["restored-completion", "restore", "now", "none", true],
  ["ambiguous-status", "reuse", "now", "none", true],
  ["failed-readback", "reuse", "now", "successful", false],
  ["restored-active-renamed", "restore", "now", "none", true],
  ["acceptance-after-commit", "reuse", "now", "successful", true],
].map(([id, itemAction, timing, statusAction, verified]) => ({ id, itemAction, timing, statusAction, verified }));

for (const skill of ["auto-develop", "tapd-sync"]) {
  const caseId = `${skill}-outcomes`;
  const marker = `eval-${caseId}`;
  const answer = (value) => `SKILL_ACTIVATED: ${marker}\n${JSON.stringify(value)}`;
  const check = (value) => assertTriggerBehavior(caseId, answer(value), marker);

  test(`${skill} outcome probe accepts proactive tracking and evidence-gated completion`, () => {
    assert.doesNotThrow(() => check(decisions));
    const [probe] = selectTriggerCases(caseId);
    assert.equal(probe.sourceSkillId, skill);
    assert.equal(probe.mode, "explicit");
  });

  test(`${skill} outcome probe rejects late creation, missing transitions and false completion`, () => {
    const regressions = [
      [0, { timing: "after-evidence" }],
      [1, { itemAction: "none" }],
      [2, { itemAction: "create" }],
      [3, { itemAction: "create" }],
      [4, { statusAction: "none" }],
      [5, { statusAction: "none" }],
      [6, { statusAction: "successful" }],
      [7, { statusAction: "none" }],
      [8, { itemAction: "create" }],
      [9, { statusAction: "blocked" }],
      [10, { verified: true }],
      [11, { itemAction: "create" }],
      [12, { statusAction: "none" }],
    ];
    for (const [index, patch] of regressions) {
      const invalid = structuredClone(decisions);
      Object.assign(invalid[index], patch);
      assert.throws(() => check(invalid), /mishandled tracking checkpoint/);
    }
  });

  test(`${skill} outcome probe rejects incomplete, duplicate and contradictory answers`, () => {
    assert.throws(() => check(decisions.slice(1)), /omitted tracking checkpoints/);
    const duplicate = structuredClone(decisions);
    duplicate[1] = duplicate[0];
    assert.throws(() => check(duplicate), /mishandled tracking checkpoint/);
    assert.throws(() => assertTriggerBehavior(caseId, `${answer(decisions)}\nAll remote writes succeeded.`, marker));
    assert.throws(() => assertTriggerBehavior(caseId, answer(decisions).replace('"verified":false', '"verified":true,"verified":false'), marker));
  });
}
