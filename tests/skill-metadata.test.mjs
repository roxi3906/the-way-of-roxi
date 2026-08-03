import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, "skills");
const contractPath = path.join(root, "tests", "fixtures", "skill-trigger-cases.json");
const skillsCli = path.join(root, "node_modules", ".bin", "skills");

const parseFrontmatter = (contents, sourcePath) => {
  const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, `${sourcePath} must start with YAML frontmatter`);
  return YAML.parse(match[1]);
};

const discoverSkillNames = async () => {
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const names = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
    await readFile(skillPath, "utf8");
    names.push(entry.name);
  }

  return names.sort();
};

const readContracts = async () => JSON.parse(await readFile(contractPath, "utf8"));

test("every canonical skill has valid portable metadata and a complete trigger contract", async () => {
  const names = await discoverSkillNames();
  const contracts = await readContracts();

  assert.deepEqual(Object.keys(contracts.skills).sort(), names);

  for (const name of names) {
    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    const openaiPath = path.join(skillsRoot, name, "agents", "openai.yaml");
    const metadata = parseFrontmatter(await readFile(skillPath, "utf8"), skillPath);
    const openai = YAML.parse(await readFile(openaiPath, "utf8"));
    const contract = contracts.skills[name];

    assert.deepEqual(Object.keys(metadata).sort(), ["description", "name"]);
    assert.equal(metadata.name, name);
    assert.match(metadata.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(metadata.description.length > 0 && metadata.description.length <= 1024);

    for (const key of ["positivePrompts", "paraphrasePrompts", "negativePrompts"]) {
      assert.ok(Array.isArray(contract[key]) && contract[key].length >= 2, `${name} needs ${key}`);
      assert.ok(contract[key].every((prompt) => typeof prompt === "string" && prompt.trim()));
    }

    assert.deepEqual(Object.keys(contract.explicitInvocations).sort(), [...contracts.targetAgents].sort());
    assert.ok(contract.mayCoactivateWith.every((otherName) => names.includes(otherName)));

    const frontloaded = metadata.description.slice(0, contract.frontloadCharacters).toLowerCase();
    for (const signals of contract.frontloadedSignalGroups) {
      assert.ok(
        signals.some((signal) => frontloaded.includes(signal.toLowerCase())),
        `${name} must front-load one of: ${signals.join(", ")}`,
      );
    }

    const description = metadata.description.toLowerCase();
    for (const signals of contract.negativeDescriptionSignalGroups) {
      assert.ok(
        signals.some((signal) => description.includes(signal.toLowerCase())),
        `${name} must preserve a negative boundary for: ${signals.join(", ")}`,
      );
    }

    const implicit = contract.invocationPolicy === "implicit";
    assert.equal(openai.policy?.allow_implicit_invocation ?? true, implicit);
    assert.ok(openai.interface.default_prompt.includes(`$${name}`));
    assert.ok(openai.interface.short_description.length >= 25);
    assert.ok(openai.interface.short_description.length <= 64);
  }
});

test("every canonical skill keeps invocation portable across host agents", async () => {
  const names = await discoverSkillNames();
  const contracts = await readContracts();
  const missingSignals = [];

  for (const name of names) {
    const skillPath = path.join(skillsRoot, name, "SKILL.md");
    const contents = (await readFile(skillPath, "utf8")).toLowerCase();

    for (const signals of contracts.portableRuntimeSignalGroups) {
      if (!signals.some((signal) => contents.includes(signal.toLowerCase()))) {
        missingSignals.push(`${name}: ${signals.join(" | ")}`);
      }
    }
  }

  assert.deepEqual(missingSignals, []);
});

test("the locked skills CLI discovers every canonical skill", async () => {
  const names = await discoverSkillNames();
  const { stdout } = await execFileAsync(skillsCli, ["add", root, "--list"], {
    cwd: root,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const output = stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");

  assert.match(output, new RegExp(`Found ${names.length} skills?`));
  for (const name of names) assert.match(output, new RegExp(`\\b${name}\\b`));
});
