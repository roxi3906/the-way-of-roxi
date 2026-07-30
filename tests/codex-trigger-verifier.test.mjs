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

test("Codex trigger runs are ephemeral, isolated, and read-only", async () => {
  const { buildCodexArgs } = await loadVerifier();
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
});

test("Codex trigger evidence distinguishes repository workflow, TAPD sync, and explicit summary behavior", async () => {
  const { assertTriggerBehavior } = await loadVerifier();

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
      "SKILL_ACTIVATED: eval-tapd-sync\nTAPD is not configured on this device, so sync is disabled.\nREADME improvement: document the six-agent installation command.",
      "eval-tapd-sync",
    ),
  );
  assert.throws(() =>
    assertTriggerBehavior(
      "tapd-sync",
      "TAPD is not configured on this device, so sync is disabled.",
      "eval-tapd-sync",
    ),
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

test("Codex trigger verification can select one case without weakening the default full run", async () => {
  const { selectTriggerCases } = await loadVerifier();

  assert.deepEqual(
    selectTriggerCases().map(({ id }) => id),
    ["roxis-way", "tapd-sync", "tapd-summary"],
  );
  assert.deepEqual(
    selectTriggerCases("tapd-sync").map(({ id }) => id),
    ["tapd-sync"],
  );
  assert.equal(selectTriggerCases("tapd-summary")[0].evalName, "eval-tapd-summary");
  assert.match(selectTriggerCases("tapd-summary")[0].prompt, /^\$eval-tapd-summary\b/);
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
