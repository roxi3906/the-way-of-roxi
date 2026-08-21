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

const expectedAgentProfiles = {
  amp: {
    installRoot: ".agents/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "runtime-gate",
  },
  codex: {
    installRoot: ".agents/skills",
    invocationTemplate: "$" + "{skill}",
    invocationForm: "dollar",
    manualOnlyControl: "openai-policy",
  },
  "claude-code": {
    installRoot: ".claude/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "disable-model-invocation",
  },
  cline: {
    installRoot: ".agents/skills",
    invocationTemplate: "Use the {skill} skill for this request.",
    invocationForm: "direct-instruction",
    manualOnlyControl: "runtime-gate",
  },
  cursor: {
    installRoot: ".agents/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "runtime-gate",
  },
  "gemini-cli": {
    installRoot: ".agents/skills",
    invocationTemplate: "Use the {skill} skill for this request.",
    invocationForm: "direct-instruction",
    manualOnlyControl: "runtime-gate",
  },
  "github-copilot": {
    installRoot: ".agents/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "runtime-gate",
  },
  goose: {
    installRoot: ".goose/skills",
    invocationTemplate: "/skills {skill}",
    invocationForm: "skills-command",
    manualOnlyControl: "runtime-gate",
  },
  "kimi-code-cli": {
    installRoot: ".agents/skills",
    invocationTemplate: "/skill:{skill}",
    invocationForm: "slash-colon",
    manualOnlyControl: "disable-model-invocation",
  },
  "kiro-cli": {
    installRoot: ".kiro/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "runtime-gate",
  },
  opencode: {
    installRoot: ".agents/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "opencode-autoinvoke",
  },
  "qwen-code": {
    installRoot: ".qwen/skills",
    invocationTemplate: "/{skill}",
    invocationForm: "slash",
    manualOnlyControl: "runtime-gate",
  },
  roo: {
    installRoot: ".roo/skills",
    invocationTemplate: "Use the {skill} skill for this request.",
    invocationForm: "direct-instruction",
    manualOnlyControl: "runtime-gate",
  },
  windsurf: {
    installRoot: ".windsurf/skills",
    invocationTemplate: "Use the {skill} skill for this request.",
    invocationForm: "direct-instruction",
    manualOnlyControl: "runtime-gate",
  },
};

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

    const expectedMetadataKeys = {
      "auto-develop": ["description", "disable-model-invocation", "metadata", "name"],
      "tapd-summary": ["description", "disable-model-invocation", "name"],
    }[name] ?? ["description", "name"];
    assert.deepEqual(Object.keys(metadata).sort(), expectedMetadataKeys);
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

    if (contract.invocationPolicy === "explicit-only") {
      assert.equal(metadata["disable-model-invocation"], true);
    }

    if (name === "auto-develop") {
      assert.equal(metadata.metadata?.["invocation/manual-only"], "true");
      assert.equal(metadata.metadata?.["opencode/autoinvoke"], "false");
    }
  }
});

test("every supported agent has one canonical invocation profile", async () => {
  const contracts = await readContracts();

  assert.deepEqual(contracts.agentProfiles, expectedAgentProfiles);
  assert.deepEqual(Object.keys(contracts.agentProfiles).sort(), [...contracts.targetAgents].sort());

  for (const [agent, profile] of Object.entries(contracts.agentProfiles)) {
    const expectedInvocation = profile.invocationTemplate.replace("{skill}", "auto-develop");
    assert.equal(contracts.skills["auto-develop"].explicitInvocations[agent], expectedInvocation);
  }
});

test("auto-develop covers every explicit invocation form without leaking one into negative prompts", async () => {
  const contracts = await readContracts();
  const contract = contracts.skills["auto-develop"];
  const explicitExamples = [...contract.positivePrompts, ...contract.paraphrasePrompts]
    .join("\n")
    .toLowerCase();
  const negativeExamples = contract.negativePrompts.join("\n").toLowerCase();
  const formSignals = {
    dollar: "$auto-develop",
    slash: "/auto-develop",
    "skills-command": "/skills auto-develop",
    "slash-colon": "/skill:auto-develop",
    "direct-instruction": "use the auto-develop skill",
  };

  for (const form of new Set(Object.values(expectedAgentProfiles).map(({ invocationForm }) => invocationForm))) {
    assert.ok(explicitExamples.includes(formSignals[form]), `auto-develop needs a ${form} example`);
    assert.ok(!negativeExamples.includes(formSignals[form]), `negative prompts must exclude ${form}`);
  }
  assert.match(explicitExamples, /selected auto-develop/);
});

test("auto-develop preserves the repository workflow's comment policy", async () => {
  const contents = await readFile(path.join(skillsRoot, "auto-develop", "SKILL.md"), "utf8");

  assert.match(contents, /Follow the repository's established implementation and comment rules\./);
  assert.doesNotMatch(contents, /Add comments only where the logic would otherwise be difficult to understand\./);
});

test("phase synchronization preserves event history and honest closeout states", async () => {
  const autoDevelop = await readFile(path.join(skillsRoot, "auto-develop", "SKILL.md"), "utf8");
  const tapdSync = await readFile(path.join(skillsRoot, "tapd-sync", "SKILL.md"), "utf8");
  const executionReport = await readFile(
    path.join(skillsRoot, "auto-develop", "references", "execution-report.md"),
    "utf8",
  );

  assert.match(autoDevelop, /stable event ID/i);
  assert.match(autoDevelop, /risk-gate pause[^\n]+delivery closeout[^\n]+blocked/i);
  assert.match(autoDevelop, /Complete closeout only after the blocker is resolved/i);
  assert.match(tapdSync, /stable event ID/i);
  assert.match(tapdSync, /retrievable audit history/i);
  assert.match(tapdSync, /exact event payload/i);
  assert.doesNotMatch(tapdSync, /outcome identity as the idempotency key/i);
  assert.match(executionReport, /Tracking phase event <stable event ID>: delivery=<stable delivery identity>/i);
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
