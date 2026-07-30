import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);

export const verificationSteps = [
  { label: "metadata, installation, and unit tests", command: "npm", args: ["test"] },
  { label: "authenticated Codex trigger smoke", command: "npm", args: ["run", "verify:codex"] },
];

const runStep = ({ label, command, args }) =>
  new Promise((resolve, reject) => {
    process.stdout.write(`\n==> ${label}\n`);
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${label} failed with code ${code}${signal ? ` (signal ${signal})` : ""}`,
        ),
      );
    });
  });

export const runVerification = async () => {
  for (const step of verificationSteps) await runStep(step);
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (isMain) {
  try {
    await runVerification();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
