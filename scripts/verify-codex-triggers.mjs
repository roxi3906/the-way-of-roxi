import { constants } from "node:fs";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { runProcessWithClosedStdin } from "./lib/run-process.mjs";

export { runProcessWithClosedStdin } from "./lib/run-process.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");

const triggerCases = [
  {
    id: "roxis-way",
    evalName: "eval-roxis-way",
    prompt: "Without running tools or editing files, start a small README clarification task and present the repository workflow choices required before planning.",
  },
  {
    id: "tapd-sync",
    evalName: "eval-tapd-sync",
    prompt: "Without running tools, network requests, or file reads, handle a substantive README review in an isolated environment with no TAPD adapter. Continue the task by reporting one concrete improvement to the six-agent installation documentation.",
  },
  {
    id: "tapd-summary",
    evalName: "eval-tapd-summary",
    prompt: "$eval-tapd-summary Without running tools or network requests, summarize today's TAPD work and tomorrow's plan in an isolated environment with no TAPD adapter.",
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

export const buildCodexArgs = ({ workdir, outputPath, prompt, toolHome, toolPath }) => [
  "exec",
  "--ephemeral",
  "--ignore-user-config",
  "--ignore-rules",
  "--config",
  'shell_environment_policy.inherit="none"',
  "--config",
  `shell_environment_policy.set={PATH=${JSON.stringify(toolPath)},HOME=${JSON.stringify(toolHome)},CI="1",NO_COLOR="1"}`,
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
    if (
      !output.includes("TAPD is not configured on this device, so sync is disabled.") ||
      !/README/i.test(output) ||
      !/(install|installation|agent|安装|兼容|改进|维护)/i.test(output)
    ) {
      throw new Error("tapd-sync did not report unavailability and continue the README review");
    }
    return;
  }

  if (caseId === "tapd-summary") {
    if (!/TAPD/i.test(output) || !/(unavailable|not configured|不可用|无法)/i.test(output)) {
      throw new Error("tapd-summary did not report unavailable read-only summary data");
    }
    return;
  }

  throw new Error(`Unknown Codex trigger case: ${caseId}`);
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

export const assertNoToolActivity = (stdout) => {
  const prohibitedItemTypes = new Set([
    "command_execution",
    "file_change",
    "mcp_tool_call",
    "web_search",
    "computer_use",
    "image_generation",
  ]);

  for (const line of String(stdout || "").split(/\r?\n/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (prohibitedItemTypes.has(event?.item?.type)) {
      throw new Error(`Codex used prohibited tool activity: ${event.item.type}`);
    }
    if (event?.type === "error" && /(sandbox|approval).*(denied|reject|fail)|(?:denied|reject|fail).*(sandbox|approval)/i.test(event.message || "")) {
      throw new Error("Codex encountered a sandbox or approval failure");
    }
  }
};

const runTriggerCase = async (triggerCase) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-codex-trigger-"));
  const authRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-codex-auth-"));
  const isolatedHome = path.join(tempRoot, "home");
  const isolatedCodexHome = path.join(authRoot, "codex-home");
  const outputPath = path.join(tempRoot, "final.txt");
  const sourceCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");

  try {
    await mkdir(isolatedHome, { recursive: true });
    await createIsolatedCodexHome({ sourceCodexHome, destination: isolatedCodexHome });
    await writeFile(
      path.join(tempRoot, "README.md"),
      "# Trigger Evaluation Repository\n\nThis repository contains a small documentation example.\n",
    );
    await createEvalSkill({
      sourceSkill: path.join(root, "skills", triggerCase.id),
      skillsRoot: path.join(tempRoot, ".agents", "skills"),
      evalName: triggerCase.evalName,
    });

    const codexBin = await resolveExecutable(process.env.CODEX_BIN || "codex");
    const runtimePath = [path.dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(
      path.delimiter,
    );
    const environment = sanitizeEnvironment(process.env, {
      home: isolatedHome,
      codexHome: isolatedCodexHome,
      runtimePath,
    });

    let result;
    try {
      result = await runProcessWithClosedStdin({
        file: codexBin,
        args: buildCodexArgs({
          workdir: tempRoot,
          outputPath,
          prompt: triggerCase.prompt,
          toolHome: isolatedHome,
          toolPath: "/usr/bin:/bin:/usr/sbin:/sbin",
        }),
        cwd: tempRoot,
        env: environment,
        maxBuffer: 64 * 1024 * 1024,
        timeoutMs: 300_000,
      });
    } catch (error) {
      throw new Error(`${triggerCase.id} Codex run failed:\n${describeCodexFailure(error)}`);
    }

    let output;
    try {
      assertNoToolActivity(result.stdout);
      output = await resolveCodexOutput({ outputPath, stdout: result.stdout });
    } catch (error) {
      throw new Error(
        `${triggerCase.id} Codex output could not be resolved:\n${formatProcessFailure({
          message: error instanceof Error ? error.message : String(error),
          stdout: result.stdout,
          stderr: result.stderr,
        })}`,
      );
    }
    assertTriggerBehavior(triggerCase.id, output, triggerCase.evalName);
    return { skill: triggerCase.id, mode: triggerCase.id === "tapd-summary" ? "explicit" : "implicit" };
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
