import assert from "node:assert/strict";
import test from "node:test";
import { assertTriggerBehavior, selectTriggerCases } from "../scripts/verify-codex-triggers.mjs";

const marked = (decision) => `SKILL_ACTIVATED: eval-roxis-way\n${JSON.stringify(decision)}`;

test("an English preference is honored for workflow choices even in a Chinese request", () => {
  const answer = "SKILL_ACTIVATED: eval-roxis-way\nWorkspace strategy\n1. Worktree\n2. New branch\n3. Current branch\n4. Other\nValidation scope\n1. Direct checks\n2. Indirect checks\n3. Full suite\n4. Other";
  assert.doesNotThrow(() => assertTriggerBehavior("roxis-way-language-en", answer, "eval-roxis-way"));
  assert.throws(() => assertTriggerBehavior("roxis-way-language-en", answer.replace("Workspace strategy", "工作区策略"), "eval-roxis-way"));
  assert.throws(() => assertTriggerBehavior("roxis-way-language-en", "SKILL_ACTIVATED: eval-roxis-way\nChoose a workspace.", "eval-roxis-way"));
  assert.equal(selectTriggerCases("roxis-way-language-en")[0].sourceSkillId, "roxis-way");
});

test("read-only repository questions select the read-only route without a development gate", () => {
  const decision = { route: "readonly", needsUserChoice: false };
  assert.doesNotThrow(() => assertTriggerBehavior("roxis-way-readonly", marked(decision), "eval-roxis-way"));
  for (const patch of [{ route: "change" }, { needsUserChoice: true }, { answer: "告诉我你要哪个工作区，我收到答复才能继续。" }]) {
    assert.throws(() => assertTriggerBehavior("roxis-way-readonly", marked({ ...decision, ...patch }), "eval-roxis-way"));
  }
});

test("authorized continuation preserves the selected workspace and reports unrun verification", () => {
  const decision = { route: "change", branch: "codex/docs", validationScope: "direct", validationState: "not-run", needsUserChoice: false, nextAction: "inspect" };
  assert.doesNotThrow(() => assertTriggerBehavior("roxis-way-authorized", marked(decision), "eval-roxis-way"));
  for (const patch of [{ branch: "main" }, { validationScope: "full" }, { validationState: "passed" }, { needsUserChoice: true }, { nextAction: "wait-for-choice" }, { needsUserChoice: "false" }, { route: "readonly" }]) {
    assert.throws(() => assertTriggerBehavior("roxis-way-authorized", marked({ ...decision, ...patch }), "eval-roxis-way"));
  }
  assert.throws(() => assertTriggerBehavior("roxis-way-authorized", `${marked(decision)}\n测试已经通过。`, "eval-roxis-way"));
  assert.throws(() => assertTriggerBehavior("roxis-way-authorized", marked({ ...decision, claim: "测试已经通过" }), "eval-roxis-way"));
  assert.throws(() => assertTriggerBehavior("roxis-way-authorized", "SKILL_ACTIVATED: eval-roxis-way\nnot JSON", "eval-roxis-way"));
  for (const entry of ['"branch":"main",', '"validationState":"passed",']) {
    const duplicated = marked(decision).replace('{', `{${entry}`);
    assert.throws(() => assertTriggerBehavior("roxis-way-authorized", duplicated, "eval-roxis-way"));
  }
});

test("behavior probes cover natural requests and multi-turn continuation", () => {
  const [readonly] = selectTriggerCases("roxis-way-readonly");
  assert.ok(!readonly.prompt.includes("$eval-"));
  const [continuation] = selectTriggerCases("roxis-way-authorized");
  assert.equal(continuation.turns.length, 2);
  assert.ok(continuation.turns.every(turn => turn.toolPolicy === "none"));
  assert.equal(selectTriggerCases("roxis-way-negative")[0].mode, "negative");
});
