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

test("Codex trigger evidence distinguishes repository workflow, TAPD sync, and explicit summary behavior", async () => {
  const { assertSummaryNotTriggered, assertTriggerBehavior } = await loadVerifier();

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
