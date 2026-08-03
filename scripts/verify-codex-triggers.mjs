import { constants } from "node:fs";
import { access, chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { runProcessWithClosedStdin } from "./lib/run-process.mjs";

export { runProcessWithClosedStdin } from "./lib/run-process.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const tapdInitializationReads = [
  "help",
  "status",
  "identity",
  "workspaces",
  "work-item-types",
  "workflows",
  "work-items-list-stories",
  "work-items-list-bugs",
  "work-items-list-tasks",
];

const triggerCases = [
  {
    id: "roxis-way",
    evalName: "eval-roxis-way",
    prompt: "Without running tools or editing files, start a small README clarification task and present the repository workflow choices required before planning.",
  },
  {
    id: "tapd-sync",
    evalName: "eval-tapd-sync",
    prompt: "Without running tools, network requests, or file reads, handle a substantive README review in an isolated environment with no TAPD adapter. Continue the task by reporting one concrete improvement to the thirteen-agent installation documentation.",
  },
  {
    id: "tapd-sync-lifecycle",
    sourceSkillId: "tapd-sync",
    evalName: "eval-tapd-sync-lifecycle",
    useFakeTapd: true,
    turns: [
      {
        behavior: "tapd-sync-first-match",
        toolPolicy: "tapd-read-only",
        requiredTapdReads: tapdInitializationReads,
        prompt: "Without reading or editing files, review the README agent-installation documentation and report one concrete improvement. An authenticated read-only TAPD CLI named tapd-cli is available in PATH. This request does not ask to bind or create a parent work item.",
      },
      {
        behavior: "tapd-sync-dormant",
        toolPolicy: "none",
        prompt: "Without running tools or mentioning TAPD, add one more sentence about README clarity. This request does not ask to bind or create anything.",
      },
      {
        behavior: "tapd-sync-selected-candidate",
        toolPolicy: "tapd-read-only",
        requiredTapdReads: ["work-items-get-parent-1"],
        prompt: "1",
      },
    ],
  },
  {
    id: "tapd-summary-negative",
    sourceSkillId: "tapd-summary",
    evalName: "eval-tapd-summary-negative",
    prompt: "Without running tools, summarize today's local documentation tasks in one sentence.",
  },
  {
    id: "tapd-summary",
    evalName: "eval-tapd-summary",
    prompt: "$eval-tapd-summary Without running tools or network requests, summarize today's TAPD work and tomorrow's plan in an isolated environment with no TAPD adapter.",
  },
  {
    id: "tapd-summary-capable",
    sourceSkillId: "tapd-summary",
    evalName: "eval-tapd-summary-capable",
    useFakeTapd: true,
    toolPolicy: "tapd-read-only",
    requiredTapdReads: [
      ...tapdInitializationReads,
      "work-items-get-parent-1",
      "work-items-history-parent-1",
    ],
    prompt: "$eval-tapd-summary-capable Use the authenticated read-only tapd-cli available in PATH to summarize TAPD work from 2026-08-03 and the next-day plan. Do not read or edit repository files.",
  },
];

export const selectTriggerCases = (caseId) => {
  if (!caseId) return triggerCases;
  const selected = triggerCases.filter(({ id }) => id === caseId);
  if (selected.length === 0) throw new Error(`Unknown Codex trigger case: ${caseId}`);
  return selected;
};

const parseFrontmatter = (contents, sourcePath) => {
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error(`${sourcePath} must start with YAML frontmatter`);
  return { match, metadata: YAML.parse(match[1]) };
};

export const sanitizeEnvironment = (source, { home, codexHome, runtimePath }) => {
  const sanitized = {};
  const inheritedKeys = ["LANG", "LC_ALL", "LC_CTYPE", "TERM", "TMPDIR", "TZ", "USER", "LOGNAME", "SHELL"];

  for (const key of inheritedKeys) {
    if (source[key] !== undefined) sanitized[key] = source[key];
  }

  return {
    ...sanitized,
    HOME: home,
    CODEX_HOME: codexHome,
    PATH: runtimePath,
    CI: "1",
    NO_COLOR: "1",
  };
};

