import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierUrl = pathToFileURL(path.join(root, "scripts", "verify-codex-triggers.mjs")).href;

const loadVerifier = async () => {
  try {
    return await import(verifierUrl);
  } catch (error) {
    assert.fail(`Codex trigger verifier must be importable: ${error.message}`);
  }
};

const parseFrontmatter = (contents) => {
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match);
  return YAML.parse(match[1]);
};

test("Codex trigger runs remove TAPD configuration while preserving required runtime paths", async () => {
  const { sanitizeEnvironment } = await loadVerifier();
  const result = sanitizeEnvironment(
    {
      PATH: "/usr/bin:/bin",
      CODEX_HOME: "/existing/codex",
      TAPD_API_ENDPOINT: "secret-endpoint",
      TAPD_TOKEN: "secret-token",
      TAPD_WORKSPACE_IDS: "secret-workspaces",
      TAPD_NPC_ROLE: "creator",
      OPENAI_API_KEY: "stale-openai-key",
      CODEX_API_KEY: "stale-codex-key",
      OPENAI_BASE_URL: "https://stale.example.invalid",
      GH_TOKEN: "github-secret",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      NPM_TOKEN: "npm-secret",
      SSH_AUTH_SOCK: "/private/ssh-agent.sock",
      LANG: "en_US.UTF-8",
    },
    {
      home: "/isolated/home",
      codexHome: "/auth-only/codex",
      runtimePath: "/runtime/bin:/usr/bin:/bin",
    },
  );

  assert.equal(result.HOME, "/isolated/home");
  assert.equal(result.CODEX_HOME, "/auth-only/codex");
  assert.equal(result.PATH, "/runtime/bin:/usr/bin:/bin");
  assert.equal(result.CI, "1");
  assert.equal(result.NO_COLOR, "1");
  assert.equal(result.LANG, "en_US.UTF-8");
  assert.ok(Object.keys(result).every((key) => !key.startsWith("TAPD_")));
  assert.ok(Object.keys(result).every((key) => !key.startsWith("OPENAI_")));
  assert.ok(!("CODEX_API_KEY" in result));
  for (const secretName of ["GH_TOKEN", "AWS_SECRET_ACCESS_KEY", "NPM_TOKEN", "SSH_AUTH_SOCK"]) {
    assert.ok(!(secretName in result));
  }
});

test("Codex trigger runs are isolated and can persist only for lifecycle verification", async () => {
  const { buildCodexArgs, buildCodexResumeArgs } = await loadVerifier();
  const result = buildCodexArgs({
    workdir: "/tmp/fresh-repo",
    outputPath: "/tmp/fresh-repo/final.txt",
    prompt: "Review this repository.",
    toolHome: "/tmp/fresh-repo/home",
    toolPath: "/usr/bin:/bin:/usr/sbin:/sbin",
  });

  assert.deepEqual(result, [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--config",
    'shell_environment_policy.inherit="none"',
    "--config",
    'shell_environment_policy.set={PATH="/usr/bin:/bin:/usr/sbin:/sbin",HOME="/tmp/fresh-repo/home",CI="1",NO_COLOR="1"}',
    "--sandbox",
    "read-only",
    "--cd",
    "/tmp/fresh-repo",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--output-last-message",
    "/tmp/fresh-repo/final.txt",
    "--json",
    "Review this repository.",
  ]);

  const persistent = buildCodexArgs({
    workdir: "/tmp/fresh-repo",
    outputPath: "/tmp/fresh-repo/first.txt",
    prompt: "Start the lifecycle check.",
    toolHome: "/tmp/fresh-repo/home",
    toolPath: "/tmp/fake-bin:/usr/bin:/bin",
    ephemeral: false,
  });
  assert.ok(!persistent.includes("--ephemeral"));

  assert.deepEqual(
    buildCodexResumeArgs({
      threadId: "019fc5b7-286f-73c2-b9cf-d0401e5a465e",
      outputPath: "/tmp/fresh-repo/second.txt",
      prompt: "Continue the lifecycle check.",
      toolHome: "/tmp/fresh-repo/home",
      toolPath: "/tmp/fake-bin:/usr/bin:/bin",
    }),
    [
      "exec",
      "resume",
      "--ignore-user-config",
      "--ignore-rules",
      "--config",
      'shell_environment_policy.inherit="none"',
      "--config",
      'shell_environment_policy.set={PATH="/tmp/fake-bin:/usr/bin:/bin",HOME="/tmp/fresh-repo/home",CI="1",NO_COLOR="1"}',
      "--skip-git-repo-check",
      "--output-last-message",
      "/tmp/fresh-repo/second.txt",
      "--json",
      "019fc5b7-286f-73c2-b9cf-d0401e5a465e",
      "Continue the lifecycle check.",
    ],
  );
});

test("Auto Develop midpoint evidence survives a resumed turn in a private append-only ledger", async () => {
  const { assertTriggerBehavior } = await loadVerifier();
  const checkpoint = [
    "SKILL_ACTIVATED: eval-auto-develop",
    "Decision ledger: /tmp/private/example.md",
    "The private Markdown ledger uses append-only records with read-back verification.",
    "The same ledger is read before the resumed continuation.",
  ];

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-ledger-progress",
      checkpoint.join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-ledger-progress",
        checkpoint.filter((line) => !/append-only/i.test(line)).join("\n"),
        "eval-auto-develop",
      ),
    /durable append-only ledger/,
  );
});

