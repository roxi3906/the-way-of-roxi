import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProcessWithClosedStdin } from "./lib/run-process.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), "..");
const skillsRoot = path.join(root, "skills");
const contractPath = path.join(root, "tests", "fixtures", "skill-trigger-cases.json");
const skillsCli = path.join(root, "node_modules", ".bin", "skills");

const discoverSkillNames = async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const listFiles = async (directory, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
};

const verifyInstalledSkill = async (agent, skillName, installedRoot) => {
  const source = path.join(skillsRoot, skillName);
  const installed = path.join(installedRoot, skillName);
  const sourceFiles = await listFiles(source);
  const installedFiles = await listFiles(installed);

  if (JSON.stringify(installedFiles) !== JSON.stringify(sourceFiles)) {
    throw new Error(`${agent}/${skillName} installed files differ from the canonical skill`);
  }

  for (const relativePath of sourceFiles) {
    const [sourceContents, installedContents] = await Promise.all([
      readFile(path.join(source, relativePath)),
      readFile(path.join(installed, relativePath)),
    ]);
    if (!sourceContents.equals(installedContents)) {
      throw new Error(`${agent}/${skillName}/${relativePath} differs from the canonical file`);
    }
  }
};

const verifyAgent = async (agent, installRoot, skillNames, signal) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-agent-install-"));

  try {
    await runProcessWithClosedStdin({
      file: skillsCli,
      args: ["add", root, "--skill", "*", "--agent", agent, "-y"],
      cwd: tempRoot,
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
      signal,
      timeoutMs: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });

    // 每个 Agent 独立安装，验证 CLI 实际使用的原生项目目录。
    const installedRoot = path.join(tempRoot, installRoot);
    for (const skillName of skillNames) {
      await verifyInstalledSkill(agent, skillName, installedRoot);
    }

    return {
      agent,
      skills: skillNames,
      installRoot,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

export const verifyAgentInstallations = async () => {
  const skillNames = await discoverSkillNames();
  const { agentInstallRoots, targetAgents } = JSON.parse(await readFile(contractPath, "utf8"));
  const controller = new AbortController();
  try {
    return await Promise.all(
      targetAgents.map((agent) =>
        verifyAgent(agent, agentInstallRoots[agent], skillNames, controller.signal),
      ),
    );
  } catch (error) {
    controller.abort();
    throw error;
  }
};

export const verifyCombinedAgentInstallation = async () => {
  const skillNames = await discoverSkillNames();
  const { agentInstallRoots, targetAgents } = JSON.parse(await readFile(contractPath, "utf8"));
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "the-way-of-roxi-agent-install-"));

  try {
    await runProcessWithClosedStdin({
      file: skillsCli,
      args: ["add", root, "--skill", "*", "--agent", ...targetAgents, "--copy", "-y"],
      cwd: tempRoot,
      env: { ...process.env, CI: "1", NO_COLOR: "1" },
      timeoutMs: 120_000,
      maxBuffer: 16 * 1024 * 1024,
    });

    // `--copy` 保留多目标安装的原生目录；共享目录只需验证一次。
    const installRoots = [...new Set(targetAgents.map((agent) => agentInstallRoots[agent]))];
    for (const installRoot of installRoots) {
      for (const skillName of skillNames) {
        await verifyInstalledSkill("combined", skillName, path.join(tempRoot, installRoot));
      }
    }

    return { agents: targetAgents, installRoots, skills: skillNames };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (isMain) {
  try {
    const combined = process.argv.includes("--verify-combined");
    const reports = combined
      ? await verifyCombinedAgentInstallation()
      : await verifyAgentInstallations();
    if (process.argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify(reports)}\n`);
    } else if (combined) {
      process.stdout.write(
        `${reports.agents.length} agents: ${reports.skills.length} skills verified across ${reports.installRoots.length} catalogs\n`,
      );
    } else {
      for (const report of reports) {
        process.stdout.write(`${report.agent}: ${report.skills.length} skills verified\n`);
      }
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