const resolveExecutable = async (command, searchPath = process.env.PATH || "") => {
  const candidates = path.isAbsolute(command)
    ? [command]
    : searchPath.split(path.delimiter).map((directory) => path.join(directory, command));

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next directory in PATH.
    }
  }

  throw new Error(`Executable not found: ${command}`);
};

export const createIsolatedCodexHome = async ({ sourceCodexHome, destination }) => {
  const sourceAuth = path.join(sourceCodexHome, "auth.json");
  try {
    await access(sourceAuth, constants.R_OK);
  } catch {
    throw new Error(`Codex authentication file not found at ${sourceAuth}`);
  }

  await mkdir(destination, { recursive: true });
  await cp(sourceAuth, path.join(destination, "auth.json"));
};

const shellEnvironmentArgs = ({ toolHome, toolPath }) => [
  "--config",
  'shell_environment_policy.inherit="none"',
  "--config",
  `shell_environment_policy.set={PATH=${JSON.stringify(toolPath)},HOME=${JSON.stringify(toolHome)},CI="1",NO_COLOR="1"}`,
];

export const buildCodexArgs = ({
  workdir,
  outputPath,
  prompt,
  toolHome,
  toolPath,
  ephemeral = true,
}) => [
  "exec",
  ...(ephemeral ? ["--ephemeral"] : []),
  "--ignore-user-config",
  "--ignore-rules",
  ...shellEnvironmentArgs({ toolHome, toolPath }),
  "--sandbox",
  "read-only",
  "--cd",
  workdir,
  "--skip-git-repo-check",
  "--color",
  "never",
  "--output-last-message",
  outputPath,
  "--json",
  prompt,
];

export const buildCodexResumeArgs = ({ threadId, outputPath, prompt, toolHome, toolPath }) => [
  "exec",
  "resume",
  "--ignore-user-config",
  "--ignore-rules",
  ...shellEnvironmentArgs({ toolHome, toolPath }),
  "--skip-git-repo-check",
  "--output-last-message",
  outputPath,
  "--json",
  threadId,
  prompt,
];

