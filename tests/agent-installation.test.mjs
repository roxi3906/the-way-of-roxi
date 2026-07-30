import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifier = path.join(root, "scripts", "verify-agent-installations.mjs");
const contracts = JSON.parse(
  readFileSync(path.join(root, "tests", "fixtures", "skill-trigger-cases.json"), "utf8"),
);
const expectedAgents = [...contracts.targetAgents].sort();
const expectedSkills = readdirSync(path.join(root, "skills"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

test("the repository installs every canonical skill into all six target agent catalogs", () => {
  const result = spawnSync(process.execPath, [verifier, "--json"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const reports = JSON.parse(result.stdout);
  assert.deepEqual(
    reports.map((report) => report.agent).sort(),
    expectedAgents,
  );

  for (const report of reports) {
    assert.deepEqual(report.skills, expectedSkills);
    assert.equal(report.canonicalRoot, report.agent === "claude-code" ? null : ".agents/skills");
    assert.equal(report.nativeRoot, report.agent === "claude-code" ? ".claude/skills" : null);
  }
});
