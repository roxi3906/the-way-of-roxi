import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT_KEYS = ["schemaVersion", "session", "task", "decisions"];
const SESSION_KEYS = ["id", "name", "language"];
const TASK_KEYS = ["summary", "ledgerPath"];
const DECISION_KEYS = [
  "id",
  "type",
  "title",
  "createdAt",
  "parentId",
  "trigger",
  "evidence",
  "options",
  "recommendation",
  "selection",
  "reason",
  "risk",
  "reversibility",
  "userInvolvement",
  "outcome",
];
const SCALAR_DECISION_KEYS = [
  "id",
  "type",
  "title",
  "createdAt",
  "parentId",
  "trigger",
  "recommendation",
  "selection",
  "reason",
  "reversibility",
  "userInvolvement",
];
const OPTION_KEYS = ["id", "label", "description", "recommended"];
const IMMUTABLE_DECISION_KEYS = new Set(["id", "type", "createdAt"]);
const RFC3339_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/;
const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

const hasExactKeys = (value, keys) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === "string");

const isNonBlankString = (value) => typeof value === "string" && value.trim().length > 0;

const isTimestamp = (value) =>
  value === "" || (RFC3339_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value)));

export const assertDecisionLedgerJson = (document) => {
  const ledger = typeof document === "string" ? JSON.parse(document) : document;
  if (!hasExactKeys(ledger, ROOT_KEYS)) {
    throw new Error("auto-develop decision ledger does not use the fixed root keys");
  }
  if (
    ledger.schemaVersion !== 1 ||
    !hasExactKeys(ledger.session, SESSION_KEYS) ||
    !hasExactKeys(ledger.task, TASK_KEYS) ||
    !Object.values(ledger.session).every((value) => typeof value === "string") ||
    !Object.values(ledger.task).every((value) => typeof value === "string") ||
    !Array.isArray(ledger.decisions)
  ) {
    throw new Error("auto-develop decision ledger does not use typed root defaults");
  }

  const decisionIds = new Set();
  for (const decision of ledger.decisions) {
    if (
      !hasExactKeys(decision, DECISION_KEYS) ||
      !hasExactKeys(decision.risk, ["level", "description"]) ||
      !hasExactKeys(decision.outcome, ["status", "evidence", "updatedAt"]) ||
      (Array.isArray(decision.options) &&
        !decision.options.every((option) => hasExactKeys(option, OPTION_KEYS)))
    ) {
      throw new Error("auto-develop decision ledger does not use the fixed decision keys");
    }
    if (
      !SCALAR_DECISION_KEYS.every((key) => typeof decision[key] === "string") ||
      !isStringArray(decision.evidence) ||
      !Array.isArray(decision.options) ||
      !decision.options.every(
        (option) =>
          [option.id, option.label, option.description].every((value) => typeof value === "string") &&
          typeof option.recommended === "boolean",
      ) ||
      !Object.values(decision.risk).every((value) => typeof value === "string") ||
      typeof decision.outcome.status !== "string" ||
      !isStringArray(decision.outcome.evidence) ||
      typeof decision.outcome.updatedAt !== "string"
    ) {
      throw new Error("auto-develop decision ledger does not use typed decision defaults");
    }
    if (
      !isNonBlankString(decision.id) ||
      !isNonBlankString(decision.type) ||
      !isNonBlankString(decision.title) ||
      !RFC3339_TIMESTAMP.test(decision.createdAt) ||
      Number.isNaN(Date.parse(decision.createdAt)) ||
      !isTimestamp(decision.outcome.updatedAt)
    ) {
      throw new Error("auto-develop decision ledger contains an invalid decision identity");
    }
    if (decisionIds.has(decision.id)) {
      throw new Error("auto-develop decision ledger contains a duplicate decision id");
    }
    decisionIds.add(decision.id);

    const optionIds = new Set();
    for (const option of decision.options) {
      if (
        !isNonBlankString(option.id) ||
        !isNonBlankString(option.label) ||
        !isNonBlankString(option.description) ||
        optionIds.has(option.id)
      ) {
        throw new Error("auto-develop decision ledger contains invalid option identities");
      }
      optionIds.add(option.id);
    }
    const recommendedOptions = decision.options.filter(({ recommended }) => recommended);
    if (decision.options.length === 0) {
      if (decision.recommendation !== "" || decision.selection !== "") {
        throw new Error("auto-develop decision ledger contains invalid option references");
      }
    } else if (recommendedOptions.length !== 1) {
      throw new Error("auto-develop decision ledger must contain exactly one recommended option");
    } else if (
      decision.recommendation !== recommendedOptions[0].id ||
      (decision.selection !== "" && !optionIds.has(decision.selection))
    ) {
      throw new Error("auto-develop decision ledger contains invalid option references");
    }
  }

  return ledger;
};