export const assertTriggerBehavior = (caseId, output, activationMarker = caseId) => {
  if (!output.includes(`SKILL_ACTIVATED: ${activationMarker}`)) {
    throw new Error(`${caseId} did not emit its activation marker`);
  }

  if (caseId === "roxis-way") {
    const chineseCharacters = output.match(/[\u3400-\u9fff]/g) || [];
    const numberedChoices = output.match(/^\s*[1-4][.、]\s+\S.+$/gm) || [];
    if (
      chineseCharacters.length < 30 ||
      numberedChoices.length < 8 ||
      !/工作区/.test(output) ||
      !/(验收|验证)/.test(output)
    ) {
      throw new Error("roxis-way did not return Chinese workspace and validation choice lists");
    }
    return;
  }

  if (caseId === "tapd-sync") {
    const unavailableMessage = "TAPD is not configured on this device, so sync is disabled.";
    if (
      !output.includes(unavailableMessage) ||
      !/README/i.test(output) ||
      !/(install|installation|agent|安装|兼容|改进|维护)/i.test(output)
    ) {
      throw new Error("tapd-sync did not report unavailability and continue the README review");
    }
    if (!output.trimEnd().endsWith(unavailableMessage)) {
      throw new Error("tapd-sync did not place the final TAPD status at the end");
    }
    return;
  }

  if (caseId === "tapd-sync-first-match") {
    const finalLine = output.trimEnd().split(/\r?\n/).at(-1) || "";
    if (
      !/README/i.test(output) ||
      !/^>?\s*TAPD:\s/.test(finalLine) ||
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(finalLine)
    ) {
      throw new Error("tapd-sync did not perform the first read-only match and link its candidate");
    }
    return;
  }

  if (caseId === "tapd-sync-dormant") {
    const activationLine = `SKILL_ACTIVATED: ${activationMarker}`;
    const substantiveOutput = output
      .split(/\r?\n/)
      .filter((line) => line.trim() !== activationLine)
      .join("\n");
    if (!/README/i.test(substantiveOutput)) {
      throw new Error("dormant TAPD sync did not continue the original request");
    }
    if (/TAPD|https?:\/\/[^\s)]*workitems/i.test(substantiveOutput)) {
      throw new Error("dormant TAPD sync emitted TAPD output");
    }
    return;
  }

  if (caseId === "tapd-sync-reactivated") {
    const unavailableMessage = "TAPD is not configured on this device, so sync is disabled.";
    if (!output.trimEnd().endsWith(unavailableMessage)) {
      throw new Error("explicit parent request did not reactivate TAPD sync");
    }
    return;
  }

  if (caseId === "tapd-sync-bound") {
    const finalLine = output.trimEnd().split(/\r?\n/).at(-1) || "";
    const linkedItems = finalLine.match(/\[[^\]]+\]\(https?:\/\/[^)]+\)/g) || [];
    if (
      !/^>?\s*TAPD:\s/.test(finalLine) ||
      linkedItems.length < 1
    ) {
      throw new Error("tapd-sync did not place linked TAPD work items at the end");
    }
    return;
  }

  if (caseId === "tapd-sync-selected-candidate") {
    const finalLine = output.trimEnd().split(/\r?\n/).at(-1) || "";
    if (
      !/^>?\s*TAPD:\s/.test(finalLine) ||
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(finalLine)
    ) {
      throw new Error("tapd-sync did not verify and link the selected candidate");
    }
    return;
  }

  if (caseId === "tapd-summary") {
    if (!/TAPD/i.test(output) || !/(unavailable|not configured|不可用|无法)/i.test(output)) {
      throw new Error("tapd-summary did not report unavailable read-only summary data");
    }
    return;
  }

  if (caseId === "tapd-summary-capable") {
    if (
      !/【Trigger Evaluation Repository】Improve README agent documentation/.test(output) ||
      /(unavailable|not configured|不可用|无法)/i.test(output)
    ) {
      throw new Error("tapd-summary did not use the capable read-only adapter data");
    }
    return;
  }

  throw new Error(`Unknown Codex trigger case: ${caseId}`);
};

export const assertSummaryNotTriggered = (output, activationMarker) => {
  if (output.includes(`SKILL_ACTIVATED: ${activationMarker}`) || /\bTAPD\b/i.test(output)) {
    throw new Error("ordinary task summary unexpectedly activated tapd-summary");
  }
};

export const createEvalSkill = async ({ sourceSkill, skillsRoot, evalName }) => {
  const destination = path.join(skillsRoot, evalName);
  await mkdir(skillsRoot, { recursive: true });
  await cp(sourceSkill, destination, { recursive: true });

  const skillPath = path.join(destination, "SKILL.md");
  const skillContents = await readFile(skillPath, "utf8");
  const { match, metadata } = parseFrontmatter(skillContents, skillPath);
  metadata.name = evalName;

  // 临时副本用独有标记证明实际激活，避免全局同名 skill 造成假阳性。
  const activationRule = [
    "",
    "## Activation Verification",
    "",
    `Include the exact line \`SKILL_ACTIVATED: ${evalName}\` in the final response.`,
    "Place this activation line before any final TAPD footer required by this skill.",
    "",
  ].join("\n");
  const body = skillContents.slice(match[0].length).replace(/^\r?\n?/, "");
  await writeFile(
    skillPath,
    `---\n${YAML.stringify(metadata).trimEnd()}\n---\n\n${body.trimEnd()}\n${activationRule}`,
  );

  const openaiPath = path.join(destination, "agents", "openai.yaml");
  const openai = YAML.parse(await readFile(openaiPath, "utf8"));
  openai.interface.default_prompt = openai.interface.default_prompt.replace(
    /\$[a-z0-9-]+/,
    `$${evalName}`,
  );
  await writeFile(openaiPath, YAML.stringify(openai));

  return destination;
};