test("Codex trigger evidence distinguishes autonomous delivery, repository workflow, TAPD sync, and explicit summary behavior", async () => {
  const { assertAutoDevelopNotTriggered, assertSummaryNotTriggered, assertTriggerBehavior } = await loadVerifier();

  const completeAutoDevelopOutput = [
    "SKILL_ACTIVATED: eval-auto-develop",
    "## Outcome",
    "All acceptance criteria passed.",
    "## Delivery Context",
    "Authorization: worktree; task branch; modify task files; commit; push; draft PR; bind or create tracking item.",
    "Source priority: develop > dev/main > main > master.",
    "Selected source branch: develop",
    "Starting commit: 0123456789abcdef0123456789abcdef01234567.",
    "Task branch: custom/repository-topic.",
    "Worktree: /tmp/feature-worktree; state ready.",
    "Decision ledger read-back: /tmp/private/auto-develop-example-decision-ledger.md; format Markdown; append-only updates verified; all reported nodes reconciled.",
    "Tracking match: unique candidate at 94%.",
    "Tracking action: automatically bound.",
    "Tracking read-back: verified bound item TASK-42.",
    "## Implemented",
    "Implemented the explicit invocation and autonomous delivery behavior.",
    "## Verification",
    "Command: npm test",
    "Result: passed (23/23).",
    "Validation status: passed after fixes.",
    "## Deep Review",
    "Deep review: one actionable recommended finding.",
    "Review fix status: applied.",
    "Re-review status: no actionable recommended findings remain.",
    "## Draft PR",
    "Draft PR read-back: URL https://example.invalid/pull/42; state draft; base develop; head custom/repository-topic.",
    "Decision tree:",
    "User goal",
    "|- D-01 Source branch",
    "|- D-02 Worktree",
    "|- D-03 Tracking",
    "|- D-04 Requirements",
    "|- D-05 Implementation",
    "|- D-06 Verification",
    "|- D-07 Review fixes",
    "`- D-08 Draft PR",
    "| Node | Trigger | Evidence | Options | Choice | Reason | Risk | Reversibility | User involvement | Outcome |",
    "| Source branch | Start delivery | Branch refs | develop, dev/main, main, master | develop | First available | Low | Change base before edits | Invocation | Base recorded |",
    "| Worktree | Isolate task | Worktree list | Create, reuse exact task worktree | Create | Preserve unrelated work | Low | Remove after merge | Invocation | Worktree ready |",
    "| Tracking | Match task | Unique 94% candidate | Bind, create, unavailable | Bind | Same delivery goal | Low | Rebind before writes | Invocation | Read-back verified |",
    "| Requirements | Define acceptance | User request and repository | Recommended implementation, alternatives | Recommended implementation | Best evidence | Low | Revise before commit | Not required | Criteria mapped |",
    "| Implementation | Satisfy criteria | Failing baseline | Minimal change, broader refactor | Minimal change | Smallest coherent scope | Low | Revert task commit | Not required | Behavior implemented |",
    "| Verification | Prove behavior | Test commands | Direct, expanded, substitute | Direct | Matches risk | Low | Add coverage | Not required | Passed |",
    "| Review fixes | Resolve findings | Deep review | Apply, defer with risk gate | Apply | Actionable and in scope | Low | Revert fix | Not required | Re-review clean |",
    "| Draft PR | Deliver change | PR read-back | Draft PR, risk-gate pause | Draft PR | Delivery complete | Low | Close PR | Invocation | URL and refs verified |",
    "Cleanup is outside this Skill and can be requested after merge.",
    "PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。",
  ];
  const insertBeforeFinalReminder = (report, ...lines) => [
    ...report.slice(0, -1),
    ...lines,
    report.at(-1),
  ];

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      completeAutoDevelopOutput.join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .filter((line) => !line.startsWith("Decision ledger read-back:"))
          .join("\n"),
        "eval-auto-develop",
      ),
    /durable decision ledger/,
  );
  const reportWithMaterialDecision = completeAutoDevelopOutput.flatMap((line) => {
    if (line === "|- D-06 Verification") return ["|- D-05.1 Verification strategy", line];
    if (line.startsWith("| Verification |")) {
      return [
        "| Verification strategy | Japanese labels overflow | Electron screenshot and measured widths | Expand buttons, truncate labels | Expand buttons | Preserve complete actions | Low | Revert CSS change | Not required | Labels fit |",
        line,
      ];
    }
    return [line];
  });
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      reportWithMaterialDecision.join("\n"),
      "eval-auto-develop",
    ),
  );
  for (const heading of [
    "## Outcome",
    "## Delivery Context",
    "## Implemented",
    "## Verification",
    "## Deep Review",
    "## Draft PR",
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.filter((line) => line !== heading).join("\n"),
          "eval-auto-develop",
        ),
      /complete execution report/,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => !line.startsWith("Starting commit:")).join("\n"),
        "eval-auto-develop",
      ),
    /starting commit/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line === "All acceptance criteria passed." ? "Delivery failed." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /successful outcome/,
  );
  for (const outcomeLines of [
    ["Not all acceptance criteria passed."],
    ["All acceptance criteria passed.", "Delivery failed."],
    ["All acceptance criteria passed.", "One acceptance criterion failed."],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .flatMap((line) => line === "All acceptance criteria passed." ? outcomeLines : [line])
            .join("\n"),
          "eval-auto-develop",
        ),
      /successful outcome/,
    );
  }
  for (const prefix of ["Command:", "Result:"]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.filter((line) => !line.startsWith(prefix)).join("\n"),
          "eval-auto-develop",
        ),
      /validation command and result/,
    );
  }
  assert.throws(
    () => {
      const reordered = [...completeAutoDevelopOutput];
      const commandIndex = reordered.indexOf("Command: npm test");
      const resultIndex = reordered.indexOf("Result: passed (23/23).");
      [reordered[commandIndex], reordered[resultIndex]] = [reordered[resultIndex], reordered[commandIndex]];
      assertTriggerBehavior("auto-develop", reordered.join("\n"), "eval-auto-develop");
    },
    /validation command and result/,
  );
  for (const extraValidation of [
    ["Command: npm run lint"],
    ["Command: npm run lint", "Result: failed."],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .flatMap((line) => line === "Result: passed (23/23)." ? [line, ...extraValidation] : [line])
            .join("\n"),
          "eval-auto-develop",
        ),
      /validation command and result/,
    );
  }
  for (const forbiddenClaim of [
    "PR merge status: completed.",
    "Cleanup status: completed.",
    "- PR merge status: completed.",
    "| Cleanup status | completed |",
    "| Status | PR was merged. |",
    "| Status | Cleanup was completed. |",
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(forbiddenClaim).join("\n"),
          "eval-auto-develop",
        ),
      /must not merge or clean/,
    );
  }
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      completeAutoDevelopOutput
        .map((line) => line === "Decision tree:" ? "**Decision tree:**" : line)
        .join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line === "Decision tree:" ? "**Decision tree:*" : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /traceable decision tree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("| Requirements |") ? line.replace("Criteria mapped", "Requirements satisfied") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /successful outcome for every delivery phase/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      completeAutoDevelopOutput
        .map((line) => {
          if (line.startsWith("Worktree:")) return "Worktree: /tmp/worktree-unavailable; state ready.";
          if (line.startsWith("Tracking read-back:")) return "Tracking read-back: verified bound item TASK-unverified.";
          return line;
        })
        .join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      insertBeforeFinalReminder(
        completeAutoDevelopOutput.map((line) => {
          if (line.startsWith("Task branch:")) return "Task branch: feat/主题+api.";
          if (line.startsWith("Draft PR read-back:")) return line.replace("head custom/repository-topic", "head feat/主题+api");
          return line;
        }),
        "The worktree notes reference `unavailable; historical`, (/tmp/worktree-unavailable), \"/tmp/task folder/unavailable\", (C:\\tmp\\unavailable), and \"C:\\task folder\\unavailable\"; it remains ready.",
        "Tracking notes reference TASK-unverified, task-unavailable, bug-unverified, foo-unverified, ITEM-no-longer-boundary, `unbound`, and ``unbound``; the item remains bound.",
      ).join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      insertBeforeFinalReminder(
        completeAutoDevelopOutput,
        "The worktree initially failed but is now ready.",
        "The tracking item was initially unbound but is now bound.",
        "The PR was initially not draft but is now draft.",
      ).join("\n"),
      "eval-auto-develop",
    ),
  );
  for (const narrative of [
    "The worktree is now ready after it initially failed.",
    "The tracking item is now bound after it was initially unbound.",
    "The PR is now draft after it was initially not draft.",
    "Validation passed after it initially failed.",
    "Deep review fix was later applied after it initially failed.",
    "Validation initially failed but later passed.",
    "Deep review fix initially failed but was later applied.",
    "Validation did not fail and completed without failure.",
    "Deep review did not fail and completed without failure.",
    "No tests failed.",
    "Tests are not failing.",
    "No review findings remain unresolved.",
    "Tests cover failure handling.",
    "Validation includes tests for missing credentials.",
    "The worktree failed after it was ready, but then it became ready again.",
    "The tracking item became unbound after it was bound, but then it became bound again.",
    "The PR was not draft after it was draft, but then it became draft again.",
    "Validation failed after it passed, but then it passed again.",
    "Deep review fix failed after it was applied, but then it succeeded.",
    "Validation initially failed but passed.",
    "Deep review fix initially failed but succeeded.",
    "None of the tests failed.",
    "No validation checks failed.",
    "No review fixes failed.",
    "Tests cover failed login attempts.",
    "Tests cover skipped-job handling.",
    "Implementation handles failed requests.",
    "Requirements cover failed requests.",
    "Tests for failed requests passed.",
    "Validation covers failing requests.",
    "Implementation handles unavailable services.",
    "No tests were skipped.",
    "Validation is not pending.",
    "Re-review is not incomplete.",
    "The worktree is not pending.",
    "The tracking item is not deferred.",
    "Implementation is not incomplete.",
    "Source branch selection failed initially; develop was later selected.",
    "Requirements failed initially; acceptance criteria were later mapped.",
    "Implementation failed initially; the final change later succeeded.",
    "Validation initially failed, yet eventually passed.",
  ]) {
    assert.doesNotThrow(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          insertBeforeFinalReminder(completeAutoDevelopOutput, narrative).join("\n"),
          "eval-auto-develop",
        ),
      narrative,
    );
  }
  for (const [node, originalEvidence, coverageEvidence] of [
    ["Verification", "Test commands", "Failure-path tests"],
    ["Verification", "Test commands", "Tests for unavailable service handling"],
    ["Verification", "Test commands", "None of the tests failed"],
    ["Implementation", "Failing baseline", "Implementation failed initially but later succeeded"],
  ]) {
    assert.doesNotThrow(() =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith(`| ${node} |`) ? line.replace(originalEvidence, coverageEvidence) : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    );
  }
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      completeAutoDevelopOutput
        .map((line) => line.startsWith("| Worktree |") ? line.replace("Create, reuse exact task worktree", "Create \\| reuse exact task worktree") : line)
        .join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      insertBeforeFinalReminder(
        completeAutoDevelopOutput,
        "Worktree validation initially failed but the tests later passed.",
        "Validation of the tracking item initially failed but the tests later passed.",
        "PR validation initially failed but the tests later passed.",
      ).join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree became ready after retry, but then the worktree was removed.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The binding was rolled-back; retry tests passed.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The PR is non-draft and merged; retry tests passed.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree failed and it is now ready but later failed again.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The tracking item was unbound and is now bound but later became unbound again.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The PR was not draft and is now draft but later merged.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree failed. It is now ready.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Validation failed.").join("\n"),
        "eval-auto-develop",
      ),
    /revalidation/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Deep review fix failed.").join("\n"),
        "eval-auto-develop",
      ),
    /review and fix/,
  );
  for (const [narrative, expectedError] of [
    ["Review fixes failed.", /review and fix/],
    ["Review findings remain unfixed.", /review and fix/],
    ["Re-review is unclean.", /review and fix/],
    ["Deep review remains unresolved.", /review and fix/],
    ["Tests are failing.", /revalidation/],
    ["Validation is unsuccessful.", /revalidation/],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(narrative).join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [narrative, expectedError] of [
    ["The worktree isn't ready.", /verified worktree/],
    ["The tracking item isn't bound.", /tracking read-back/],
    ["The PR isn't draft.", /draft PR/i],
    ["Tests aren't passing.", /revalidation/],
    ["Re-review isn't clean.", /review and fix/],
    ["The source branch was not selected.", /phase evidence/],
    ["Requirements are not met.", /phase evidence/],
    ["Implementation was abandoned.", /phase evidence/],
    ["Requirements remain unsatisfied.", /phase evidence/],
    ["Implementation remains unfinished.", /phase evidence/],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(narrative).join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [narrative, expectedError] of [
    ["The worktree is now ready after retry, but then it was removed.", /verified worktree/],
    ["The tracking item is now bound after retry, but then it became unbound.", /tracking read-back/],
    ["The PR is now draft after retry, but then it was merged.", /draft PR/i],
    ["Validation passed after retry, but then it failed.", /revalidation/],
    ["Deep review fix was applied after retry, but then it failed.", /review and fix/],
    ["The worktree is now ready after retry; then it was removed.", /verified worktree/],
    ["The tracking item is now bound after retry and then it became unbound.", /tracking read-back/],
    ["The PR is now draft after retry, and then it was merged.", /draft PR/i],
    ["Validation passed after retry but then validation failed.", /revalidation/],
    ["Deep review fix was applied after retry; however, review fix failed.", /review and fix/],
    ["The worktree is now ready after retry, but it was later removed.", /verified worktree/],
    ["Tests cover authentication scenarios despite the tests being skipped.", /revalidation/],
    ["Validation covers authentication scenarios yet remains pending.", /revalidation/],
    ["Tests cover authentication scenarios (the tests were skipped).", /revalidation/],
    ["The worktree is now ready after retry but later it was removed.", /verified worktree/],
    ["Validation passed after retry but later validation failed.", /revalidation/],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(narrative).join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Selected source branch:") ? "Selected source branch: develop; branch selection failed." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /first available source branch/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Selected source branch:") ? "Selected source branch: develop because develop was unavailable." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /first available source branch/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Deep review:") ? "Deep review: one actionable recommended finding, but deep review failed." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /review and fix/,
  );
  for (const [narrative, expectedError] of [
    ["Tests were skipped.", /revalidation/],
    ["Validation remains pending.", /revalidation/],
    ["Deep review was skipped.", /review and fix/],
    ["Re-review remains pending.", /review and fix/],
    ["The worktree remains pending.", /verified worktree/],
    ["The tracking item remains pending.", /tracking read-back/],
    ["The PR remains deferred.", /draft PR/i],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(narrative).join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [narrative, expectedError] of [
    ["The worktree was removed during validation, which later passed.", /verified worktree/],
    ["The tracking item became unbound during validation, which later passed.", /tracking read-back/],
    ["The PR was closed during validation, which later passed.", /draft PR/i],
    ["Validation found the worktree unavailable, but tests later passed.", /verified worktree/],
    ["Validation found the tracking item unbound, but tests later passed.", /tracking read-back/],
    ["Validation reported the PR merged, but tests later passed.", /draft PR/i],
    ["Worktree validation found the worktree unavailable, but tests later passed.", /verified worktree/],
    ["Tracking item validation found the item unbound, but tests later passed.", /tracking read-back/],
    ["PR validation reported the PR merged, but tests later passed.", /draft PR/i],
    ["Validation on the worktree found it removed, but tests later passed.", /verified worktree/],
    ["Validation on the tracking item found it unbound, but tests later passed.", /tracking read-back/],
    ["Validation on the PR reported it merged, but tests later passed.", /draft PR/i],
    ["Worktree validation confirmed it was unavailable, but tests later passed.", /verified worktree/],
    ["Tracking item validation detected it was unbound, but tests later passed.", /tracking read-back/],
    ["PR validation confirmed it was merged, but tests later passed.", /draft PR/i],
    ["Validation on the worktree diagnosed it as removed, but tests later passed.", /verified worktree/],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput.concat(narrative).join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [node, originalEvidence, contradictoryEvidence, expectedError] of [
    ["Worktree", "Worktree list", "Worktree was removed", /verified worktree/],
    ["Tracking", "Unique 94% candidate", "Tracking item is unbound", /tracking read-back/],
    ["Verification", "Test commands", "Validation failed", /revalidation/],
    ["Review fixes", "Deep review", "Review fix remained unfixed", /review and fix/],
    ["Draft PR", "PR read-back", "PR was merged", /draft PR/i],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => line.startsWith(`| ${node} |`) ? line.replace(originalEvidence, contradictoryEvidence) : line)
            .join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [node, originalEvidence, expectedError] of [
    ["Source branch", "Branch refs", /phase evidence/],
    ["Worktree", "Worktree list", /verified worktree/],
    ["Tracking", "Unique 94% candidate", /tracking read-back/],
    ["Requirements", "User request and repository", /phase evidence/],
    ["Implementation", "Failing baseline", /phase evidence/],
    ["Verification", "Test commands", /revalidation/],
    ["Review fixes", "Deep review", /review and fix/],
    ["Draft PR", "PR read-back", /draft PR/i],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => line.startsWith(`| ${node} |`) ? line.replace(originalEvidence, "Command failed") : line)
            .join("\n"),
          "eval-auto-develop",
        ),
      expectedError,
    );
  }
  for (const [node, originalEvidence, contradictoryEvidence] of [
    ["Source branch", "Branch refs", "Selection failed but requirements mapped"],
    ["Requirements", "User request and repository", "Requirements failed but implementation is complete"],
    ["Implementation", "Failing baseline", "Implementation failed but source branch selected"],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => line.startsWith(`| ${node} |`) ? line.replace(originalEvidence, contradictoryEvidence) : line)
            .join("\n"),
          "eval-auto-develop",
        ),
      /phase evidence/,
    );
  }
  for (const [node, originalEvidence, contradictoryEvidence] of [
    ["Source branch", "Branch refs", "Source branch selection failed; none was selected"],
    ["Requirements", "User request and repository", "Requirements failed; unrelated criteria were mapped"],
    ["Implementation", "Failing baseline", "Implementation failed; an unrelated change succeeded"],
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => line.startsWith(`| ${node} |`) ? line.replace(originalEvidence, contradictoryEvidence) : line)
            .join("\n"),
          "eval-auto-develop",
        ),
      /phase evidence/,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .filter((line) => !/^\|- D-\d{2} (?:Worktree|Tracking|Requirements|Implementation|Verification|Review fixes)$/.test(line))
          .filter((line) => line !== "`- D-08 Draft PR")
          .map((line) => line === "|- D-01 Source branch" ? "|- D-01 Source branch Worktree Tracking Requirements Implementation Verification Review fixes Draft PR" : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /omitted or reordered a delivery phase/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .flatMap((line) => line === "|- D-04 Requirements" ? [line, "Unconnected note"] : [line])
          .join("\n"),
        "eval-auto-develop",
      ),
    /malformed or disconnected decision/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.replace(/^\|-\s+|^`-\s+/, ""))
          .join("\n"),
        "eval-auto-develop",
      ),
    /malformed or disconnected decision/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => /^\| (?:Source branch|Worktree|Tracking|Requirements|Implementation|Verification|Review fixes|Draft PR) \|/.test(line) ? line.replace(/^\| ([^|]+?) \|/, "| Fake $1 |") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /decision details/,
  );
  assert.throws(
    () => {
      const reordered = [...completeAutoDevelopOutput];
      const worktreeIndex = reordered.findIndex((line) => line.startsWith("| Worktree |"));
      const trackingIndex = reordered.findIndex((line) => line.startsWith("| Tracking |"));
      [reordered[worktreeIndex], reordered[trackingIndex]] = [reordered[trackingIndex], reordered[worktreeIndex]];
      assertTriggerBehavior("auto-develop", reordered.join("\n"), "eval-auto-develop");
    },
    /decision details/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        [
          completeAutoDevelopOutput[0],
          "| Node | Summary |",
          "| Worktree | unrelated preface |",
          ...completeAutoDevelopOutput.slice(1).map((line) =>
            line.startsWith("| Worktree |") ? line.replace("Worktree list", "Worktree was removed") : line,
          ),
        ].join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree remains non-ready.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The tracking item is not-bound.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The PR is not-draft.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Additional report content.").join("\n"),
        "eval-auto-develop",
      ),
    /post-merge cleanup reminder/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree was not created; it is now available.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The item is no longer bound; it is now verified.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The pull request was merged; it is now verified.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      insertBeforeFinalReminder(
        completeAutoDevelopOutput,
        "Worktree setup initially failed; retry succeeded and it is now ready.",
        "Tracking read-back initially returned no item; retry succeeded and the item is now bound.",
        "Draft PR creation failed once; retry succeeded and the PR is now draft.",
      ).join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop",
      insertBeforeFinalReminder(
        completeAutoDevelopOutput,
        "The worktree is now ready after validation initially failed and the tests later passed.",
        "The tracking item remains bound while validation initially failed but the tests later passed.",
        "The PR is now draft while validation initially failed but the tests later passed.",
      ).join("\n"),
      "eval-auto-develop",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Worktree:") ? "Worktree: not created." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Worktree:") ? "Worktree: ~/feature-worktree; state ready." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree could not be created.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The worktree no longer exists because it was removed.").join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Worktree:") ? "Worktree: not created; state ready." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Tracking read-back:") ? "Tracking read-back: failed." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The tracking item could not be read back.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The tracking lookup returned no item; binding could not be confirmed.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The item is no longer bound; the binding was rolled back.").join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Tracking read-back:") ? "Tracking read-back: verified bound item none." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => !line.startsWith("Authorization:")).join("\n"),
        "eval-auto-develop",
      ),
    /commit and push authorization/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Authorization:") ? line.replace("modify task files; ", "") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /complete task-scoped authorization/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Authorization:") ? `Authorization: not authorized to ${line.slice("Authorization: ".length)}` : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /complete task-scoped authorization/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("May I create the task branch?").join("\n"),
        "eval-auto-develop",
      ),
    /asked again for an authorized operation/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => !line.startsWith("Source priority:")).join("\n"),
        "eval-auto-develop",
      ),
    /source branch priority/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Source priority:") ? "Source priority: develop-old > dev/main > main > master." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /source branch priority/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Selected source branch:") ? "Selected source branch: develop-old" : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /first available source branch/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .filter((line) => !line.startsWith("Deep review:") && !line.startsWith("Review fix status:") && !line.startsWith("Re-review status:"))
          .join("\n"),
        "eval-auto-develop",
      ),
    /review and fix recommended findings/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) =>
            line.startsWith("Review fix status:")
              ? "Review fix status: recommended findings remained unfixed."
              : line,
          )
          .join("\n"),
        "eval-auto-develop",
      ),
    /review and fix recommended findings/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => !line.startsWith("Re-review status:")).join("\n"),
        "eval-auto-develop",
      ),
    /re-review the repaired diff/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .filter((line) => !line.startsWith("Draft PR read-back:"))
          .concat("Draft PR: target develop.")
          .join("\n"),
        "eval-auto-develop",
      ),
    /read back the draft PR/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Draft PR read-back:") ? line.replace("head custom/repository-topic", "head develop") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /read back the draft PR/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => {
            if (line.startsWith("Task branch:")) return "Task branch: none.";
            if (line.startsWith("Draft PR read-back:")) return line.replace("head custom/repository-topic", "head none");
            return line;
          })
          .join("\n"),
        "eval-auto-develop",
      ),
    /task branch|read back the draft PR/,
  );
  for (const invalidBranch of ["HEAD", "custom//topic", "custom/../topic", "/custom/topic", "custom/topic.lock"]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => {
              if (line.startsWith("Task branch:")) return `Task branch: ${invalidBranch}.`;
              if (line.startsWith("Draft PR read-back:")) return line.replace("head custom/repository-topic", `head ${invalidBranch}`);
              return line;
            })
            .join("\n"),
          "eval-auto-develop",
        ),
      /task branch/,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Draft PR read-back:") ? line.replace("base develop;", "base develop-old;") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /read back the draft PR/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Draft PR read-back:") ? `${line} Read-back failed.` : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /read back the draft PR/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Draft PR read-back:") ? `${line}; state closed` : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /read back the draft PR/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Tracking action: none.").join("\n"),
        "eval-auto-develop",
      ),
    /duplicate status record/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Tracking match:") ? "Tracking match: candidate A 94%; candidate B 94%." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /unique 94% tracking match/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("Tracking match:") ? "Tracking match: not unique; candidate A at 94%." : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /unique 94% tracking match/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Draft PR read-back: unavailable.").join("\n"),
        "eval-auto-develop",
      ),
    /duplicate status record/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => line !== "User goal").join("\n"),
        "eval-auto-develop",
      ),
    /user goal root/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("External dependency blocker: PR service unavailable.").join("\n"),
        "eval-auto-develop",
      ),
    /successful and paused delivery states/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Blocker: The worktree could not be created.").join("\n"),
        "eval-auto-develop",
      ),
    /successful and paused delivery states/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) =>
            line.startsWith("| Node |")
              ? "| Node | Trigger | Options | Choice | Reason | Risk | User involvement | Outcome |"
              : line,
          )
          .join("\n"),
        "eval-auto-develop",
      ),
    /decision evidence and reversibility/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.filter((line) => !line.startsWith("| Tracking |")).join("\n"),
        "eval-auto-develop",
      ),
    /decision details for every delivery phase/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .map((line) => line.startsWith("| Worktree |") ? line.replace("Worktree ready", "Worktree could not be created") : line)
          .join("\n"),
        "eval-auto-develop",
      ),
    /successful outcome for every delivery phase/,
  );
  const invalidDecisionOutcomes = [
    ["| Source branch |", "Base recorded", "Base unrecorded"],
    ["| Worktree |", "Worktree ready", "Already"],
    ["| Requirements |", "Criteria mapped", "Criteria unmapped"],
    ["| Implementation |", "Behavior implemented", "Behavior unimplemented"],
    ["| Verification |", "Passed", "Bypassed"],
    ["| Verification |", "Passed", "Not passed"],
    ["| Review fixes |", "Re-review clean", "Re-review unclean"],
  ];
  for (const [rowPrefix, validOutcome, invalidOutcome] of invalidDecisionOutcomes) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop",
          completeAutoDevelopOutput
            .map((line) => line.startsWith(rowPrefix) ? line.replace(validOutcome, invalidOutcome) : line)
            .join("\n"),
          "eval-auto-develop",
        ),
      /successful outcome for every delivery phase/,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput
          .concat("Please choose a workspace strategy.", "Please select a validation scope.")
          .join("\n"),
        "eval-auto-develop",
      ),
    /asked for routine workspace or validation selection/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("Use $auto-develop to clean the worktree after merge.").join("\n"),
        "eval-auto-develop",
      ),
    /incorrectly routed cleanup through auto-develop/,
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-create",
      [
        "SKILL_ACTIVATED: eval-auto-develop-create",
        "Source priority: develop > dev/main > main > master.",
        "Selected source branch: main because develop and dev/main do not exist.",
        "Worktree: /tmp/create-worktree; state ready.",
        "Tracking match: none.",
        "Tracking creation readiness: 93%.",
        "Tracking action: automatically created and bound.",
        "Tracking read-back: verified created and bound item TASK-43.",
      ].join("\n"),
      "eval-auto-develop-create",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-create",
        [
          "SKILL_ACTIVATED: eval-auto-develop-create",
          "Source priority: develop > dev/main > main > master.",
          "Selected source branch: main.",
          "Worktree: /tmp/create-worktree; state ready.",
          "Tracking match: none.",
          "Tracking creation readiness: 93%.",
          "Tracking action: automatically created but not bound.",
          "Tracking read-back: failed.",
        ].join("\n"),
        "eval-auto-develop-create",
      ),
    /automatically create and bind/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-create",
        [
          "SKILL_ACTIVATED: eval-auto-develop-create",
          "Source priority: develop > dev/main > main > master.",
          "Selected source branch: main.",
          "Worktree: /tmp/create-worktree; state ready.",
          "Tracking match: none.",
          "Tracking creation readiness: 93%.",
          "Tracking action: automatically created and bound.",
          "Tracking read-back: failed.",
        ].join("\n"),
        "eval-auto-develop-create",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-create",
        [
          "SKILL_ACTIVATED: eval-auto-develop-create",
          "Source priority: develop > dev/main > main > master.",
          "Selected source branch: main.",
          "Worktree: /tmp/create-worktree; state ready.",
          "Tracking match: none.",
          "Tracking creation readiness: 93%.",
          "Tracking action: automatically created and bound.",
          "Tracking read-back: verified created and bound item \"none\".",
        ].join("\n"),
        "eval-auto-develop-create",
      ),
    /tracking read-back/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-create",
        [
          "SKILL_ACTIVATED: eval-auto-develop-create",
          "Source priority: develop > dev/main > main > master.",
          "Selected source branch: main-feature.",
          "Worktree: /tmp/create-worktree; state ready.",
          "Tracking match: none.",
          "Tracking creation readiness: 93%.",
          "Tracking action: automatically created and bound.",
          "Tracking read-back: verified created and bound item TASK-43.",
        ].join("\n"),
        "eval-auto-develop-create",
      ),
    /automatically create and bind/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-risk",
      [
        "SKILL_ACTIVATED: eval-auto-develop-risk",
        "Tracking match: candidate A 94%; candidate B 92%.",
        "Tracking write: none.",
        "Risk gate status: paused.",
        "Verified facts: both candidates represent plausible delivery goals.",
        "Blocker: selecting either could create a business conflict.",
        "Recommendation: choose the candidate with the exact acceptance criteria.",
        "Alternatives: bind the other candidate or create a separate item.",
        "Consequences: the wrong binding would misreport delivery ownership.",
      ].join("\n"),
      "eval-auto-develop-risk",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-risk",
      [
        "SKILL_ACTIVATED: eval-auto-develop-risk",
        "Tracking match: candidate B 92%; candidate A 94%.",
        "Tracking write: none.",
        "Risk gate status: paused.",
        "Verified facts: both candidates represent plausible delivery goals.",
        "Blocker: selecting either could create a business conflict.",
        "Recommendation: choose the candidate with the exact acceptance criteria.",
        "Alternatives: bind the other candidate or create a separate item.",
        "Consequences: the wrong binding would misreport delivery ownership.",
      ].join("\n"),
      "eval-auto-develop-risk",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 194%; candidate B 192%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /conflicting high-confidence matches/,
  );
  for (const trackingMatch of [
    "Tracking match: candidate A 94%; candidate A 92%.",
    "Tracking match: scores 94% and 92%.",
  ]) {
    assert.throws(
      () =>
        assertTriggerBehavior(
          "auto-develop-risk",
          [
            "SKILL_ACTIVATED: eval-auto-develop-risk",
            trackingMatch,
            "Tracking write: none.",
            "Risk gate status: paused.",
            "Verified facts: both candidates represent plausible delivery goals.",
            "Blocker: selecting either could create a business conflict.",
            "Recommendation: choose the candidate with the exact acceptance criteria.",
            "Alternatives: bind the other candidate or create a separate item.",
            "Consequences: the wrong binding would misreport delivery ownership.",
          ].join("\n"),
          "eval-auto-develop-risk",
        ),
      /conflicting high-confidence matches/,
    );
  }
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
          "The tracking item is bound.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
          "| Result | The tracking item is bound. |",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates are plausible, and the tracking item is bound.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-risk",
      [
        "SKILL_ACTIVATED: eval-auto-develop-risk",
        "Tracking match: candidate A 94%; candidate B 92%.",
        "Tracking write: none.",
        "Risk gate status: paused.",
        "Verified facts: both candidates represent plausible delivery goals.",
        "Blocker: selecting either could create a business conflict.",
        "Recommendation: choose the candidate with the exact acceptance criteria.",
        "Alternatives: bind the other candidate or create a separate item.",
        "Consequences: None affect repository integrity; PR delivery remains blocked.",
      ].join("\n"),
      "eval-auto-develop-risk",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: not yet known.",
          "Blocker: undetermined.",
          "Recommendation: \"currently unknown\".",
          "Alternatives: 目前未知。",
          "Consequences: 待确认。",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /non-placeholder pause evidence/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none. Despite this, a write occurred.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Tracking read-back: verified bound item TASK-42.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Tracking write: completed.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /duplicate status record/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The draft PR read-back failed.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat(
          "The worktree failed; it is now ready;",
          "it failed again.",
        ).join("\n"),
        "eval-auto-develop",
      ),
    /verified worktree/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The pull request is no longer draft and was closed.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop",
        completeAutoDevelopOutput.concat("The PR is ready for review rather than draft and was merged.").join("\n"),
        "eval-auto-develop",
      ),
    /draft PR/i,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking match: none.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /duplicate status record/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
          "PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-risk",
        [
          "SKILL_ACTIVATED: eval-auto-develop-risk",
          "Tracking match: candidate A 94%; candidate B 92%.",
          "Tracking write: none.",
          "Risk gate status: paused.",
          "Verified facts: both candidates represent plausible delivery goals.",
          "Blocker: selecting either could create a business conflict.",
          "Recommendation: choose the candidate with the exact acceptance criteria.",
          "Alternatives: bind the other candidate or create a separate item.",
          "Consequences: the wrong binding would misreport delivery ownership.",
          "Review fix status: applied.",
          "Validation status: passed after fixes.",
        ].join("\n"),
        "eval-auto-develop-risk",
      ),
    /without a tracking write/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "auto-develop-blocked",
      [
        "SKILL_ACTIVATED: eval-auto-develop-blocked",
        "External dependency blocker: the PR service is unavailable.",
        "Safe alternatives: exhausted.",
        "Risk gate status: paused.",
        "Verified facts: implementation and validation passed, but no PR state can be read back.",
        "Preserved work: worktree and completed implementation.",
        "Resume condition: the external service recovers.",
        "Recommendation: retry PR creation after the service recovers.",
        "Alternatives: preserve the branch or hand off the verified commit.",
        "Consequences: no draft PR can be verified until the service recovers.",
      ].join("\n"),
      "eval-auto-develop-blocked",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed, but no PR state can be read back.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation: retry PR creation after the service recovers.",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
          "The draft PR is draft.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /must not report draft PR success/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed, but no PR state can be read back.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation: retry PR creation after the service recovers.",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
          "| Result | The draft PR is now draft. |",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /must not report draft PR success/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation passed, and the draft PR is draft.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation: retry PR creation after the service recovers.",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /must not report draft PR success/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: 无阻塞。",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: （未知）。",
          "Preserved work: 待定。",
          "Resume condition: 尚不清楚。",
          "Recommendation: 暂无。",
          "Alternatives: 未提供。",
          "Consequences: 无法确定。",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /non-placeholder pause evidence/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: not exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation: retry PR creation after the service recovers.",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /exhausted external-dependency blocker/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /recommendation, alternatives, and consequences/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation:",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /non-empty pause evidence/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "auto-develop-blocked",
        [
          "SKILL_ACTIVATED: eval-auto-develop-blocked",
          "External dependency blocker: the PR service is unavailable.",
          "Safe alternatives: exhausted.",
          "Safe alternatives: available.",
          "Risk gate status: paused.",
          "Verified facts: implementation and validation passed.",
          "Preserved work: worktree and completed implementation.",
          "Resume condition: the external service recovers.",
          "Recommendation: retry PR creation after the service recovers.",
          "Alternatives: preserve the branch or hand off the verified commit.",
          "Consequences: no draft PR can be verified until the service recovers.",
        ].join("\n"),
        "eval-auto-develop-blocked",
      ),
    /duplicate status record/,
  );
  assert.doesNotThrow(() =>
    assertAutoDevelopNotTriggered(
      "I can implement the requested repository feature automatically.",
      "eval-auto-develop-negative",
    ),
  );
  assert.throws(
    () =>
      assertAutoDevelopNotTriggered(
        "SKILL_ACTIVATED: eval-auto-develop-negative\nStarting autonomous delivery.",
        "eval-auto-develop-negative",
      ),
    /unexpectedly activated/,
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "roxis-way",
      [
        "SKILL_ACTIVATED: eval-roxis-way",
        "开始仓库任务前，请先选择工作区策略：",
        "1. 使用 git worktree",
        "2. 在当前工作区创建独立分支",
        "3. 在当前分支继续",
        "4. 其他方式",
        "同时请选择验收或验证范围：",
        "1. 直接相关功能测试",
        "2. 间接相关功能测试",
        "3. 完整测试套件",
        "4. 其他范围",
      ].join("\n"),
      "eval-roxis-way",
    ),
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "roxis-way",
      "请选择工作区策略和验收范围。",
      "eval-roxis-way",
    ),
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "roxis-way",
      "SKILL_ACTIVATED: eval-roxis-way\n请选择工作区策略和验收范围。",
      "eval-roxis-way",
    ),
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync",
      "SKILL_ACTIVATED: eval-tapd-sync\nREADME improvement: document the thirteen-agent installation command.\n\nTAPD is not configured on this device, so sync is disabled.",
      "eval-tapd-sync",
    ),
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "tapd-sync",
      "SKILL_ACTIVATED: eval-tapd-sync\nTAPD is not configured on this device, so sync is disabled.\nREADME improvement: document the thirteen-agent installation command.",
      "eval-tapd-sync",
    ),
    /final TAPD status at the end/,
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "tapd-sync",
      "TAPD is not configured on this device, so sync is disabled.",
      "eval-tapd-sync",
    ),
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-first-match",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-lifecycle",
        "README improvement: clarify the agent installation command.",
        "TAPD: [【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent) - Recommended parent",
      ].join("\n"),
      "eval-tapd-sync-lifecycle",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-first-match",
        "SKILL_ACTIVATED: eval-tapd-sync-lifecycle\nREADME improvement without a linked candidate.",
        "eval-tapd-sync-lifecycle",
      ),
    /first read-only match/,
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-bound",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-bound",
        "README improvement: document the thirteen-agent installation command.",
        "",
        "TAPD: [Improve skill delivery](https://tapd.example.invalid/workitems/parent) | [Review installation docs](https://tapd.example.invalid/workitems/child)",
      ].join("\n"),
      "eval-tapd-sync-bound",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-bound",
        "SKILL_ACTIVATED: eval-tapd-sync-bound\nREADME improvement.\n\nTAPD: Improve skill delivery",
        "eval-tapd-sync-bound",
      ),
    /linked TAPD work items at the end/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-selected-candidate",
      "SKILL_ACTIVATED: eval-tapd-sync-lifecycle\nBound.\nTAPD: [【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
      "eval-tapd-sync-lifecycle",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-selected-candidate",
        "SKILL_ACTIVATED: eval-tapd-sync-lifecycle\nTAPD: [cached item](https://tapd.example.invalid/workitems/parent)",
        "eval-tapd-sync-lifecycle",
      ),
    /selected candidate/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-query-default",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-query-default",
        "All matching nonterminal work items:",
        "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
        "The default nonterminal scope was applied.",
      ].join("\n"),
      "eval-tapd-sync-query-default",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-query-default",
        [
          "SKILL_ACTIVATED: eval-tapd-sync-query-default",
          "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
          "[【Trigger Evaluation Repository】Improve README agent documentation (completed)](https://tapd.example.invalid/workitems/parent-done)",
        ].join("\n"),
        "eval-tapd-sync-query-default",
      ),
    /default an all-items query to nonterminal results/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-query-inclusive",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive",
        "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
        "[【Trigger Evaluation Repository】Improve README agent documentation (completed)](https://tapd.example.invalid/workitems/parent-done)",
      ].join("\n"),
      "eval-tapd-sync-query-inclusive",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-query-inclusive",
        [
          "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive",
          "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
          "The completed item was omitted: 【Trigger Evaluation Repository】Improve README agent documentation (completed)",
        ].join("\n"),
        "eval-tapd-sync-query-inclusive",
      ),
    /include terminal results/,
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-query-inclusive-incomplete",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive-incomplete",
        "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
        "Terminal coverage is incomplete, so this is not a complete terminal-inclusive result.",
      ].join("\n"),
      "eval-tapd-sync-query-inclusive-incomplete",
    ),
  );
  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-query-inclusive-incomplete",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive-incomplete",
        "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
        "Not all terminal work items were returned because terminal coverage is incomplete.",
      ].join("\n"),
      "eval-tapd-sync-query-inclusive-incomplete",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-query-inclusive-incomplete",
        "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive-incomplete\n[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)\nAll matching work items were returned.",
        "eval-tapd-sync-query-inclusive-incomplete",
      ),
    /report incomplete terminal coverage/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-query-inclusive-incomplete",
        [
          "SKILL_ACTIVATED: eval-tapd-sync-query-inclusive-incomplete",
          "[【Trigger Evaluation Repository】Improve README agent documentation](https://tapd.example.invalid/workitems/parent)",
          "Terminal coverage is incomplete, but all matching work items were returned.",
        ].join("\n"),
        "eval-tapd-sync-query-inclusive-incomplete",
      ),
    /report incomplete terminal coverage/,
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-bound",
        "SKILL_ACTIVATED: eval-tapd-sync-bound\nTAPD: [Improve skill delivery](https://tapd.example.invalid/workitems/parent)\nREADME improvement.",
        "eval-tapd-sync-bound",
      ),
    /linked TAPD work items at the end/,
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-dormant",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-dormant",
        "README improvement: document the thirteen-agent installation command.",
      ].join("\n"),
      "eval-tapd-sync-dormant",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-dormant",
        [
          "SKILL_ACTIVATED: eval-tapd-sync-dormant",
          "README improvement: document the thirteen-agent installation command.",
          "TAPD is not configured on this device, so sync is disabled.",
        ].join("\n"),
        "eval-tapd-sync-dormant",
      ),
    /dormant TAPD sync emitted TAPD output/,
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-sync-reactivated",
      [
        "SKILL_ACTIVATED: eval-tapd-sync-reactivated",
        "I cannot create the requested parent work item in this environment.",
        "TAPD is not configured on this device, so sync is disabled.",
      ].join("\n"),
      "eval-tapd-sync-reactivated",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-sync-reactivated",
        "SKILL_ACTIVATED: eval-tapd-sync-reactivated\nNo TAPD action was attempted.",
        "eval-tapd-sync-reactivated",
      ),
    /explicit parent request did not reactivate TAPD sync/,
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "tapd-sync",
      "SKILL_ACTIVATED: eval-tapd-sync\nTAPD is not configured on this device, so sync is disabled.",
      "eval-tapd-sync",
    ),
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-summary",
      "SKILL_ACTIVATED: tapd-summary\nA complete TAPD summary is unavailable.",
      "tapd-summary",
    ),
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "tapd-summary",
      "A complete TAPD summary is unavailable.",
      "tapd-summary",
    ),
  );

  assert.doesNotThrow(() =>
    assertTriggerBehavior(
      "tapd-summary-capable",
      "SKILL_ACTIVATED: eval-tapd-summary-capable\nToday\n【Trigger Evaluation Repository】Improve README agent documentation",
      "eval-tapd-summary-capable",
    ),
  );
  assert.throws(
    () =>
      assertTriggerBehavior(
        "tapd-summary-capable",
        "SKILL_ACTIVATED: eval-tapd-summary-capable\nA complete TAPD summary is unavailable.",
        "eval-tapd-summary-capable",
      ),
    /capable read-only adapter/,
  );

  assert.doesNotThrow(() =>
    assertSummaryNotTriggered("Today's local documentation task is to clarify installation.", "eval-tapd-summary-negative"),
  );
  assert.throws(
    () =>
      assertSummaryNotTriggered(
        "SKILL_ACTIVATED: eval-tapd-summary-negative\nTAPD summary",
        "eval-tapd-summary-negative",
      ),
    /unexpectedly activated/,
  );
});

test("Codex implicit trigger evaluation uses an isolated alias without changing the skill workflow", async () => {
  const { createEvalSkill } = await loadVerifier();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-trigger-verifier-test-"));

  try {
    const evalSkill = await createEvalSkill({
      sourceSkill: path.join(root, "skills", "roxis-way"),
      skillsRoot: path.join(tempRoot, ".agents", "skills"),
      evalName: "eval-roxis-way",
    });
    const skillContents = await readFile(path.join(evalSkill, "SKILL.md"), "utf8");
    const openai = YAML.parse(await readFile(path.join(evalSkill, "agents", "openai.yaml"), "utf8"));

    assert.equal(parseFrontmatter(skillContents).name, "eval-roxis-way");
    assert.match(parseFrontmatter(skillContents).description, /repository/i);
    assert.match(skillContents, /# Roxi's Way/);
    assert.match(skillContents, /SKILL_ACTIVATED: eval-roxis-way/);
    assert.match(openai.interface.default_prompt, /\$eval-roxis-way/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("Codex trigger output falls back to the final agent message in the JSON event stream", async () => {
  const { resolveCodexOutput } = await loadVerifier();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-trigger-output-test-"));
  const missingOutputPath = path.join(tempRoot, "missing-final.txt");

  try {
    const output = await resolveCodexOutput({
      outputPath: missingOutputPath,
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "test-thread" }),
        JSON.stringify({
          type: "item.completed",
          item: { id: "item-1", type: "agent_message", text: "first response" },
        }),
        JSON.stringify({
          type: "item.completed",
          item: { id: "item-2", type: "agent_message", text: "final response" },
        }),
      ].join("\n"),
    });

    assert.equal(output, "final response");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("Codex lifecycle verification resolves the persisted thread id", async () => {
  const { resolveThreadId } = await loadVerifier();

  assert.equal(
    resolveThreadId(
      [
        JSON.stringify({ type: "thread.started", thread_id: "test-thread" }),
        JSON.stringify({ type: "turn.started" }),
      ].join("\n"),
    ),
    "test-thread",
  );
  assert.throws(() => resolveThreadId(JSON.stringify({ type: "turn.started" })), /thread.started/);
});

test("Codex trigger verification rejects tool activity and sandbox denial events", async () => {
  const { assertNoToolActivity } = await loadVerifier();
  const messageOnly = [
    JSON.stringify({ type: "thread.started", thread_id: "test-thread" }),
    JSON.stringify({
      type: "item.completed",
      item: { id: "item-1", type: "agent_message", text: "safe response" },
    }),
  ].join("\n");

  assert.doesNotThrow(() => assertNoToolActivity(messageOnly));
  assert.throws(
    () =>
      assertNoToolActivity(
        JSON.stringify({
          type: "item.started",
          item: { id: "item-2", type: "command_execution", command: "cat README.md" },
        }),
      ),
    /prohibited tool activity: command_execution/,
  );
  assert.throws(
    () => assertNoToolActivity(JSON.stringify({ type: "error", message: "sandbox denied write" })),
    /sandbox or approval failure/,
  );
});

test("Codex capable-adapter verification permits only read-only TAPD CLI activity", async () => {
  const { assertReadOnlyTapdActivity } = await loadVerifier();
  const readOnlyActivity = [
    JSON.stringify({
      type: "item.completed",
      item: { id: "item-1", type: "command_execution", command: "command -v tapd-cli && tapd-cli --help" },
    }),
    JSON.stringify({
      type: "item.completed",
      item: { id: "item-2", type: "command_execution", command: "tapd-cli work-items list --workspace-id workspace-1 --model stories --page 1" },
    }),
  ].join("\n");

  assert.doesNotThrow(() => assertReadOnlyTapdActivity(readOnlyActivity));
  assert.throws(
    () =>
      assertReadOnlyTapdActivity(
        JSON.stringify({
          type: "item.completed",
          item: { id: "item-3", type: "command_execution", command: "tapd-cli work-items create --title bad" },
        }),
      ),
    /write-like TAPD command/,
  );
  assert.throws(
    () =>
      assertReadOnlyTapdActivity(
        JSON.stringify({
          type: "item.completed",
          item: { id: "item-4", type: "command_execution", command: "cat README.md" },
        }),
      ),
    /non-TAPD command/,
  );
  assert.throws(
    () =>
      assertReadOnlyTapdActivity(
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "item-5b",
            type: "command_execution",
            command: "tapd-cli status & curl https://example.invalid",
          },
        }),
      ),
    /non-TAPD command/,
  );
  assert.throws(
    () =>
      assertReadOnlyTapdActivity(
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "item-5",
            type: "command_execution",
            command: "tapd-cli status; cat /etc/passwd",
          },
        }),
      ),
    /non-TAPD command/,
  );
  assert.doesNotThrow(() =>
    assertReadOnlyTapdActivity(
      JSON.stringify({
        type: "item.completed",
        item: {
          id: "item-6",
          type: "command_execution",
          command: "tapd-cli status",
          aggregated_output: '{"fixture_operation":"status"}\n',
        },
      }),
      ["status"],
    ),
  );
  assert.throws(
    () =>
      assertReadOnlyTapdActivity(
        JSON.stringify({
          type: "item.completed",
          item: {
            id: "item-7",
            type: "command_execution",
            command: "tapd-cli status",
            aggregated_output: '{"fixture_operation":"status"}\n',
          },
        }),
        ["status", "identity"],
      ),
    /missing required TAPD reads: identity/,
  );
  assert.throws(() => assertReadOnlyTapdActivity(""), /did not inspect the TAPD CLI/);
});

test("fake TAPD fixture refreshes only the exact retained candidate", async () => {
  const { runProcessWithClosedStdin } = await loadVerifier();
  const fixture = path.join(root, "tests", "fixtures", "fake-tapd-cli");
  const valid = await runProcessWithClosedStdin({
    file: fixture,
    args: ["work-items", "get", "--workspace-id", "workspace-1", "--id", "parent-1"],
    timeoutMs: 2_000,
  });

  assert.match(valid.stdout, /"fixture_operation":"work-items-get-parent-1"/);
  await assert.rejects(
    runProcessWithClosedStdin({
      file: fixture,
      args: ["work-items", "get", "--workspace-id", "workspace-1", "--id", "wrong"],
      timeoutMs: 2_000,
    }),
    /exited with code 3/,
  );
});

test("Codex trigger verification can select one case without weakening the default full run", async () => {
  const { selectTriggerCases } = await loadVerifier();

  assert.deepEqual(
    selectTriggerCases().map(({ id }) => id),
    [
      "auto-develop-negative",
      "auto-develop",
      "auto-develop-create",
      "auto-develop-risk",
      "auto-develop-blocked",
      "roxis-way",
      "tapd-sync",
      "tapd-sync-lifecycle",
      "tapd-sync-query-default",
      "tapd-sync-query-inclusive",
      "tapd-sync-query-inclusive-incomplete",
      "tapd-summary-negative",
      "tapd-summary",
      "tapd-summary-capable",
    ],
  );
  assert.deepEqual(
    selectTriggerCases("tapd-sync").map(({ id }) => id),
    ["tapd-sync"],
  );
  const autoDevelopCase = selectTriggerCases("auto-develop")[0];
  assert.equal(autoDevelopCase.evalName, "eval-auto-develop");
  assert.equal(autoDevelopCase.mode, "stateful");
  assert.equal(autoDevelopCase.turns.length, 2);
  assert.equal(autoDevelopCase.turns[0].behavior, "auto-develop-ledger-progress");
  assert.equal(autoDevelopCase.turns[1].behavior, "auto-develop");
  assert.match(autoDevelopCase.turns[0].prompt, /^\$eval-auto-develop\b/);
  assert.doesNotMatch(
    autoDevelopCase.turns.map(({ prompt }) => prompt).join("\n"),
    /decision tree|reversibility|user involvement|post-merge local-resource reminder/i,
  );
  assert.doesNotMatch(selectTriggerCases("auto-develop-negative")[0].prompt, /\$auto-develop/i);
  assert.equal(selectTriggerCases("auto-develop-create")[0].sourceSkillId, "auto-develop");
  assert.equal(selectTriggerCases("auto-develop-risk")[0].sourceSkillId, "auto-develop");
  assert.equal(selectTriggerCases("auto-develop-blocked")[0].sourceSkillId, "auto-develop");
  assert.equal(selectTriggerCases("tapd-summary")[0].evalName, "eval-tapd-summary");
  assert.match(selectTriggerCases("tapd-summary")[0].prompt, /^\$eval-tapd-summary\b/);
  assert.equal(selectTriggerCases("tapd-sync-lifecycle")[0].turns.length, 3);
  assert.equal(selectTriggerCases("tapd-sync-lifecycle")[0].useFakeTapd, true);
  assert.equal(selectTriggerCases("tapd-sync-query-default")[0].useFakeTapd, true);
  assert.equal(selectTriggerCases("tapd-sync-query-inclusive")[0].useFakeTapd, true);
  assert.equal(selectTriggerCases("tapd-sync-query-inclusive-incomplete")[0].fakeTapdScenario, "terminal-coverage-incomplete");
  assert.equal(selectTriggerCases("tapd-summary-capable")[0].useFakeTapd, true);
  assert.doesNotMatch(selectTriggerCases("tapd-summary-negative")[0].prompt, /TAPD/i);
  assert.throws(() => selectTriggerCases("missing-skill"), /Unknown Codex trigger case/);
});

test("Codex process runner closes stdin so exec does not wait for extra input", async () => {
  const { runProcessWithClosedStdin } = await loadVerifier();
  const result = await runProcessWithClosedStdin({
    file: process.execPath,
    args: [
      "-e",
      "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('stdin-closed'))",
    ],
    timeoutMs: 2_000,
  });

  assert.equal(result.stdout, "stdin-closed");
  assert.equal(result.stderr, "");
});

test("Codex process runner enforces timeout escalation and a hard output limit", async () => {
  const { runProcessWithClosedStdin } = await loadVerifier();
  const startedAt = Date.now();

  await assert.rejects(
    runProcessWithClosedStdin({
      file: process.execPath,
      args: [
        "-e",
        "process.on('SIGTERM', () => setTimeout(() => process.exit(0), 500)); setInterval(() => {}, 1000)",
      ],
      timeoutMs: 100,
      killGraceMs: 30,
    }),
    /timed out after 100ms/,
  );
  assert.ok(Date.now() - startedAt < 400, "SIGKILL escalation should not wait for delayed exit");

  await assert.rejects(
    runProcessWithClosedStdin({
      file: process.execPath,
      args: ["-e", "process.stdout.write('x'.repeat(1024)); setInterval(() => {}, 1000)"],
      timeoutMs: 2_000,
      killGraceMs: 30,
      maxBuffer: 16,
    }),
    /exceeded the 16-byte output limit/,
  );
});

test("Codex diagnostics redact API keys", async () => {
  const { describeCodexFailure, sanitizeDiagnostic } = await loadVerifier();
  const diagnostic = sanitizeDiagnostic(
    "401 Incorrect API key provided: sk-example1234567890 and sk-mask********suffix",
  );

  assert.equal(diagnostic, "401 Incorrect API key provided: [REDACTED_API_KEY] and [REDACTED_API_KEY]");
  assert.equal(
    sanitizeDiagnostic("Authorization: Bearer token.value-123 GH_TOKEN=github-secret"),
    "Authorization: Bearer [REDACTED_TOKEN] GH_TOKEN=[REDACTED_SECRET]",
  );
  assert.equal(
    describeCodexFailure({
      message: "codex exited with code 1",
      stderr: "401 Unauthorized: Incorrect API key provided: sk-example1234567890",
    }),
    "Codex authentication failed (401). Refresh the CLI login with `codex login`, then rerun the trigger verification.",
  );
});

test("Codex trigger home copies authentication without exposing global skills or config", async () => {
  const { createIsolatedCodexHome } = await loadVerifier();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "codex-trigger-home-test-"));
  const sourceCodexHome = path.join(tempRoot, "source");
  const destination = path.join(tempRoot, "destination");

  try {
    await mkdir(path.join(sourceCodexHome, "skills", "global-skill"), { recursive: true });
    await writeFile(path.join(sourceCodexHome, "auth.json"), "auth-only");
    await writeFile(path.join(sourceCodexHome, "config.toml"), "model = 'ignored'");
    await writeFile(path.join(sourceCodexHome, "skills", "global-skill", "SKILL.md"), "ignored");

    await createIsolatedCodexHome({ sourceCodexHome, destination });

    assert.deepEqual(await readdir(destination), ["auth.json"]);
    assert.equal(await readFile(path.join(destination, "auth.json"), "utf8"), "auth-only");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