const writeLedgerAtomically = async (ledgerPath, ledger) => {
  assertDecisionLedgerJson(ledger);
  const directory = path.dirname(ledgerPath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${path.basename(ledgerPath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, ledgerPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return readDecisionLedger(ledgerPath);
};

const withLedgerLock = async (ledgerPath, operation) => {
  const lockPath = `${ledgerPath}.lock`;
  const owner = `${process.pid}:${randomUUID()}`;
  const startedAt = Date.now();
  await mkdir(path.dirname(ledgerPath), { recursive: true });

  while (true) {
    try {
      await writeFile(lockPath, owner, { encoding: "utf8", flag: "wx" });
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      try {
        const lockStat = await stat(lockPath);
        if (Date.now() - lockStat.mtimeMs > STALE_LOCK_MS) {
          await unlink(lockPath);
          continue;
        }
      } catch (lockError) {
        if (lockError?.code === "ENOENT") continue;
        throw lockError;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error(`auto-develop decision ledger lock timed out for ${ledgerPath}`);
      }
      await delay(LOCK_RETRY_MS);
    }
  }

  try {
    return await operation();
  } finally {
    const currentOwner = await readFile(lockPath, "utf8").catch(() => "");
    if (currentOwner === owner) await unlink(lockPath).catch(() => {});
  }
};

export const readDecisionLedger = async (ledgerPath) => {
  const contents = await readFile(ledgerPath, "utf8");
  const ledger = assertDecisionLedgerJson(contents);
  if (path.resolve(ledger.task.ledgerPath) !== path.resolve(ledgerPath)) {
    throw new Error("auto-develop decision ledger path identity does not match the opened file");
  }
  return ledger;
};

export const createDecisionLedger = async ({ ledgerPath, session, taskSummary }) => {
  if (!path.isAbsolute(ledgerPath) || !/-decision-tree\.json$/i.test(ledgerPath)) {
    throw new Error("auto-develop decision ledger path must be an absolute *-decision-tree.json path");
  }
  return withLedgerLock(ledgerPath, () =>
    writeLedgerAtomically(ledgerPath, {
      schemaVersion: 1,
      session: {
        id: session?.id ?? "",
        name: session?.name ?? "",
        language: session?.language ?? "",
      },
      task: {
        summary: taskSummary ?? "",
        ledgerPath,
      },
      decisions: [],
    }),
  );
};

export const appendDecisionToLedger = async (ledgerPath, decision) =>
  withLedgerLock(ledgerPath, async () => {
    const ledger = await readDecisionLedger(ledgerPath);
    if (ledger.decisions.some(({ id }) => id === decision.id)) {
      throw new Error(`auto-develop decision ledger already contains decision ${decision.id}`);
    }
    ledger.decisions.push(decision);
    return writeLedgerAtomically(ledgerPath, ledger);
  });

export const updateDecisionInLedger = async (ledgerPath, decisionId, patch) =>
  withLedgerLock(ledgerPath, async () => {
    const ledger = await readDecisionLedger(ledgerPath);
    const matches = ledger.decisions
      .map((decision, index) => ({ decision, index }))
      .filter(({ decision }) => decision.id === decisionId);
    if (matches.length !== 1) {
      throw new Error(`auto-develop decision ledger must match exactly one decision for id ${decisionId}`);
    }
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      throw new Error("auto-develop decision update must be an object");
    }
    for (const key of Object.keys(patch)) {
      if (!DECISION_KEYS.includes(key)) {
        throw new Error(`auto-develop decision update contains unknown key ${key}`);
      }
      if (IMMUTABLE_DECISION_KEYS.has(key) && patch[key] !== matches[0].decision[key]) {
        throw new Error(`auto-develop decision field ${key} is immutable`);
      }
    }
    for (const key of ["risk", "outcome"]) {
      if (key in patch && (!patch[key] || typeof patch[key] !== "object" || Array.isArray(patch[key]))) {
        throw new Error(`auto-develop decision update field ${key} must be an object`);
      }
    }

    const current = matches[0].decision;
    const updated = {
      ...current,
      ...patch,
      risk: patch.risk ? { ...current.risk, ...patch.risk } : current.risk,
      outcome: patch.outcome ? { ...current.outcome, ...patch.outcome } : current.outcome,
    };
    ledger.decisions[matches[0].index] = updated;
    return writeLedgerAtomically(ledgerPath, ledger);
  });

const parseCliOptions = (args) => {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith("--") || value === undefined || options.has(flag)) {
      throw new Error(`invalid decision-ledger CLI arguments near ${flag || "<end>"}`);
    }
    options.set(flag, value);
  }
  return options;
};

const requiredCliOption = (options, flag) => {
  const value = options.get(flag);
  if (!isNonBlankString(value)) throw new Error(`decision-ledger CLI requires ${flag}`);
  return value;
};

// Structured receipts let the authenticated smoke prove which bundled operation actually ran.
const runCli = async ([operation, ...args]) => {
  const options = parseCliOptions(args);
  const ledgerPath = requiredCliOption(options, "--ledger");
  let decisionId = "";
  let ledger;

  if (operation === "create") {
    ledger = await createDecisionLedger({
      ledgerPath,
      session: {
        id: options.get("--session-id") ?? "",
        name: options.get("--session-name") ?? "",
        language: options.get("--language") ?? "",
      },
      taskSummary: options.get("--task-summary") ?? "",
    });
  } else if (operation === "append") {
    const decision = JSON.parse(requiredCliOption(options, "--decision-json"));
    decisionId = decision.id;
    ledger = await appendDecisionToLedger(ledgerPath, decision);
  } else if (operation === "read") {
    ledger = await readDecisionLedger(ledgerPath);
  } else if (operation === "update") {
    decisionId = requiredCliOption(options, "--id");
    const update = JSON.parse(requiredCliOption(options, "--patch-json"));
    ledger = await updateDecisionInLedger(ledgerPath, decisionId, update);
  } else {
    throw new Error(`unknown decision-ledger CLI operation: ${operation || "<missing>"}`);
  }

  process.stdout.write(`${JSON.stringify({
    decision_ledger_operation: operation,
    ledger_path: ledgerPath,
    decision_id: decisionId,
    ledger,
  })}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