export const sanitizeDiagnostic = (value) =>
  String(value)
    .replace(/\bsk-[A-Za-z0-9*_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]")
    .replace(
      /\b([A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|AUTH)[A-Z0-9_]*)\s*([:=])\s*([^\s,;"'}]+)/g,
      "$1$2[REDACTED_SECRET]",
    );

const formatProcessFailure = (error) => {
  const details = [error?.message || (error instanceof Error ? error.message : String(error))];
  if (error?.stdout) details.push(String(error.stdout).slice(-2000));
  if (error?.stderr) details.push(String(error.stderr).slice(-2000));
  return sanitizeDiagnostic(details.join("\n"));
};

export const describeCodexFailure = (error) => {
  const diagnostic = [error?.message, error?.stdout, error?.stderr].filter(Boolean).join("\n");
  if (/(?:401|Unauthorized|invalid_api_key|Incorrect API key)/i.test(diagnostic)) {
    return "Codex authentication failed (401). Refresh the CLI login with `codex login`, then rerun the trigger verification.";
  }
  return formatProcessFailure(error);
};

const readFinalMessage = async (outputPath) => {
  try {
    return await readFile(outputPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
};

export const resolveCodexOutput = async ({ outputPath, stdout }) => {
  const finalMessage = await readFinalMessage(outputPath);
  if (finalMessage?.trim()) return finalMessage;

  const agentMessages = String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const event = JSON.parse(line);
        return event?.type === "item.completed" && event?.item?.type === "agent_message"
          ? [event.item.text]
          : [];
      } catch {
        return [];
      }
    });

  if (agentMessages.length > 0) return agentMessages.at(-1);
  throw new Error("Codex produced neither a final-message file nor an agent-message JSON event");
};

const parseCodexEvents = (stdout) =>
  String(stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

export const resolveThreadId = (stdout) => {
  const started = parseCodexEvents(stdout).find(
    (event) => event?.type === "thread.started" && event?.thread_id,
  );
  if (!started) throw new Error("Codex output did not include a thread.started event");
  return started.thread_id;
};

const assertNoSandboxFailure = (event) => {
  if (
    event?.type === "error" &&
    /(sandbox|approval).*(denied|reject|fail)|(?:denied|reject|fail).*(sandbox|approval)/i.test(
      event.message || "",
    )
  ) {
    throw new Error("Codex encountered a sandbox or approval failure");
  }
};

export const assertNoToolActivity = (stdout) => {
  const prohibitedItemTypes = new Set([
    "command_execution",
    "file_change",
    "mcp_tool_call",
    "web_search",
    "computer_use",
    "image_generation",
  ]);

  for (const event of parseCodexEvents(stdout)) {
    if (prohibitedItemTypes.has(event?.item?.type)) {
      throw new Error(`Codex used prohibited tool activity: ${event.item.type}`);
    }
    assertNoSandboxFailure(event);
  }
};

const assertTapdOnlyCommand = (command) => {
  if (/`|\$\(|[<>]/.test(command)) {
    throw new Error(`Codex used a non-TAPD shell construct during adapter verification: ${command}`);
  }

  const segments = command.split(/\s*(?:&&|\|\||[;&|\n])\s*/).filter(Boolean);
  for (const rawSegment of segments) {
    const segment = rawSegment
      .trim()
      .replace(/^\/?bin\/(?:ba|z)?sh\s+-lc\s+['"]?/, "")
      .replace(/^['"]|['"]$/g, "")
      .trim();
    if (/^(?:command\s+-v|which|type(?:\s+-a)?)\s+tapd-cli$/.test(segment)) continue;

    const invocation = segment.match(
      /^(?:['"]?(?:[^\s'"]*\/)?tapd-cli['"]?)(?:\s+(.+))?$/,
    );
    if (!invocation) {
      throw new Error(`Codex used a non-TAPD command during adapter verification: ${segment}`);
    }

    const args = String(invocation[1] || "").replace(/['"]$/, "").trim();
    if (
      /^(?:--help|-h|help|status|identity|workspaces)(?:\s|$)/.test(args) ||
      /^(?:work-item-types|workflows)(?:\s|$)/.test(args) ||
      /^work-items\s+(?:list|get|history)(?:\s|$)/.test(args)
    ) {
      continue;
    }
    if (/\b(?:create|update|edit|delete|transition|complete|close|bind)\b/i.test(args)) {
      throw new Error(`Codex used a write-like TAPD command: ${segment}`);
    }
    throw new Error(`Codex used an unsupported TAPD command: ${segment}`);
  }
};

export const assertReadOnlyTapdActivity = (stdout, requiredOperations = []) => {
  const commands = [];
  const operations = new Set();
  const prohibitedItemTypes = new Set([
    "file_change",
    "mcp_tool_call",
    "web_search",
    "computer_use",
    "image_generation",
  ]);

  for (const event of parseCodexEvents(stdout)) {
    if (prohibitedItemTypes.has(event?.item?.type)) {
      throw new Error(`Codex used prohibited tool activity: ${event.item.type}`);
    }
    assertNoSandboxFailure(event);
    if (event?.item?.type !== "command_execution") continue;

    const command = Array.isArray(event.item.command)
      ? event.item.command.join(" ")
      : String(event.item.command || "");
    assertTapdOnlyCommand(command);
    commands.push(command);

    const commandOutput = [event.item.aggregated_output, event.item.output]
      .filter((value) => value !== undefined)
      .join("\n");
    for (const match of commandOutput.matchAll(/"fixture_operation"\s*:\s*"([^"]+)"/g)) {
      operations.add(match[1]);
    }
  }

  if (commands.length === 0) throw new Error("Codex did not inspect the TAPD CLI");
  const missingOperations = requiredOperations.filter((operation) => !operations.has(operation));
  if (missingOperations.length > 0) {
    throw new Error(`Codex is missing required TAPD reads: ${missingOperations.join(", ")}`);
  }
  return [...new Set(commands)];
};

const runTriggerCase = async (triggerCase) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-codex-trigger-"));
  const authRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-codex-auth-"));
  const isolatedHome = path.join(tempRoot, "home");
  const isolatedCodexHome = path.join(authRoot, "codex-home");
  const sourceCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");

  try {
    await mkdir(isolatedHome, { recursive: true });
    await createIsolatedCodexHome({ sourceCodexHome, destination: isolatedCodexHome });
    await writeFile(
      path.join(tempRoot, "README.md"),
      "# Trigger Evaluation Repository\n\nThis repository contains a small documentation example.\n",
    );
    await createEvalSkill({
      sourceSkill: path.join(root, "skills", triggerCase.sourceSkillId || triggerCase.id),
      skillsRoot: path.join(tempRoot, ".agents", "skills"),
      evalName: triggerCase.evalName,
    });

    const fakeBin = path.join(tempRoot, "fake-bin");
    if (triggerCase.useFakeTapd) {
      await mkdir(fakeBin, { recursive: true });
      const fakeTapdPath = path.join(fakeBin, "tapd-cli");
      await cp(path.join(root, "tests", "fixtures", "fake-tapd-cli"), fakeTapdPath);
      await chmod(fakeTapdPath, 0o755);
    }

    const codexBin = await resolveExecutable(process.env.CODEX_BIN || "codex");
    const toolPath = [
      ...(triggerCase.useFakeTapd ? [fakeBin] : []),
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
    ].join(path.delimiter);
    const runtimePath = [path.dirname(process.execPath), toolPath].join(path.delimiter);
    const environment = sanitizeEnvironment(process.env, {
      home: isolatedHome,
      codexHome: isolatedCodexHome,
      runtimePath,
    });

    const turns = triggerCase.turns || [
      {
        behavior: triggerCase.id,
        prompt: triggerCase.prompt,
        toolPolicy: triggerCase.toolPolicy || "none",
      },
    ];
    let threadId;

    for (const [turnIndex, turn] of turns.entries()) {
      const outputPath = path.join(tempRoot, `final-${turnIndex + 1}.txt`);
      const args =
        turnIndex === 0
          ? buildCodexArgs({
              workdir: tempRoot,
              outputPath,
              prompt: turn.prompt,
              toolHome: isolatedHome,
              toolPath,
              ephemeral: turns.length === 1,
            })
          : buildCodexResumeArgs({
              threadId,
              outputPath,
              prompt: turn.prompt,
              toolHome: isolatedHome,
              toolPath,
            });

      let result;
      try {
        result = await runProcessWithClosedStdin({
          file: codexBin,
          args,
          cwd: tempRoot,
          env: environment,
          maxBuffer: 64 * 1024 * 1024,
          timeoutMs: 300_000,
        });
      } catch (error) {
        throw new Error(
          `${triggerCase.id} turn ${turnIndex + 1} Codex run failed:\n${describeCodexFailure(error)}`,
        );
      }

      try {
        if (turn.toolPolicy === "tapd-read-only") {
          assertReadOnlyTapdActivity(
            result.stdout,
            turn.requiredTapdReads || triggerCase.requiredTapdReads || [],
          );
        } else {
          assertNoToolActivity(result.stdout);
        }
        const output = await resolveCodexOutput({ outputPath, stdout: result.stdout });
        if (triggerCase.id === "tapd-summary-negative") {
          assertSummaryNotTriggered(output, triggerCase.evalName);
        } else {
          assertTriggerBehavior(turn.behavior, output, triggerCase.evalName);
        }
        if (turnIndex === 0 && turns.length > 1) threadId = resolveThreadId(result.stdout);
      } catch (error) {
        throw new Error(
          `${triggerCase.id} turn ${turnIndex + 1} output could not be verified:\n${formatProcessFailure({
            message: error instanceof Error ? error.message : String(error),
            stdout: result.stdout,
            stderr: result.stderr,
          })}`,
        );
      }
    }

    let mode = "implicit";
    if (triggerCase.id === "tapd-sync-lifecycle") mode = "stateful";
    if (triggerCase.id === "tapd-summary-negative") mode = "negative";
    else if (triggerCase.id.startsWith("tapd-summary")) mode = "explicit";
    return { skill: triggerCase.id, mode };
  } finally {
    await Promise.all([
      rm(tempRoot, { recursive: true, force: true }),
      rm(authRoot, { recursive: true, force: true }),
    ]);
  }
};

export const verifyCodexTriggers = async ({ caseId } = {}) => {
  const reports = [];
  for (const triggerCase of selectTriggerCases(caseId)) {
    process.stderr.write(`Running Codex trigger case: ${triggerCase.id}\n`);
    reports.push(await runTriggerCase(triggerCase));
  }
  return reports;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (isMain) {
  try {
    const caseFlagIndex = process.argv.indexOf("--case");
    const caseId = caseFlagIndex === -1 ? undefined : process.argv[caseFlagIndex + 1];
    if (caseFlagIndex !== -1 && !caseId) throw new Error("--case requires a skill name");
    const reports = await verifyCodexTriggers({ caseId });
    if (process.argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(reports)}\n`);
    } else {
      for (const report of reports) {
        process.stdout.write(`${report.skill}: ${report.mode} trigger verified\n`);
      }
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
