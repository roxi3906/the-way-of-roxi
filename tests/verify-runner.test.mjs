import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierUrl = pathToFileURL(path.join(root, "scripts", "verify.mjs")).href;

test("full verification runs local coverage before the authenticated Codex smoke", async () => {
  let verifier;
  try {
    verifier = await import(verifierUrl);
  } catch (error) {
    assert.fail(`Full verifier must be importable: ${error.message}`);
  }

  assert.deepEqual(verifier.verificationSteps, [
    { label: "metadata, installation, and unit tests", command: "npm", args: ["test"] },
    { label: "authenticated Codex trigger smoke", command: "npm", args: ["run", "verify:codex"] },
  ]);
});
