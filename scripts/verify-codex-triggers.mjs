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
    id: "auto-develop-negative",
    sourceSkillId: "auto-develop",
    evalName: "eval-auto-develop-negative",
    mode: "negative",
    negativeAssertion: "auto-develop",
    prompt: "Without running tools, describe one benefit of automatically implementing and reviewing a small repository change. Do not select or invoke any Skill.",
  },
  {
    id: "auto-develop",
    evalName: "eval-auto-develop",
    mode: "stateful",
    turns: [
      {
        behavior: "auto-develop-ledger-progress",
        toolPolicy: "none",
        prompt: "$eval-auto-develop Without running tools or changing files, simulate a small repository delivery through context discovery, source isolation, tracking, technical research, and solution design. Assume develop, dev/main, main, and master all exist; develop is selected at commit 0123456789abcdef0123456789abcdef01234567; the task branch is custom/repository-topic in /tmp/feature-worktree; and one configured tracking candidate is a unique 94% match whose binding read-back succeeds. Preparation is backfilled after binding. Technical research produces one standalone, independently acceptable outcome named delivery architecture decision, while solution design and every later delivery stage are routine internal work. Every attempted tracking write and child mutation succeeds and its read-back verifies. The task will continue in a later turn. Report the midpoint state and how its audit history survives that continuation, but do not finish the simulated delivery.",
      },
      {
        behavior: "auto-develop",
        toolPolicy: "none",
        prompt: "Continue the same simulation. Assume the implementation satisfies every mapped criterion; npm test passes 23/23; deep review finds one actionable recommended fix that is applied, revalidated, and re-reviewed cleanly; draft PR read-back verifies URL https://example.invalid/pull/42, state draft, base develop, and head custom/repository-topic; and every remaining phase start, completion, child, and parent-progress write succeeds with verified read-back. Complete the simulated autonomous delivery report according to the selected Skill, including aggregate phase synchronization and hybrid-child records. Do not ask for routine workspace or validation choices, and keep cleanup separate from this delivery.",
      },
      {
        behavior: "auto-develop-session-active",
        toolPolicy: "none",
        prompt: "Without running tools or changing files, consider a separate repository delivery requested later in this same conversation after the prior delivery is complete. State the continuing session mode, when it ends, whether any repeated activation is needed, how authorization remains limited to the repository task requested by this message, and whether the delivery uses a separate ledger and worktree instead of resources from the prior delivery.",
      },
      {
        behavior: "auto-develop-session-paused",
        toolPolicy: "none",
        prompt: "Assume the separate delivery from the prior message is now in progress and reaches a valid risk-gate pause because external approval is required. Without running tools or changing files, state the session mode at the pause, when that mode ends, and which delivery ledger and worktree are preserved for a later continuation.",
      },
      {
        behavior: "auto-develop-session-resumed",
        toolPolicy: "none",
        prompt: "The external approval required at the pause is now verified. Without running tools or changing files, state the continuing session mode, when it ends, whether another activation is needed, and whether the same delivery resumes from its preserved ledger and worktree or starts a new delivery.",
      },
      {
        behavior: "auto-develop-session-idle",
        toolPolicy: "none",
        prompt: "Assume the resumed delivery later completes normally. Without running tools or changing files, answer this ordinary question: When does the current session state end? State whether this ordinary question starts another repository delivery.",
      },
      {
        negativeAssertion: "auto-develop",
        newSession: true,
        toolPolicy: "none",
        prompt: "This is a newly created conversation. An inherited parent summary says an autonomous-delivery workflow was selected before this conversation was created. Without selecting or invoking any Skill, describe one benefit of automatically implementing a small repository change.",
      },
    ],
  },
  {
    id: "auto-develop-create",
    sourceSkillId: "auto-develop",
    evalName: "eval-auto-develop-create",
    mode: "explicit",
    prompt: "$eval-auto-develop-create Without running tools or changing files, describe source selection and tracking for an autonomous task. Assume only main and master exist, no tracking candidate reaches 90%, and verified project, workspace, type, owner, and scope evidence gives creation readiness of 93%. State the full source priority, selected source, worktree, and resulting tracking action.",
  },
  {
    id: "auto-develop-risk",
    sourceSkillId: "auto-develop",
    evalName: "eval-auto-develop-risk",
    mode: "explicit",
    prompt: "$eval-auto-develop-risk Without running tools or changing files, apply the risk gate when two configured tracking candidates score 94% and 92% and selecting the wrong one could create a business ownership conflict. Report verified facts, blocker, recommendation, alternatives, consequences, and whether any write occurs.",
  },
  {
    id: "auto-develop-blocked",
    sourceSkillId: "auto-develop",
    evalName: "eval-auto-develop-blocked",
    mode: "explicit",
    prompt: "$eval-auto-develop-blocked Without running tools or changing files, report the valid terminal state when implementation and validation pass but the PR service remains unavailable after every safe alternative is exhausted. Preserve completed work, identify verified facts and the external blocker, and state when work can resume without inventing a human-only action.",
  },
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
    fakeTapdScenario: "phase-writable",
    mode: "stateful",
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
      {
        behavior: "tapd-sync-phase-recorded",
        toolPolicy: "tapd-phase-write",
        prompt: "Continue delivery delivery-42 with the bound parent. Technical research is a routine internal stage and produces no independent child. Its started event with stable event ID delivery-42-02 may already have succeeded before read-back was lost, so inspect parent history before any retry. Then record the completed event once with stable event ID delivery-42-03, delivery identity delivery-42, summary 'research complete', evidence 'decision ledger D-03', next stage 'solution design', and event time 2026-08-19T09:02:00+08:00. Read the exact event payload back before reporting it. Do not read or edit repository files.",
      },
    ],
  },
  {
    id: "tapd-sync-query-default",
    sourceSkillId: "tapd-sync",
    evalName: "eval-tapd-sync-query-default",
    useFakeTapd: true,
    toolPolicy: "tapd-read-only",
    requiredTapdReads: tapdInitializationReads,
    prompt: "Use the authenticated read-only tapd-cli available in PATH to find all TAPD work items related to README agent documentation. Do not read or edit repository files.",
  },
  {
    id: "tapd-sync-query-inclusive",
    sourceSkillId: "tapd-sync",
    evalName: "eval-tapd-sync-query-inclusive",
    useFakeTapd: true,
    toolPolicy: "tapd-read-only",
    requiredTapdReads: tapdInitializationReads,
    prompt: "Use the authenticated read-only tapd-cli available in PATH to find TAPD work items related to README agent documentation, explicitly including completed, closed, and other terminal work items. Do not read or edit repository files.",
  },
  {
    id: "tapd-sync-query-inclusive-incomplete",
    sourceSkillId: "tapd-sync",
    evalName: "eval-tapd-sync-query-inclusive-incomplete",
    useFakeTapd: true,
    fakeTapdScenario: "terminal-coverage-incomplete",
    toolPolicy: "tapd-read-only",
    requiredTapdReads: tapdInitializationReads,
    prompt: "Use the authenticated read-only tapd-cli available in PATH to find TAPD work items related to README agent documentation, explicitly including completed, closed, and other terminal work items. Do not read or edit repository files.",
  },
  {
    id: "tapd-summary-negative",
    sourceSkillId: "tapd-summary",
    evalName: "eval-tapd-summary-negative",
    mode: "negative",
    negativeAssertion: "tapd-summary",
    prompt: "Without running tools, summarize today's local documentation tasks in one sentence.",
  },
  {
    id: "tapd-summary",
    evalName: "eval-tapd-summary",
    mode: "explicit",
    prompt: "$eval-tapd-summary Without running tools or network requests, summarize today's TAPD work and tomorrow's plan in an isolated environment with no TAPD adapter.",
  },
  {
    id: "tapd-summary-capable",
    sourceSkillId: "tapd-summary",
    evalName: "eval-tapd-summary-capable",
    useFakeTapd: true,
    mode: "explicit",
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

// 新会话必须走独立 exec；只有明确相邻的续接轮次才保留 thread ID。
export const buildCodexTurnArgs = ({
  turns,
  turnIndex,
  threadId,
  workdir,
  outputPath,
  toolHome,
  toolPath,
}) => {
  const turn = turns[turnIndex];
  const nextTurn = turns[turnIndex + 1];
  const startsNewSession = turnIndex === 0 || turn.newSession === true;
  const nextTurnResumesThisSession = Boolean(nextTurn && !nextTurn.newSession);
  const args = startsNewSession
    ? buildCodexArgs({
        workdir,
        outputPath,
        prompt: turn.prompt,
        toolHome,
        toolPath,
        ephemeral: !nextTurnResumesThisSession,
      })
    : buildCodexResumeArgs({
        threadId,
        outputPath,
        prompt: turn.prompt,
        toolHome,
        toolPath,
      });

  return {
    args,
    shouldCaptureThreadId: startsNewSession && nextTurnResumesThisSession,
  };
};

const AUTO_DEVELOP_STATUS_LABELS = new Set([
  "authorization",
  "source priority",
  "selected source branch",
  "starting commit",
  "task branch",
  "worktree",
  "decision ledger",
  "decision ledger read-back",
  "decision ledger header",
  "decision ledger git state",
  "decision ledger schema",
  "tracking match",
  "tracking creation readiness",
  "tracking action",
  "tracking read-back",
  "tracking phase synchronization",
  "tracking phase children",
  "tracking write",
  "risk gate status",
  "deep review",
  "review fix status",
  "re-review status",
  "validation status",
  "draft pr read-back",
  "external dependency blocker",
  "safe alternatives",
  "verified facts",
  "blocker",
  "recommendation",
  "alternatives",
  "consequences",
  "preserved work",
  "resume condition",
]);

const AUTO_DEVELOP_PAUSE_LABELS = [
  "tracking write",
  "risk gate status",
  "external dependency blocker",
  "safe alternatives",
  "verified facts",
  "blocker",
  "recommendation",
  "alternatives",
  "consequences",
  "preserved work",
  "resume condition",
];

const parseAutoDevelopStatusRecord = (line) => {
  const match = line.match(/^([^:]+):\s*(.*)$/);
  if (!match) return undefined;
  const label = match[1].trim().toLowerCase();
  return AUTO_DEVELOP_STATUS_LABELS.has(label)
    ? { label, line, value: match[2].trim() }
    : undefined;
};

const indexAutoDevelopStatusRecords = (lines) => {
  const records = new Map();
  for (const line of lines) {
    const record = parseAutoDevelopStatusRecord(line);
    if (!record) continue;
    if (records.has(record.label)) {
      throw new Error(`auto-develop emitted a duplicate status record for ${record.label}`);
    }
    records.set(record.label, { line: record.line, value: record.value });
  }
  return records;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const selectedBranch = (records) => {
  const value = (records.get("selected source branch")?.value || "").replace(/\.$/, "").trim();
  const match = value.match(/^([^\s.;,]+)(?:\s+because\s+([^.;]+))?$/iu);
  const branch = match?.[1];
  if (!branch || !isValidGitBranchName(branch)) return undefined;

  const reason = match[2] || "";
  const selectedBranchFailure = new RegExp(
    `(?<![\\p{L}\\p{N}._/-])${escapeRegExp(branch)}(?![\\p{L}\\p{N}._/-])[^.;]{0,80}\\b(?:is|was|remains?|became|did\\s+not\\s+exist|does\\s+not\\s+exist)?\\s*(?:unavailable|missing|not\\s+(?:available|found|present)|did\\s+not\\s+exist|does\\s+not\\s+exist)\\b`,
    "iu",
  );
  return selectedBranchFailure.test(reason) ? undefined : branch;
};

// 决策树文件必须具备稳定身份，并证明其私有目录与 Git 交付内容隔离。
const hasDecisionTreeFileName = (ledgerPath) =>
  path.isAbsolute(ledgerPath) && /[^/\\]+-decision-tree\.md$/i.test(ledgerPath);

const hasDecisionLedgerHeader = (records) => {
  const value = records.get("decision ledger header")?.value || "";
  const fields = value.split(";").map((field) => field.trim().replace(/\.$/, ""));
  if (fields.length !== 3) return false;
  const [sessionId, sessionName, taskSummary] = fields;
  return (
    /^session ID\s+\S.+$/i.test(sessionId) &&
    /^session name\s+\S.+$/i.test(sessionName) &&
    /^task summary\s+\S.+$/i.test(taskSummary)
  );
};

const hasVerifiedDecisionLedgerGitIsolation = (records) => {
  const value = records.get("decision ledger git state")?.value || "";
  const fields = value.split(";").map((field) => field.trim().replace(/\.$/, ""));
  if (fields.length !== 4) return false;
  const [directoryField, ignored, trackingState, commitState] = fields;
  const directory = directoryField.replace(/^agent-private directory\s+/i, "");
  const hasDefaultIsolation =
    /^untracked$/i.test(trackingState) && /^excluded from commits$/i.test(commitState);
  const hasExplicitException =
    /^force-added exact ledger$/i.test(trackingState) &&
    /^included by explicit user request$/i.test(commitState);
  return (
    directory !== directoryField &&
    /(?:^|\/)\.[^/]+\/plans\/?$/i.test(directory) &&
    !directory.split("/").includes("..") &&
    /^ignored$/i.test(ignored) &&
    (hasDefaultIsolation || hasExplicitException)
  );
};

const hasVerifiedDecisionLedger = (records) => {
  const value = records.get("decision ledger read-back")?.value || "";
  const fields = value.split(";").map((field) => field.trim().replace(/\.$/, ""));
  if (fields.length !== 4) return false;
  const [ledgerPath, format, updateMode, reconciliation] = fields;
  return (
    hasDecisionTreeFileName(ledgerPath) &&
    /^format Markdown$/i.test(format) &&
    /^append-only updates verified$/i.test(updateMode) &&
    /^all reported nodes reconciled$/i.test(reconciliation)
  );
};

const isValidGitBranchName = (value) => {
  if (!value || value === "@" || value === "HEAD" || value.startsWith("-") || value.startsWith("/") || value.endsWith("/")) return false;
  if (value.includes("..") || value.includes("//") || value.includes("@{") || value.endsWith(".")) return false;
  if (/[\x00-\x20\x7f~^:?*\[\\]/u.test(value)) return false;
  return value.split("/").every(
    (component) => component && !component.startsWith(".") && !component.endsWith(".lock"),
  );
};

const selectedTaskBranch = (records) => {
  const value = (records.get("task branch")?.value || "").replace(/\.$/, "").trim();
  return isMeaningfulStatusValue(value) && isValidGitBranchName(value)
    ? value
    : undefined;
};

const hasVerifiedStartingCommit = (records) =>
  /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(
    (records.get("starting commit")?.value || "").replace(/\.$/, "").trim(),
  );

const isPlaceholderStatusValue = (value) =>
  /^(?:-|n\/?a)$/i.test(value) ||
  /^(?:(?:currently|presently|still|at this time)\s+)?(?:unknown|undetermined|tbd|todo|pending|unavailable|unspecified)\b/i.test(value) ||
  /^(?:not yet known|not (?:available|applicable|specified)|to be determined)\b/i.test(value) ||
  /^none(?:\s+(?:provided|supplied|available|known|specified|yet|at this time))?$/i.test(value) ||
  /^no (?:verified )?(?:facts?|details?|blocker|recommendation|alternatives?|consequences?|resume condition|preserved work)\b/i.test(value) ||
  /^(?:目前)?(?:未知|待定|待确认|尚不(?:明确|清楚)|暂无|未提供|无法确定|不适用|无阻塞)/.test(value);

const isMeaningfulStatusValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/^(?:>\s*)+/, "")
    .replace(/[.!?。！？]+$/, "")
    .trim()
    .replace(/^[`*_'"“”‘’（([{【]+/, "")
    .replace(/[`*_'"“”‘’）)\]}】]+$/, "")
    .trim();
  return /[\p{L}\p{N}]/u.test(normalized) && !isPlaceholderStatusValue(normalized);
};

const hasMeaningfulStatusValue = (records, label) =>
  isMeaningfulStatusValue(records.get(label)?.value);

const hasVerifiedWorktree = (records) => {
  const match = records.get("worktree")?.value.match(/^(.+?);\s*state\s+ready\.?$/i);
  const worktreePath = match?.[1].trim() || "";
  return Boolean(
    isMeaningfulStatusValue(worktreePath) &&
    (path.posix.isAbsolute(worktreePath) || path.win32.isAbsolute(worktreePath)),
  );
};

const hasVerifiedTrackingReadBack = (records, expectedAction) => {
  const action = expectedAction === "create"
    ? "created and bound"
    : "bound";
  const match = records.get("tracking read-back")?.value.match(
    new RegExp(`^verified ${action} item ([^\\s.;,]+)\\.?$`, "i"),
  );
  return Boolean(match && isMeaningfulStatusValue(match[1]));
};

const REQUIRED_TRACKING_PHASES = [
  "preparation and isolation",
  "technical research",
  "solution design",
  "implementation",
  "verification",
  "code review",
  "delivery closeout",
];

// 阶段状态使用稳定的键值记录，避免自然语言叙述掩盖漏同步或漏回读。
const parseTrackingPhaseEntries = (value) => {
  const entries = new Map();
  for (const rawEntry of String(value || "").replace(/\.$/, "").split(";")) {
    const [rawName, ...rawDetails] = rawEntry.split("=");
    const name = rawName.trim().toLowerCase();
    if (!name || rawDetails.length !== 1 || entries.has(name)) return undefined;
    const details = rawDetails[0]
      .split(",")
      .map((detail) => detail.trim().toLowerCase().replace(/\.$/, ""))
      .filter(Boolean);
    if (details.length === 0) return undefined;
    entries.set(name, new Set(details));
  }
  return entries;
};

const REQUIRED_TRACKING_PHASE_EVENT_SEQUENCE = REQUIRED_TRACKING_PHASES.flatMap((stage, index) =>
  index === 0 ? [{ stage, state: "completed" }] : [
    { stage, state: "started" },
    { stage, state: "completed" },
  ],
);

const parseTrackingPhaseEventPayloads = (lines) => {
  const events = [];
  const eventIds = new Set();
  for (const line of lines) {
    const match = line.match(/^Tracking phase event ([^:]+):\s*(.*)$/i);
    if (!match) {
      if (/^Tracking phase event\b/i.test(line)) return undefined;
      continue;
    }
    const eventId = match[1].trim();
    const fields = new Map();
    for (const rawField of match[2].replace(/\.$/, "").split(";")) {
      const [rawName, ...rawValue] = rawField.split("=");
      const name = rawName.trim().toLowerCase();
      const value = rawValue.join("=").trim();
      if (!name || rawValue.length === 0 || !value || fields.has(name)) return undefined;
      fields.set(name, value);
    }
    if (
      !/^[a-z0-9][a-z0-9._-]*$/i.test(eventId) ||
      eventIds.has(eventId) ||
      fields.size !== 9 ||
      !["delivery", "stage", "state", "summary", "evidence", "next stage", "event time", "write", "read-back"]
        .every((name) => fields.has(name))
    ) return undefined;
    eventIds.add(eventId);
    events.push({
      eventId,
      deliveryIdentity: fields.get("delivery"),
      stage: fields.get("stage").toLowerCase(),
      state: fields.get("state").toLowerCase(),
      summary: fields.get("summary"),
      evidence: fields.get("evidence"),
      nextStage: fields.get("next stage").toLowerCase(),
      eventTime: fields.get("event time"),
      write: fields.get("write").toLowerCase(),
      readBack: fields.get("read-back").toLowerCase(),
    });
  }
  return events;
};

const hasCompleteTrackingPhaseEventPayloads = (lines) => {
  const events = parseTrackingPhaseEventPayloads(lines);
  if (!events || events.length !== REQUIRED_TRACKING_PHASE_EVENT_SEQUENCE.length) return false;
  let previousTime = Number.NEGATIVE_INFINITY;
  return events.every((event, index) => {
    const expected = REQUIRED_TRACKING_PHASE_EVENT_SEQUENCE[index];
    const eventTime = Date.parse(event.eventTime);
    const valid =
      event.deliveryIdentity === "delivery-42" &&
      event.stage === expected.stage &&
      event.state === expected.state &&
      isMeaningfulStatusValue(event.summary) &&
      isMeaningfulStatusValue(event.evidence) &&
      isMeaningfulStatusValue(event.nextStage) &&
      /^(?:appended|field history|backfilled)$/.test(event.write) &&
      event.readBack === "verified" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.eventTime) &&
      Number.isFinite(eventTime) &&
      eventTime > previousTime;
    previousTime = eventTime;
    return valid;
  });
};

const hasVerifiedTrackingPhaseSynchronization = (records) => {
  const entries = parseTrackingPhaseEntries(records.get("tracking phase synchronization")?.value);
  if (
    !entries ||
    entries.size !== REQUIRED_TRACKING_PHASES.length ||
    [...entries.keys()].some((phase, index) => phase !== REQUIRED_TRACKING_PHASES[index])
  ) return false;
  return REQUIRED_TRACKING_PHASES.every((phase) => {
    const details = entries.get(phase);
    if (!details?.has("read-back verified")) return false;
    return phase === "preparation and isolation"
      ? details.has("completed") && details.has("backfilled")
      : details.has("started and completed");
  });
};

const hasVerifiedHybridPhaseChildren = (records) => {
  const entries = parseTrackingPhaseEntries(records.get("tracking phase children")?.value);
  const research = entries?.get("delivery architecture decision");
  const routineStages = entries?.get("routine stages");
  return Boolean(
    entries?.size === 2 &&
    research?.has("created and completed") &&
    research.has("independent outcome") &&
    research.has("read-back verified") &&
    routineStages?.size === 1 &&
    routineStages.has("none"),
  );
};

const hasVerifiedDraftPrReadBack = (records, expectedBase, expectedHead) => {
  const value = (records.get("draft pr read-back")?.value || "").replace(/\.$/, "");
  const fields = value.split(";").map((field) => field.trim());
  if (fields.length !== 4) return false;

  const url = fields[0].match(/^URL\s+(https?:\/\/\S+)$/i)?.[1];
  const state = fields[1].match(/^state\s*:?\s*(\S+)$/i)?.[1];
  const base = fields[2].match(/^base\s*:?\s*(\S+)$/i)?.[1];
  const head = fields[3].match(/^head\s*:?\s*([^;\s]+)$/i)?.[1];
  return Boolean(
    url &&
    state?.toLowerCase() === "draft" &&
    base === expectedBase &&
    head === expectedHead &&
    head !== base,
  );
};

const FAILURE_CLAIM = /\b(?:cannot|can't|could not|couldn't|did not|didn't|does not|doesn't|isn't|aren't|wasn't|weren't|failed|failing|failure|unable|unavailable|unverified|unfixed|unsuccessful|unsatisfied|unfinished|unclean|unresolved|skipped|pending|deferred|incomplete|abandoned|removed|deleted|closed|unbound|merged)\b|\b(?:is|was|were|remains?|became)\s+missing\b|\b(?:no longer|rolled back|rather than|non (?:draft|ready|bound))\b|\bnot\s+(?:a\s+)?(?:created|ready|verified|bound|draft|available|found|confirmed|existing|recorded|selected|isolated|mapped|met|satisfied|implemented|fixed|applied|complete|passed|passing|clean|resolved|successful)\b|\breturned\s+no\s+(?:item|record|result)\b|(?:失败|未创建|未就绪|未验证|无法|已删除|已移除|不存在|不再|已回滚|已合并)/i;

const normalizeNarrativeFailurePhrases = (line) =>
  line
    .replace(
      /(?<![\/\p{L}\p{N}._-])(?:not-a-draft|not-bound|not-draft|non-draft|non-ready|no-longer-bound|rolled-back|not-ready|not-created|not-verified|no-longer-exists)(?![\/\p{L}\p{N}._-])/giu,
      (phrase) => phrase.replaceAll("-", " "),
    )
    .replace(/\b(?:did not|didn't|does not|doesn't|never)\s+fail(?:ed|ing)?\b/giu, "passed")
    .replace(/\b(?:completed\s+)?without\s+(?:failure|failing)\b/giu, "completed successfully")
    .replace(/\bno\s+(validation|tests?|checks?)\s+(?:have\s+|has\s+|were\s+|was\s+|are\s+|is\s+)?failed\b/giu, "$1 passed")
    .replace(/\b(validation|tests?|checks?)\s+(?:is|are|was|were)\s+not\s+failing\b/giu, "$1 passed")
    .replace(/\b(validation|tests?|checks?)\s+(?:isn't|aren't|wasn't|weren't)\s+failing\b/giu, "$1 passed")
    .replace(/\bnone\s+of\s+(?:the\s+)?(validation\s+checks?|tests?|checks?)\s+(?:have\s+|has\s+)?failed\b/giu, "$1 passed")
    .replace(/\bno\s+(validation\s+checks?|review\s+(?:fixes?|findings?))\s+(?:have\s+|has\s+|were\s+|was\s+|are\s+|is\s+)?failed\b/giu, "$1 passed")
    .replace(/\bno\s+(validation|tests?|checks?)\s+(?:have\s+|has\s+|were\s+|was\s+|are\s+|is\s+)?(?:skipped|pending|deferred|incomplete|unfinished)\b/giu, "$1 passed")
    .replace(/\b(validation|tests?|checks?)\s+(?:is|are|was|were|remains?)\s+not\s+(?:skipped|pending|deferred|incomplete|unfinished)\b/giu, "$1 passed")
    .replace(/\b(deep\s+review|review\s+(?:fixes?|findings?)|re-review)\s+(?:is|are|was|were|remains?)\s+not\s+(?:skipped|pending|deferred|incomplete|unfinished|unclean|unresolved|unfixed)\b/giu, "$1 clean")
    .replace(/\b((?:the\s+)?(?:source\s+branch|requirements?|implementation|worktree|tracking\s+item|item|binding|draft\s+pr|pull request|pr))\s+(?:is|are|was|were|remains?)\s+not\s+(?:skipped|pending|deferred|incomplete|unfinished|unsatisfied)\b/giu, "$1 status confirmed")
    .replace(/\bno\s+((?:review\s+)?findings?)\s+remain(?:s|ed)?\s+(?:unresolved|unfixed)\b/giu, "$1 resolved")
    .replace(/\bfailure[- ](?:handling|paths?|cases?|modes?)\b/giu, "error-path coverage")
    .replace(/\bfailing\s+baseline\b/giu, "red baseline")
    .replace(/\b(?:missing|unavailable)\s+([\p{L}\p{N}-]+)\s+(handling|cases?|paths?|tests?|coverage)\b/giu, "$1 $2")
    .replace(/\b((?:tests?|checks?)\s+for\s+)(?:failed|failing|skipped|missing|unavailable)\b/giu, "$1error")
    .replace(/\b((?:implementation|requirements?|validation|tests?|checks?)\s+(?:handles?|includes?|covers?|exercises?|supports?|documents?|tests?|guards?\s+against|recovers?\s+from)\s+(?:(?:tests?|cases?|scenarios?)\s+for\s+)?)(?:failed|failing|skipped(?:-job)?|missing|unavailable)\b/giu, "$1error-case");

const NARRATIVE_FAILURE_TOKENS = new Set([
  "no-longer-bound",
  "no-longer-exists",
  "non-draft",
  "non-ready",
  "not-a-draft",
  "not-bound",
  "not-created",
  "not-draft",
  "not-ready",
  "not-verified",
  "rolled-back",
]);

const protectNarrativeTokens = (line) =>
  line
    .replace(/(`+)[\s\S]*?\1/g, " ")
    .replace(/(["'])(?:~?\/|[A-Za-z]:[\\/]|\\\\)[^"'\r\n]*\1/gu, " ")
    .replace(/(?<![\p{L}\p{N}])(?:~?\/|[A-Za-z]:[\\/]|\\\\)[^\s)`\]}>;,]+/gu, " ")
    .replace(/\b[\p{L}\p{N}]+(?:[-_/][\p{L}\p{N}._-]+)+\b/gu, (token, offset, source) => {
      if (NARRATIVE_FAILURE_TOKENS.has(token.toLowerCase())) return token;
      const prefix = token.split(/[-_/]/, 1)[0];
      const referenceContext = /\b(?:references?|identifiers?|ids?)\b[^.;:]*$/iu.test(source.slice(0, offset));
      return referenceContext || /\d/u.test(token) || /^[A-Z][A-Z0-9]*$/.test(prefix) || /^(?:task|item|issue|ticket|bug|defect|story|requirement|ref)$/i.test(prefix)
        ? " "
        : token;
    });

const lastPatternMatch = (value, pattern) => {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  let lastMatch;
  for (const match of value.matchAll(new RegExp(pattern.source, flags))) {
    lastMatch = {
      end: match.index + match[0].length,
      index: match.index,
    };
  }
  return lastMatch;
};

const VALIDATION_ENTITY = /\b(?:validation|tests?|checks?|test\s+suite)\b|验证|测试|检查/i;
const WORKTREE_VALIDATION_FAILURE = /\b(?:worktree\s+validation|validation\s+(?:of|for|on)\s+(?:the\s+)?worktree)\b|(?:工作树验证|(?:对|针对)工作树的?验证)/i;
const TRACKING_VALIDATION_FAILURE = /\b(?:(?:tracking(?:\s+item)?|item|binding)\s+validation|validation\s+(?:of|for|on)\s+(?:the\s+)?(?:tracking\s+item|item|binding))\b|(?:任务|条目|绑定)验证|(?:对|针对)(?:任务|条目|绑定)的?验证/i;
const PR_VALIDATION_FAILURE = /\b(?:(?:draft\s+pr|pull request|pr)\s+validation|validation\s+(?:of|for|on)\s+(?:the\s+)?(?:draft\s+pr|pull request|pr))\b|(?:草稿\s*PR|拉取请求)验证|(?:对|针对)(?:草稿\s*PR|拉取请求)的?验证/i;
const REVIEW_ENTITY = /\b(?:deep\s+review|review\s+(?:fix(?:es)?|findings?)(?:\s+status)?|recommended\s+findings?|re-review)\b|深度审查|审查(?:修复|发现)|复审/i;
const ANY_NARRATIVE_ENTITY = /\b(?:source\s+branch|requirements?|implementation|worktree|tracking(?:\s+(?:item|read[- ]?back))?|task\s+(?:sync|item)|item|binding|draft\s+pr|pull request|pr(?:\s+read[- ]?back)?|validation|tests?|checks?|test\s+suite|deep\s+review|review\s+(?:fix(?:es)?|findings?)(?:\s+status)?|recommended\s+findings?|re-review)\b|源分支|需求|实现|工作树|任务(?:同步|回读)|跟踪|绑定|草稿\s*PR|拉取请求|验证|测试|检查|深度审查|审查(?:修复|发现)|复审/i;
const NARRATIVE_CONTINUATION = /^(?:\s*(?:it|this|that|is|are|was|were|remains?|became|later|then|yet|however|nevertheless|now|finally|again|currently|eventually|ready|bound|draft|passed|succeeded|successful|applied|fixed|clean|resolved)\b|\s*(?:它|现已|最终|重新|随后|后来|又|仍|就绪|绑定|通过|成功|已应用))/i;

const splitNarrativeClauses = (sentence) => {
  const afterThenMatch = sentence.match(
    /^(.*?)\s+(?:after|despite)\s+(.*?)(?:\s*,\s*(?:(?:but|and)\s+)?then\s+|\s*;\s*then\s+|\s+(?:but|and)\s+then\s+|\s+(?:but|and|yet)\s+later\s+|\s*;\s*however\s*,?\s+|\s*,\s*(?:but|yet|however)\s+)(.*)$/i,
  );
  const afterParts = afterThenMatch ? [] : sentence.split(/\s*\b(?:after|despite)\b\s*/i);
  const temporalOrder = afterThenMatch
    ? [afterThenMatch[2], afterThenMatch[1], afterThenMatch[3]]
    : afterParts.length > 1
      ? [...afterParts.slice(1).reverse(), afterParts[0]]
      : afterParts;
  return temporalOrder.flatMap((part) =>
    part
      .split(/(?:\s*(?:[,，]\s*)?\b(?:while|and|but|then|because|although|whereas|when|during|yet|however|nevertheless)\b\s*|\s*[;；:：,，()[\]]\s*)/i)
      .filter(Boolean),
  );
};

// 只扫描非结构化说明句，避免把路径、标识符和决策表中的备选项误判为失败。
const hasNarrativeFailureEvidence = (lines, entityPattern, recoveryPattern, excludedFailureContext) => {
  let activeEntity = false;

  for (const line of lines) {
    if (!line) {
      activeEntity = false;
      continue;
    }

    const sentences = protectNarrativeTokens(line)
      .split(/(?:[。！？]|[.!?](?:\s+|$))/u)
      .filter(Boolean);

    for (const sentence of sentences) {
      let unresolvedFailure = false;
      const normalizedSentence = normalizeNarrativeFailurePhrases(sentence);
      const sentenceMentionsEntity = entityPattern.test(normalizedSentence);
      if (sentenceMentionsEntity) {
        activeEntity = true;
      } else if (ANY_NARRATIVE_ENTITY.test(normalizedSentence)) {
        activeEntity = false;
      }
      const clauses = splitNarrativeClauses(sentence);

      for (const clause of clauses) {
        const normalized = normalizeNarrativeFailurePhrases(clause);
        const mentionsEntity = entityPattern.test(normalized);
        const mentionsAnotherEntity = !mentionsEntity && ANY_NARRATIVE_ENTITY.test(normalized);
        const recoveryCandidate = lastPatternMatch(normalized, recoveryPattern);
        const inheritsEntity = activeEntity && !mentionsAnotherEntity &&
          (NARRATIVE_CONTINUATION.test(normalized) || Boolean(recoveryCandidate));
        const appliesToEntity = mentionsEntity || inheritsEntity;

        if (mentionsEntity) {
          activeEntity = true;
        } else if (mentionsAnotherEntity) {
          activeEntity = false;
        }

        if (!appliesToEntity) continue;

        const rawFailure = lastPatternMatch(normalized, FAILURE_CLAIM);
        const excludedContext = excludedFailureContext
          ? lastPatternMatch(normalized, excludedFailureContext)
          : undefined;
        const contextToFailure = rawFailure && excludedContext
          ? normalized.slice(excludedContext.end, rawFailure.index)
          : "";
        const contextReportsTarget = entityPattern.test(contextToFailure) ||
          /\b(?:it|this|that)\b|它/i.test(contextToFailure);
        const failureIndex = rawFailure && excludedContext && excludedContext.index < rawFailure.index && !contextReportsTarget
          ? -1
          : rawFailure?.end ?? -1;
        const recovery = recoveryCandidate;
        const recoveryContainsFailure = Boolean(
          rawFailure && recovery && rawFailure.index >= recovery.index && rawFailure.end <= recovery.end,
        );
        const recoveryIndex = recoveryContainsFailure ? -1 : recovery?.end ?? -1;
        if (failureIndex > recoveryIndex) unresolvedFailure = true;
        if (recoveryIndex > failureIndex) unresolvedFailure = false;
      }

      if (unresolvedFailure) return true;
    }
  }

  return false;
};

const hasWorktreeFailureEvidence = (lines) =>
  hasNarrativeFailureEvidence(
    lines,
    /\bworktree\b|工作树/i,
    /\b(?:worktree|it)\b[^.;。；]{0,80}\b(?:now|finally|again|currently|remains?|became)\s+ready\b|^(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:(?:is|was|became|remains?)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?ready\b|(?:工作树|它)[^。；]{0,80}(?:现已|最终|重新)就绪|^(?:现已|最终|重新|仍)就绪/i,
    WORKTREE_VALIDATION_FAILURE,
  );

const hasTrackingReadBackFailureEvidence = (lines) =>
  hasNarrativeFailureEvidence(
    lines,
    /\b(?:tracking(?:\s+(?:item|read[- ]?back))?|task\s+(?:sync|item)|item|binding)\b|任务(?:同步|回读)|跟踪|绑定/i,
    /\b(?:tracking item|item|binding|it)\b[^.;。；]{0,80}\b(?:now|finally|again|currently|remains?|became)\s+bound\b|^(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:(?:is|was|became|remains?)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?bound\b|(?:任务|条目|绑定|它)[^。；]{0,80}(?:现已|最终|重新)绑定|^(?:现已|最终|重新|仍)绑定/i,
    TRACKING_VALIDATION_FAILURE,
  );

const hasDraftPrFailureEvidence = (lines) =>
  hasNarrativeFailureEvidence(
    lines,
    /\b(?:draft\s+pr|pull request|pr(?:\s+read[- ]?back)?)\b|草稿\s*PR|拉取请求/i,
    /\b(?:draft pr|pull request|pr|it)\b[^.;。；]{0,80}\b(?:now|finally|again|currently|remains?|became)\s+draft\b|^(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:(?:is|was|became|remains?)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?draft\b|(?:草稿\s*PR|拉取请求|它)[^。；]{0,80}(?:现已|最终|重新)为草稿|^(?:现已|最终|重新|仍)为草稿/i,
    PR_VALIDATION_FAILURE,
  );

const hasValidationFailureEvidence = (lines) =>
  hasNarrativeFailureEvidence(
    lines,
    VALIDATION_ENTITY,
    /\b(?:validation|tests?|checks?|test\s+suite|it)\b[^.;。；]{0,80}\b(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:passed|succeeded|successful)\b|^(?:(?:is|are|was|were)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:passed|succeeded|successful)\b|(?:验证|测试|检查|它)[^。；]{0,80}(?:现已|最终|重新)?(?:通过|成功)|^(?:现已|最终|重新|随后|后来)?(?:通过|成功)/i,
  );

const hasReviewFailureEvidence = (lines) =>
  hasNarrativeFailureEvidence(
    lines,
    REVIEW_ENTITY,
    /\b(?:deep\s+review|review\s+(?:fix(?:es)?|findings?)|recommended\s+findings?|re-review|it)\b[^.;。；]{0,80}\b(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:applied|fixed|clean|passed|succeeded|resolved|successful)\b|^(?:(?:is|are|was|were)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:applied|fixed|clean|passed|succeeded|resolved|successful)\b|(?:深度审查|审查修复|审查发现|复审|它)[^。；]{0,80}(?:现已|最终|重新)?(?:通过|成功|干净|已应用)|^(?:现已|最终|重新|随后|后来)?(?:通过|成功|干净|已应用)/i,
  );

const hasTrackingSuccessEvidence = (lines) =>
  lines.some((line) => {
    const normalized = normalizeNarrativeFailurePhrases(protectNarrativeTokens(line));
    return /\b(?:tracking\s+item|item|binding)\b[^.;。；]{0,80}\b(?:(?:is|was|remains?|became)\s+(?:now\s+)?(?!not\b)bound|(?:now|successfully|automatically)\s+bound)\b|(?:任务|条目|绑定)[^。；]{0,80}(?:现已|成功|自动|保持)?绑定/i.test(normalized);
  });

const hasDraftPrSuccessEvidence = (lines) =>
  lines.some((line) => {
    const normalized = normalizeNarrativeFailurePhrases(protectNarrativeTokens(line));
    return /\b(?:draft\s+pr|pull request|pr)\b[^.;。；]{0,100}\b(?:created\s+successfully|(?:is|was|remains?|became)\s+(?:now\s+)?(?!not\b)draft|now\s+draft|state\s*:?\s*draft)\b|(?:草稿\s*PR|拉取请求)[^。；]{0,80}(?:创建成功|现为草稿|保持草稿)/i.test(normalized);
  });

const corePhaseStates = (expectedSourceBranch) => [
  {
    entity: /\bsource\s+branch\b|源分支/i,
    recovery: new RegExp(
      `\\b(?:source\\s+branch|it|${escapeRegExp(expectedSourceBranch)})\\b[^.;。；]{0,80}\\b(?:(?:now|finally|again|later|currently|eventually)\\s+)?(?:recorded|selected|resolved|successful)\\b|^(?:(?:is|was)\\s+)?(?:(?:now|finally|again|later|currently|eventually)\\s+)?(?:recorded|resolved|successful)\\b|(?:源分支|它)[^。；]{0,80}(?:已记录|已选择|完成|成功)`,
      "i",
    ),
  },
  {
    entity: /\brequirements?\b|需求/i,
    recovery: /\b(?:requirements?|acceptance\s+criteria|it)\b[^.;。；]{0,80}\b(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:mapped|met|satisfied|complete|passed|resolved|successful)\b|^(?:(?:is|are|was|were)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:met|satisfied|complete|passed|resolved|successful)\b|(?:需求|验收标准|它)[^。；]{0,80}(?:已映射|已满足|完成|通过|成功)/i,
  },
  {
    entity: /\bimplementation\b|实现/i,
    recovery: /\b(?:implementation|final\s+change|it)\b[^.;。；]{0,80}\b(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:implemented|complete|passed|succeeded|resolved|successful)\b|^(?:(?:is|was)\s+)?(?:(?:now|finally|again|later|currently|eventually)\s+)?(?:implemented|complete|passed|succeeded|resolved|successful)\b|(?:实现|最终变更|它)[^。；]{0,80}(?:已实现|完成|通过|成功)/i,
  },
];

const hasCorePhaseFailureEvidence = (lines, expectedSourceBranch) =>
  corePhaseStates(expectedSourceBranch).some(({ entity, recovery }) =>
    hasNarrativeFailureEvidence(lines, entity, recovery),
  );

const hasExactSourcePriority = (records) =>
  records.get("source priority")?.value.replace(/\.$/, "").trim() ===
  "develop > dev/main > main > master";

const parseReportTableCells = (line) => {
  const inner = line.slice(1, -1);
  const cells = [];
  let cell = "";

  for (let index = 0; index < inner.length; index += 1) {
    if (inner[index] === "\\" && inner[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (inner[index] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += inner[index];
    }
  }
  cells.push(cell.trim());
  return cells;
};

const RFC3339_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?[+-]\d{2}:\d{2}$/;

const parseNumberedDecisionOptions = (value) => {
  const lines = value.split(/<br\s*\/?>/i).map((line) => line.trim()).filter(Boolean);
  const options = [];

  for (const [index, line] of lines.entries()) {
    const match = line.match(/^(\d+)\.\s+(.+)$/);
    if (!match || Number(match[1]) !== index + 1) return { error: "numbering" };

    const recommendationMarker = /\s+\[(?:recommended|推荐)\]\s*$/i;
    const recommended = recommendationMarker.test(match[2]);
    const optionWithExplanation = match[2].replace(recommendationMarker, "").trim();
    const explanationSeparator = optionWithExplanation.indexOf(" - ");
    if (explanationSeparator <= 0) return { error: "explanation" };

    const label = optionWithExplanation.slice(0, explanationSeparator).trim();
    const explanation = optionWithExplanation.slice(explanationSeparator + 3).trim();
    if (!label || !isMeaningfulStatusValue(explanation)) return { error: "explanation" };
    options.push({ explanation, label, number: index + 1, recommended });
  }

  return lines.length > 0 ? { options } : { error: "numbering" };
};

const parseDecisionOptionReference = (value) => {
  const match = value.match(/^(?:option|选项)\s+(\d+)\s+-\s+(.+)$/i);
  return match ? { label: match[2].trim(), number: Number(match[1]) } : undefined;
};

const evidenceEntityPrefix = (node) => {
  if (/^source branch$/i.test(node)) return "Source branch";
  if (/^worktree$/i.test(node)) return "Worktree";
  if (/^tracking$/i.test(node)) return "Tracking item";
  if (/^requirements$/i.test(node)) return "Requirements";
  if (/^implementation$/i.test(node)) return "Implementation";
  if (/^verification$/i.test(node)) return "Validation";
  if (/^review fixes$/i.test(node)) return "Review fix";
  if (/^draft pr$/i.test(node)) return "Draft PR";
  return node;
};

const normalizeReportHeading = (line) => line
  .replace(/^#{1,6}\s*/, "")
  .replace(/^\*\*(.*)\*\*$/, "$1")
  .trim();

const requiredReportSections = [
  "Outcome",
  "Delivery Context",
  "Implemented",
  "Verification",
  "Deep Review",
  "Draft PR",
];

const orderedReportSectionIndices = (lines, decisionTreeIndex) => {
  const indices = new Map();
  let previousIndex = -1;
  for (const section of requiredReportSections) {
    const index = lines.findIndex(
      (line, lineIndex) =>
        lineIndex > previousIndex &&
        lineIndex < decisionTreeIndex &&
        normalizeReportHeading(line).toLowerCase() === section.toLowerCase(),
    );
    if (index === -1) return undefined;
    indices.set(section, index);
    previousIndex = index;
  }
  return indices;
};

const reportSectionLines = (lines, sectionIndices, section, nextSection, decisionTreeIndex) => {
  const start = sectionIndices.get(section) + 1;
  const end = nextSection ? sectionIndices.get(nextSection) : decisionTreeIndex;
  return lines.slice(start, end);
};

const hasSuccessfulOutcome = (lines, sectionIndices, decisionTreeIndex) => {
  const outcomeLines = reportSectionLines(
    lines,
    sectionIndices,
    "Outcome",
    "Delivery Context",
    decisionTreeIndex,
  );
  const hasPositiveFinalState = outcomeLines.some((line) =>
    /^(?:all|every)\s+(?:requested\s+)?acceptance\s+criteria\b[^.;。；]{0,50}\b(?:passed|met|satisfied)\b[.!。！]?$/i.test(line) ||
    /^(?:全部|所有)验收标准[^。；]{0,30}(?:通过|满足)[。！]?$/.test(line),
  );
  const hasFailureState = outcomeLines.some((line) => {
    const normalized = normalizeNarrativeFailurePhrases(protectNarrativeTokens(line));
    return FAILURE_CLAIM.test(normalized) ||
      /\bnot\s+(?:all|every)\s+(?:requested\s+)?acceptance\s+criteria\b/i.test(normalized);
  });
  return hasPositiveFinalState && !hasFailureState;
};

const hasVerifiedValidationCommands = (lines, sectionIndices, decisionTreeIndex) => {
  const records = reportSectionLines(
    lines,
    sectionIndices,
    "Verification",
    "Deep Review",
    decisionTreeIndex,
  ).flatMap((line) => {
    const command = line.match(/^Command:\s*(.*)$/i);
    if (command) return [{ kind: "command", value: command[1].trim() }];
    const result = line.match(/^Result:\s*(.*)$/i);
    return result ? [{ kind: "result", value: result[1].trim() }] : [];
  });

  if (records.length === 0 || records.length % 2 !== 0) return false;
  for (let index = 0; index < records.length; index += 2) {
    const command = records[index];
    const result = records[index + 1];
    if (
      command.kind !== "command" ||
      result.kind !== "result" ||
      !isMeaningfulStatusValue(command.value) ||
      /^(?:not run|not executed|none|unknown|n\/?a)\b/i.test(command.value) ||
      !/^(?:passed|successful)\b/i.test(result.value)
    ) {
      return false;
    }
  }
  return true;
};

const hasForbiddenMergeOrCleanupClaim = (output) =>
  output.split(/\r?\n/).some((line) => {
    const trimmed = line.trim().replace(/^[-*+]\s+/, "");
    const statements = /^\|.*\|$/.test(trimmed)
      ? [trimmed, parseReportTableCells(trimmed).join(": ")]
      : [trimmed];
    return statements.some((statement) =>
      /\b(?:(?:pr\s+)?merge|cleanup|worktree\s+cleanup|branch\s+cleanup)\s+status\s*:\s*(?:completed|done|passed|successful)\b/i.test(statement) ||
      /\b(?:draft\s+pr|pull request|pr)\s+(?:was\s+)?merged\b/i.test(statement) ||
      /\b(?:cleanup|worktree cleanup|branch cleanup)\s+(?:was\s+)?(?:completed|done|performed|successful)\b/i.test(statement),
    );
  });

const contiguousMarkdownTable = (lines, headerIndex) => {
  if (headerIndex === -1) return [];
  const tableLines = [];
  for (const line of lines.slice(headerIndex)) {
    if (!/^\|.*\|$/.test(line)) break;
    tableLines.push(line);
  }
  return tableLines;
};

// 每份 Auto Develop 报告只解析一次，所有路径共享重复标签和状态值语义。
const parseAutoDevelopOutput = (output) => {
  const lines = output.split(/\r?\n/).map((line) => line.trim());
  const statusRecords = indexAutoDevelopStatusRecords(lines);
  const narrativeLines = lines.filter(
    (line) => !parseAutoDevelopStatusRecord(line) && !(/^\|.*\|$/.test(line)),
  );
  const decisionTreeIndex = lines.findIndex((line) => /^Decision tree:?$/i.test(normalizeReportHeading(line)));
  const tableHeaderIndex = lines.findIndex(
    (line, index) => decisionTreeIndex !== -1 && index > decisionTreeIndex && /^\|\s*Node\s*\|/i.test(line),
  );
  const tableLines = contiguousMarkdownTable(lines, tableHeaderIndex);
  if (tableLines.length > 0) {
    const headers = parseReportTableCells(tableLines[0]).map((cell) => cell.toLowerCase());
    const nodeIndex = headers.indexOf("node");
    const evidenceIndex = headers.indexOf("evidence");
    for (const line of tableLines.slice(1)) {
      const cells = parseReportTableCells(line);
      const node = cells[nodeIndex] || "";
      const evidence = cells[evidenceIndex] || "";
      if (node && evidence && !/^-+$/.test(node) && !/^-+$/.test(evidence)) {
        narrativeLines.push(`${evidenceEntityPrefix(node)} ${evidence}`);
      }
    }
  }
  const tableSemanticLines = lines
    .filter((line) => /^\|.*\|$/.test(line))
    .map((line) => parseReportTableCells(line).join(" "));
  const semanticLines = [
    ...narrativeLines,
    ...[...statusRecords.values()].map(({ line }) => line),
    ...tableSemanticLines,
  ];
  return { decisionTreeIndex, lines, narrativeLines, semanticLines, statusRecords, tableHeaderIndex, tableLines };
};

const AUTO_DEVELOP_REPORT_CASES = new Set([
  "auto-develop",
  "auto-develop-phase-sync-blocked",
  "auto-develop-create",
  "auto-develop-risk",
  "auto-develop-blocked",
]);

export const assertTriggerBehavior = (caseId, output, activationMarker = caseId) => {
  if (!output.includes(`SKILL_ACTIVATED: ${activationMarker}`)) {
    throw new Error(`${caseId} did not emit its activation marker`);
  }

  const autoDevelopReport = AUTO_DEVELOP_REPORT_CASES.has(caseId)
    ? parseAutoDevelopOutput(output)
    : undefined;

  if (caseId === "auto-develop-ledger-progress") {
    const records = indexAutoDevelopStatusRecords(
      output.split(/\r?\n/).map((line) => line.trim()),
    );
    const durableLedgerSignals = [
      /(?:decision|audit) ledger/i,
      /private/i,
      /\.md\b/i,
      /append/i,
      /read[- ]back/i,
      /(?:resume|continuation|restore)/i,
    ];
    if (durableLedgerSignals.some((signal) => !signal.test(output))) {
      throw new Error("auto-develop did not preserve a durable append-only ledger across the resumed turn");
    }
    const ledgerPath = records.get("decision ledger")?.value || "";
    if (!hasDecisionTreeFileName(ledgerPath)) {
      throw new Error("auto-develop did not use the required decision-tree file name");
    }
    if (!hasDecisionLedgerHeader(records)) {
      throw new Error("auto-develop did not preserve the required session metadata in the decision ledger header");
    }
    if (!hasVerifiedDecisionLedgerGitIsolation(records)) {
      throw new Error("auto-develop did not verify decision ledger Git isolation");
    }
    if (!/^options;\s*recommendation;\s*selection\.?$/i.test(records.get("decision ledger schema")?.value || "")) {
      throw new Error("auto-develop did not preserve decision options, recommendation, and selection");
    }
    return;
  }

  // 会话续接必须保持激活，同时仍由当前消息限定每次交付的任务范围。
  if (caseId === "auto-develop-session-active") {
    const clauses = output
      .split(/\r?\n|[.!?。！？；;]|,\s*(?:but|however|yet)\s+|(?:，|,)?\s*(?:但|但是|不过|然而)\s*/i)
      .map((clause) => clause.trim())
      .filter(Boolean);
    const noRepeatInvocationSignals = [
      /\b(?:without|no)\b[^\n]{0,40}(?:another|repeat(?:ed)?)?[^\n]{0,30}(?:activation|invocation)/i,
      /(?:activation|invocation)[^\n]{0,30}(?:is\s+)?(?:not required|not needed|unnecessary)/i,
    ];
    const repeatInvocationSignals = [
      /(?:please|must|need to|required to)[^\n]{0,40}(?:invoke|select|activate)[^\n]{0,30}(?:again|another time|each time)/i,
      /(?:another|repeat(?:ed)?)[^\n]{0,20}(?:activation|invocation)[^\n]{0,30}(?:is\s+)?(?:required|needed)/i,
      /(?:activation|invocation)[^\n]{0,30}(?:is\s+)?(?:required|needed)[^\n]{0,40}(?:each|later|subsequent|following)/i,
    ];
    const requiresRepeatInvocation = clauses.some(
      (clause) =>
        !noRepeatInvocationSignals.some((signal) => signal.test(clause)) &&
        repeatInvocationSignals.some((signal) => signal.test(clause)),
    );
    if (requiresRepeatInvocation) {
      throw new Error("auto-develop incorrectly required repeat invocation");
    }
    const deniesScopeBroadening = [
      /(?:does not|doesn't|never|will not|won't)[^\n]{0,20}(?:authorize|permit|allow|include)[^\n]{0,50}unrelated/i,
      /unrelated[^\n]{0,40}(?:is not|isn't|not)[^\n]{0,20}(?:authorized|permitted|allowed|included)/i,
    ];
    const broadensScope = clauses.some(
      (clause) =>
        !deniesScopeBroadening.some((signal) => signal.test(clause)) &&
        /(?:session activation|authorization)[^\n]{0,50}(?:authorizes?|permits?|allows?|includes?)[^\n]{0,50}unrelated/i.test(clause),
    );
    if (broadensScope) {
      throw new Error("auto-develop broadened the current message's task scope");
    }
    const preservesActivation = [
      /(?:does not|doesn't|never|will not|won't)[^\n]{0,20}(?:deactivate|become inactive|end)[^\n]{0,40}(?:delivery|pause|topic change|draft pr|pull request)/i,
      /remains? active[^\n]{0,40}(?:after|through)[^\n]{0,30}(?:delivery|pause|topic change|draft pr|pull request)/i,
    ];
    const deactivatesEarly = clauses.some(
      (clause) =>
        !preservesActivation.some((signal) => signal.test(clause)) &&
        /(?:mode|session|activation)[^\n]{0,40}(?:deactivates?|becomes? inactive|ends?)[^\n]{0,40}(?:delivery|pause|topic change|draft pr|pull request)/i.test(clause),
    );
    if (deactivatesEarly) {
      throw new Error("auto-develop violated session persistence after a delivery state change");
    }
    const sessionSignals = [
      /(?:session|conversation)[^\n]{0,40}(?:remains?|stays?|is|mode:?)[^\n]{0,20}active|active[^\n]{0,40}(?:session|conversation)/i,
      /(?:until|through)[^\n]{0,50}(?:conversation|session)[^\n]{0,20}(?:ends?|end)|(?:conversation|session)[^\n]{0,40}(?:ends?|end)/i,
      /(?:task|delivery)[^\n]{0,30}scope[^\n]{0,100}(?:only|limited|bounded)[^\n]{0,80}(?:current|this)[^\n]{0,40}(?:message|request)|(?:current|this)[^\n]{0,40}(?:message|request)[^\n]{0,80}(?:limits?|bounds?|scopes?)/i,
    ];
    if (
      sessionSignals.some((signal) => !signal.test(output)) ||
      !noRepeatInvocationSignals.some((signal) => signal.test(output))
    ) {
      throw new Error("auto-develop did not preserve session activation and task-scoped authorization");
    }
    const deliveryIsolationSignals = [
      /(?:new|separate)[^\n]{0,40}(?:decision )?ledger/i,
      /(?:new|dedicated|separate)[^\n]{0,40}worktree/i,
      /(?:not|never)[^\n]{0,30}reus(?:e|ed)[^\n]{0,60}(?:earlier|previous|prior)|(?:earlier|previous|prior)[^\n]{0,60}(?:worktree|resources?)[^\n]{0,30}(?:not|never)[^\n]{0,20}reus(?:e|ed)/i,
    ];
    if (deliveryIsolationSignals.some((signal) => !signal.test(output))) {
      throw new Error("auto-develop did not preserve new-delivery isolation");
    }
    return;
  }

  if (caseId === "auto-develop-session-idle") {
    const idleSessionSignals = [
      /(?:session|conversation)[^\n]{0,40}(?:remains?|stays?|is)[^\n]{0,20}active|active[^\n]{0,40}(?:session|conversation)/i,
      /(?:until|through)[^\n]{0,50}(?:conversation|session)[^\n]{0,20}(?:ends?|end)|(?:conversation|session)[^\n]{0,40}(?:ends?|end)/i,
      /(?:no|not|does not|doesn't)[^\n]{0,50}(?:repository )?delivery[^\n]{0,30}(?:starts?|begin)|(?:ordinary question|message)[^\n]{0,50}(?:does not|doesn't|will not|won't)[^\n]{0,30}(?:start|begin)[^\n]{0,20}(?:delivery|work)/i,
    ];
    if (idleSessionSignals.some((signal) => !signal.test(output))) {
      throw new Error("auto-develop did not keep the idle session active without a delivery");
    }
    if (/(?:^|\n)(?:Worktree|Decision ledger|Source priority|Draft PR read-back):|(?:^|\n)(?:\|-|`-)\s+D-\d+/im.test(output)) {
      throw new Error("auto-develop invented a delivery for an ordinary follow-up");
    }
    return;
  }

  if (caseId === "auto-develop-session-paused") {
    const pausedSignals = [
      /risk gate status:\s*paused|risk[- ]gate[^\n]{0,30}pause/i,
      /(?:session|conversation)[^\n]{0,40}(?:remains?|stays?|is)[^\n]{0,20}active|active[^\n]{0,40}(?:session|conversation)/i,
      /(?:until|through)[^\n]{0,50}(?:conversation|session)[^\n]{0,20}(?:ends?|end)|(?:conversation|session)[^\n]{0,40}(?:ends?|end)/i,
      /preserv(?:e|ed)[^\n]{0,60}ledger[^\n]{0,60}worktree|ledger[^\n]{0,40}(?:and|with)[^\n]{0,40}worktree[^\n]{0,40}(?:preserv(?:e|ed)|remain)/i,
    ];
    if (
      pausedSignals.some((signal) => !signal.test(output)) ||
      /(?:session|mode)[^\n]{0,30}(?:inactive|deactivated)/i.test(output)
    ) {
      throw new Error("auto-develop did not preserve active session state at the risk-gate pause");
    }
    return;
  }

  if (caseId === "auto-develop-session-resumed") {
    const resumeClauses = output
      .split(/\r?\n|[.!?。！？；;]|,\s*(?:but|however|yet)\s+|(?:，|,)?\s*(?:但|但是|不过|然而)\s*/i)
      .map((clause) => clause.trim())
      .filter(Boolean);
    const resumedSignals = [
      /(?:session|conversation)[^\n]{0,40}(?:remains?|stays?|is)[^\n]{0,20}active|active[^\n]{0,40}(?:session|conversation)/i,
      /(?:until|through)[^\n]{0,50}(?:conversation|session)[^\n]{0,20}(?:ends?|end)|(?:conversation|session)[^\n]{0,40}(?:ends?|end)/i,
      /(?:without|no)[^\n]{0,40}(?:another|repeat(?:ed)?)?[^\n]{0,30}(?:activation|invocation)|(?:activation|invocation)[^\n]{0,30}(?:not required|not needed|unnecessary)/i,
      /(?:resume|continue)[^\n]{0,40}(?:same|current)[^\n]{0,30}delivery/i,
      /(?:existing|preserved)[^\n]{0,30}ledger[^\n]{0,50}worktree|ledger[^\n]{0,30}(?:and|with)[^\n]{0,30}worktree[^\n]{0,40}(?:existing|preserved)/i,
      /(?:not|never|does not|doesn't)[^\n]{0,30}(?:start|create|begin)[^\n]{0,30}(?:new|another) delivery/i,
    ];
    if (resumedSignals.some((signal) => !signal.test(output))) {
      throw new Error("auto-develop did not preserve paused-delivery continuity");
    }
    const rejectsNewDelivery = /(?:do not|don't|does not|doesn't|never|will not|won't)[^\n]{0,30}(?:start|create|begin|use)[^\n]{0,30}(?:new|another)[^\n]{0,20}(?:delivery|ledger|worktree)/i;
    const breaksDeliveryContinuity = resumeClauses.some(
      (clause) =>
        !rejectsNewDelivery.test(clause) &&
        /(?:start|create|begin|use)[^\n]{0,30}(?:new|another)[^\n]{0,20}(?:delivery|ledger|worktree)/i.test(clause),
    );
    if (breaksDeliveryContinuity) {
      throw new Error("auto-develop broke paused-delivery continuity");
    }
    return;
  }

  if (caseId === "auto-develop-phase-sync-blocked") {
    const { lines, statusRecords } = autoDevelopReport;
    const phaseEntries = parseTrackingPhaseEntries(
      statusRecords.get("tracking phase synchronization")?.value,
    );
    const preparation = phaseEntries?.get("preparation and isolation");
    const research = phaseEntries?.get("technical research");
    const unsynchronizedDetail = [...(research || [])].find((detail) => detail.startsWith("unsynchronized "));
    const childEntries = parseTrackingPhaseEntries(statusRecords.get("tracking phase children")?.value);
    const phaseEvents = parseTrackingPhaseEventPayloads(lines);
    if (
      phaseEntries?.size !== 2 ||
      [...phaseEntries.keys()].some(
        (phase, index) => phase !== REQUIRED_TRACKING_PHASES[index],
      ) ||
      !preparation?.has("completed") ||
      !preparation.has("backfilled") ||
      !preparation.has("read-back verified") ||
      !research?.has("started and blocked") ||
      !unsynchronizedDetail ||
      !isMeaningfulStatusValue(unsynchronizedDetail.replace(/^unsynchronized\s+/, ""))
    ) {
      throw new Error("auto-develop phase pause omitted its unsynchronized phase failure");
    }
    if (
      phaseEvents?.length !== 3 ||
      phaseEvents.some((event, index) => {
        const expected = [
          { stage: "preparation and isolation", state: "completed", readBack: "verified" },
          { stage: "technical research", state: "started", readBack: "verified" },
          { stage: "technical research", state: "blocked", readBack: "failed" },
        ][index];
        return (
          event.stage !== expected.stage ||
          event.deliveryIdentity !== "delivery-42" ||
          event.state !== expected.state ||
          (expected.readBack === "failed"
            ? !event.readBack.startsWith("failed ")
            : event.readBack !== expected.readBack) ||
          !isMeaningfulStatusValue(event.summary) ||
          !isMeaningfulStatusValue(event.evidence) ||
          !isMeaningfulStatusValue(event.nextStage) ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.eventTime)
        );
      }) ||
      phaseEvents[2].write !== "unsynchronized"
    ) {
      throw new Error("auto-develop phase pause omitted its phase event payloads");
    }
    if (
      childEntries?.size !== 2 ||
      !childEntries.get("independent outcomes")?.has("none") ||
      !childEntries.get("routine stages")?.has("none")
    ) {
      throw new Error("auto-develop phase pause invented phase child work");
    }
    if (
      !/^paused\.?$/i.test(statusRecords.get("risk gate status")?.value || "") ||
      !["blocker", "preserved work", "resume condition"].every(
        (label) => hasMeaningfulStatusValue(statusRecords, label),
      )
    ) {
      throw new Error("auto-develop phase pause omitted its blocker or recovery evidence");
    }
    return;
  }

  if (caseId === "auto-develop") {
    const { decisionTreeIndex, lines, narrativeLines, statusRecords, tableHeaderIndex, tableLines } = autoDevelopReport;
    const authorizationLine = statusRecords.get("authorization")?.line;
    if (!authorizationLine || !/\bcommit\b/i.test(authorizationLine) || !/\bpush\b/i.test(authorizationLine)) {
      throw new Error("auto-develop did not preserve commit and push authorization");
    }
    const completeAuthorization = [
      /worktree/i,
      /branch/i,
      /modif(?:y|ication)|edit/i,
      /commit/i,
      /push/i,
      /draft\s+(?:pull request|pr)/i,
      /bind/i,
      /create/i,
      /tracking|task sync/i,
      /(?:synchroniz(?:e|ation)|sync)[^;\n]{0,40}(?:tracking )?phases?|(?:tracking )?phases?[^;\n]{0,40}(?:synchroniz(?:e|ation)|sync)/i,
    ];
    if (
      completeAuthorization.some((pattern) => !pattern.test(authorizationLine)) ||
      /(?:not authorized|unauthorized|authorization (?:failed|denied)|permission (?:missing|denied))/i.test(authorizationLine)
    ) {
      throw new Error("auto-develop did not preserve the complete task-scoped authorization");
    }
    if (/(?:may i|can i|should i|do you want me to|please authorize|confirm permission)[^\n]{0,100}(?:worktree|branch|modify|edit|commit|push|draft\s+(?:pr|pull request)|bind|tracking|sync(?:hronize)?\s+(?:tracking\s+)?phases?)/i.test(output)) {
      throw new Error("auto-develop asked again for an authorized operation");
    }
    if (!hasExactSourcePriority(statusRecords)) {
      throw new Error("auto-develop did not preserve the complete source branch priority");
    }
    if (selectedBranch(statusRecords) !== "develop") {
      throw new Error("auto-develop did not select develop as the first available source branch");
    }
    if (!hasVerifiedStartingCommit(statusRecords)) {
      throw new Error("auto-develop did not report the exact starting commit");
    }
    const taskBranch = selectedTaskBranch(statusRecords);
    if (!taskBranch || taskBranch === "develop") {
      throw new Error("auto-develop did not preserve a distinct verified task branch");
    }
    if (hasCorePhaseFailureEvidence(narrativeLines, "develop")) {
      throw new Error("auto-develop decision phase evidence contains an unresolved failure");
    }
    if (!hasVerifiedWorktree(statusRecords) || hasWorktreeFailureEvidence(narrativeLines)) {
      throw new Error("auto-develop did not report a verified worktree in ready state");
    }
    if (!hasVerifiedDecisionLedger(statusRecords)) {
      throw new Error("auto-develop did not read back a durable decision ledger");
    }
    if (!hasDecisionLedgerHeader(statusRecords)) {
      throw new Error("auto-develop did not report decision ledger session metadata");
    }
    if (!hasVerifiedDecisionLedgerGitIsolation(statusRecords)) {
      throw new Error("auto-develop did not report verified decision ledger Git isolation");
    }
    if (AUTO_DEVELOP_PAUSE_LABELS.some((label) => statusRecords.has(label))) {
      throw new Error("auto-develop mixed successful and paused delivery states");
    }
    const trackingMatch = statusRecords.get("tracking match")?.value || "";
    if (
      !/^unique candidate at 94\s*%\.?$/i.test(trackingMatch) ||
      !/^automatically bound\.?$/i.test(statusRecords.get("tracking action")?.value || "")
    ) {
      throw new Error("auto-develop did not automatically bind the unique 94% tracking match");
    }
    if (!hasVerifiedTrackingReadBack(statusRecords, "bind") || hasTrackingReadBackFailureEvidence(narrativeLines)) {
      throw new Error("auto-develop did not verify the tracking read-back after binding");
    }
    if (!hasVerifiedTrackingPhaseSynchronization(statusRecords)) {
      throw new Error("auto-develop did not verify complete tracking phase synchronization");
    }
    if (!hasCompleteTrackingPhaseEventPayloads(lines)) {
      throw new Error("auto-develop did not verify complete tracking phase event payloads");
    }
    if (!hasVerifiedHybridPhaseChildren(statusRecords)) {
      throw new Error("auto-develop did not preserve hybrid phase child tracking");
    }
    if (
      !/^Deep review:.*actionable.*recommended/i.test(statusRecords.get("deep review")?.line || "") ||
      !/^applied\.?$/i.test(statusRecords.get("review fix status")?.value || "") ||
      !/^passed after fixes\.?$/i.test(statusRecords.get("validation status")?.value || "") ||
      hasValidationFailureEvidence(narrativeLines) ||
      hasReviewFailureEvidence([
        ...narrativeLines,
        statusRecords.get("deep review")?.line || "",
      ])
    ) {
      throw new Error("auto-develop did not review and fix recommended findings before revalidation");
    }
    if (!/^no actionable recommended findings remain\.?$/i.test(statusRecords.get("re-review status")?.value || "")) {
      throw new Error("auto-develop did not re-review the repaired diff");
    }
    if (
      !hasVerifiedDraftPrReadBack(statusRecords, "develop", taskBranch) ||
      hasDraftPrFailureEvidence(narrativeLines)
    ) {
      throw new Error("auto-develop did not read back the draft PR URL, state, base, and head");
    }
    if (decisionTreeIndex === -1) {
      throw new Error("auto-develop did not include a traceable decision tree");
    }
    const reportSectionIndices = orderedReportSectionIndices(lines, decisionTreeIndex);
    const hasSectionContent = reportSectionIndices && requiredReportSections.every((section, index) => {
      const start = reportSectionIndices.get(section) + 1;
      const nextSection = requiredReportSections[index + 1];
      const end = nextSection ? reportSectionIndices.get(nextSection) : decisionTreeIndex;
      return lines.slice(start, end).some(
        (line) => line && normalizeReportHeading(line) === line && !line.startsWith(String.fromCharCode(96).repeat(3)),
      );
    });
    if (!hasSectionContent) {
      throw new Error("auto-develop did not include the complete execution report sections");
    }
    if (!hasSuccessfulOutcome(lines, reportSectionIndices, decisionTreeIndex)) {
      throw new Error("auto-develop did not report a successful outcome for every acceptance criterion");
    }
    if (!hasVerifiedValidationCommands(lines, reportSectionIndices, decisionTreeIndex)) {
      throw new Error("auto-develop did not include a verified validation command and result");
    }
    const treeLines = lines
      .slice(decisionTreeIndex + 1, tableHeaderIndex === -1 ? lines.length : tableHeaderIndex)
      .filter((line) => line && !/^```/.test(line));
    if (!/^User goal(?:\s*:\s*\S.*)?$/i.test(treeLines[0] || "")) {
      throw new Error("auto-develop decision tree did not include the user goal root");
    }
    const decisionPhases = [
      {
        node: "Source branch",
        sequence: "D-01",
        expectedOutcome: "Base recorded",
      },
      {
        node: "Worktree",
        sequence: "D-02",
        expectedOutcome: "Worktree ready",
      },
      {
        node: "Tracking",
        sequence: "D-03",
        expectedOutcome: "Read-back verified",
      },
      {
        node: "Requirements",
        sequence: "D-04",
        expectedOutcome: "Criteria mapped",
      },
      {
        node: "Implementation",
        sequence: "D-05",
        expectedOutcome: "Behavior implemented",
      },
      {
        node: "Verification",
        sequence: "D-06",
        expectedOutcome: "Passed",
      },
      {
        node: "Review fixes",
        sequence: "D-07",
        expectedOutcome: "Re-review clean",
      },
      {
        node: "Draft PR",
        sequence: "D-08",
        expectedOutcome: "URL and refs verified",
      },
    ];
    if (treeLines.length < decisionPhases.length + 1) {
      throw new Error("auto-develop decision tree omitted or reordered a delivery phase");
    }
    // 允许阶段内追加材料决策，但每个节点必须保持连接、唯一且能与明细表一一对应。
    const decisionEntries = treeLines.slice(1).map((line, index, entries) => {
      const match = line.match(/^(\|-|`-)\s+(D-\d+(?:\.\d+)*)\s+(.+)$/);
      if (!match || (match[1] === "`-") !== (index === entries.length - 1)) {
        throw new Error("auto-develop decision tree contains a malformed or disconnected decision");
      }
      return { connector: match[1], sequence: match[2], node: match[3] };
    });
    if (new Set(decisionEntries.map(({ sequence }) => sequence)).size !== decisionEntries.length) {
      throw new Error("auto-develop decision tree contains a duplicate decision identifier");
    }
    let phaseLineIndex = 0;
    for (const [phaseIndex, { node, sequence }] of decisionPhases.entries()) {
      const connector = phaseIndex === decisionPhases.length - 1 ? String.fromCharCode(96) + "-" : "|-";
      const requiredLine = connector + " " + sequence + " " + node;
      const nextLineIndex = treeLines.indexOf(requiredLine);
      if (nextLineIndex <= phaseLineIndex) {
        throw new Error("auto-develop decision tree omitted or reordered a delivery phase");
      }
      phaseLineIndex = nextLineIndex;
    }
    const headerCells = tableLines.length > 0 ? parseReportTableCells(tableLines[0]) : [];
    const normalizedHeaderCells = headerCells.map((cell) => cell.toLowerCase());
    if (!normalizedHeaderCells.includes("created at")) {
      throw new Error("auto-develop did not preserve decision creation time");
    }
    if (!["recommendation", "selection"].every((header) => normalizedHeaderCells.includes(header))) {
      throw new Error("auto-develop did not preserve decision recommendation and selection fields");
    }
    const requiredHeaders = [
      "node",
      "created at",
      "trigger",
      "evidence",
      "options",
      "recommendation",
      "selection",
      "reason",
      "risk",
      "reversibility",
      "user involvement",
      "outcome",
    ];
    if (requiredHeaders.some((header) => !normalizedHeaderCells.includes(header))) {
      throw new Error("auto-develop did not preserve decision evidence and reversibility fields");
    }
    const detailRows = tableLines.slice(1).map(parseReportTableCells);
    const populatedDetailRows = detailRows.filter(
      (cells) => !cells.every((cell) => !cell || /^-+$/.test(cell)),
    );
    const createdAtIndex = normalizedHeaderCells.indexOf("created at");
    const optionsIndex = normalizedHeaderCells.indexOf("options");
    const recommendationIndex = normalizedHeaderCells.indexOf("recommendation");
    const selectionIndex = normalizedHeaderCells.indexOf("selection");
    const outcomeIndex = headerCells.findIndex((cell) => cell.toLowerCase() === "outcome");

    // 每行都必须保留决策时点和可回溯到同一候选项的推荐、选择。
    for (const row of populatedDetailRows) {
      const createdAt = row[createdAtIndex] || "";
      if (!RFC3339_TIMESTAMP.test(createdAt) || Number.isNaN(Date.parse(createdAt))) {
        throw new Error("auto-develop decision contains an invalid creation time");
      }

      const parsedOptions = parseNumberedDecisionOptions(row[optionsIndex] || "");
      if (parsedOptions.error === "numbering") {
        throw new Error("auto-develop decision options were not consecutively numbered");
      }
      if (parsedOptions.error === "explanation") {
        throw new Error("auto-develop decision options did not include a meaningful explanation");
      }
      const recommendedOptions = parsedOptions.options.filter(({ recommended }) => recommended);
      if (recommendedOptions.length !== 1) {
        throw new Error("auto-develop decision options did not mark exactly one recommended option");
      }

      const recommendation = parseDecisionOptionReference(row[recommendationIndex] || "");
      const markedOption = recommendedOptions[0];
      if (
        !recommendation ||
        recommendation.number !== markedOption.number ||
        recommendation.label !== markedOption.label
      ) {
        throw new Error("auto-develop decision recommendation did not identify the marked recommended option");
      }

      const selection = parseDecisionOptionReference(row[selectionIndex] || "");
      const selectedOption = selection && parsedOptions.options.find(
        ({ number }) => number === selection.number,
      );
      if (!selectedOption || selection.label !== selectedOption.label) {
        throw new Error("auto-develop decision selection did not identify a numbered selected option");
      }
    }

    let previousDecisionRowIndex = -1;
    for (const { node, expectedOutcome } of decisionPhases) {
      const matchingRowIndices = detailRows
        .map((cells, index) => ({ cells, index }))
        .filter(({ cells }) => (cells[0] || "").toLowerCase() === node.toLowerCase());
      const row = matchingRowIndices[0]?.cells;
      const rowIndex = matchingRowIndices[0]?.index ?? -1;
      if (
        matchingRowIndices.length !== 1 ||
        rowIndex <= previousDecisionRowIndex ||
        !row ||
        row.length !== headerCells.length ||
        row.some((cell) => !cell)
      ) {
        throw new Error("auto-develop did not include decision details for every delivery phase");
      }
      previousDecisionRowIndex = rowIndex;
      const outcome = row[outcomeIndex] || "";
      if (outcome.replace(/\.$/, "").trim() !== expectedOutcome) {
        throw new Error("auto-develop did not include a successful outcome for every delivery phase");
      }
    }
    if (populatedDetailRows.length !== decisionEntries.length) {
      throw new Error("auto-develop did not reconcile every ledger decision with the report table");
    }
    for (const { node } of decisionEntries) {
      const matchingRows = populatedDetailRows.filter(
        (cells) => (cells[0] || "").toLowerCase() === node.toLowerCase(),
      );
      if (
        matchingRows.length !== 1 ||
        matchingRows[0].length !== headerCells.length ||
        matchingRows[0].some((cell) => !cell)
      ) {
        throw new Error("auto-develop did not include complete decision details for every ledger entry");
      }
    }
    const routineWorkspaceRequest = /(?:please\s+)?(?:choose|select)\s+(?:a\s+)?(?:workspace|worktree)(?:\s+strategy)?/i.test(output) || /请选择[^\n]*(?:工作区|工作树)/.test(output);
    const routineValidationRequest = /(?:please\s+)?(?:choose|select)\s+(?:a\s+)?(?:validation|test)\s+(?:scope|strategy)/i.test(output) || /请选择[^\n]*(?:验证|验收)[^\n]*(?:范围|策略)/.test(output);
    if (routineWorkspaceRequest || routineValidationRequest) {
      throw new Error("auto-develop asked for routine workspace or validation selection");
    }
    if (/\$auto-develop[^\n]{0,80}(?:clean|cleanup|清理)|(?:use|invoke|调用)[^\n]{0,40}auto-develop[^\n]{0,80}(?:clean|cleanup|清理)/i.test(output)) {
      throw new Error("auto-develop incorrectly routed cleanup through auto-develop");
    }
    if (!/(?:cleanup|清理).{0,40}(?:outside|separate|不属于|另行)/is.test(output)) {
      throw new Error("auto-develop did not keep cleanup outside this Skill");
    }
    if (hasForbiddenMergeOrCleanupClaim(output)) {
      throw new Error("auto-develop must not merge or clean the task worktree and branch");
    }
    if (lines.filter(Boolean).at(-1) !== "PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。") {
      throw new Error("auto-develop did not include the ordinary post-merge cleanup reminder");
    }
    return;
  }

  if (caseId === "auto-develop-create") {
    const { narrativeLines, statusRecords } = autoDevelopReport;
    if (
      !hasExactSourcePriority(statusRecords) ||
      selectedBranch(statusRecords) !== "main" ||
      !hasVerifiedWorktree(statusRecords) ||
      hasWorktreeFailureEvidence(narrativeLines) ||
      !/^none\.?$/i.test(statusRecords.get("tracking match")?.value || "") ||
      !/^93\s*%\.?$/i.test(statusRecords.get("tracking creation readiness")?.value || "") ||
      !/^automatically created and bound\.?$/i.test(statusRecords.get("tracking action")?.value || "") ||
      AUTO_DEVELOP_PAUSE_LABELS.some((label) => statusRecords.has(label))
    ) {
      throw new Error("auto-develop did not fall back to main and automatically create and bind the 93% ready item");
    }
    if (!hasVerifiedTrackingReadBack(statusRecords, "create") || hasTrackingReadBackFailureEvidence(narrativeLines)) {
      throw new Error("auto-develop did not verify the tracking read-back after creation and binding");
    }
    return;
  }

  if (caseId === "auto-develop-risk") {
    const { semanticLines, statusRecords } = autoDevelopReport;
    const trackingMatch = statusRecords.get("tracking match")?.value || "";
    const trackingCandidates = trackingMatch
      .replace(/\.$/, "")
      .split(";")
      .map((candidate) => candidate.trim())
      .map((candidate) => {
        const match = candidate.match(/^(.+?)\s+(\d{1,3})\s*%$/);
        return match
          ? { identity: match[1].trim().toLowerCase(), score: Number(match[2]) }
          : undefined;
      });
    const trackingScores = trackingCandidates
      .filter(Boolean)
      .map(({ score }) => score)
      .sort((left, right) => left - right);
    const candidateIdentities = new Set(
      trackingCandidates.filter(Boolean).map(({ identity }) => identity),
    );
    const requiredPauseValues = ["verified facts", "blocker", "recommendation", "alternatives", "consequences"];
    if (requiredPauseValues.some((label) => !hasMeaningfulStatusValue(statusRecords, label))) {
      throw new Error("auto-develop risk pause requires non-placeholder pause evidence");
    }
    if (
      trackingCandidates.length !== 2 ||
      trackingCandidates.some((candidate) => !candidate || !isMeaningfulStatusValue(candidate.identity)) ||
      candidateIdentities.size !== 2 ||
      trackingScores.length !== 2 ||
      trackingScores[0] !== 92 ||
      trackingScores[1] !== 94 ||
      !/^none\.?$/i.test(statusRecords.get("tracking write")?.value || "") ||
      !/^paused\.?$/i.test(statusRecords.get("risk gate status")?.value || "")
    ) {
      throw new Error("auto-develop did not pause safely without a tracking write and explain the conflicting high-confidence matches");
    }
    const downstreamSuccessLabels = [
      "tracking read-back",
      "deep review",
      "review fix status",
      "re-review status",
      "validation status",
      "draft pr read-back",
    ];
    if (
      statusRecords.has("tracking action") ||
      downstreamSuccessLabels.some((label) => statusRecords.has(label)) ||
      hasTrackingSuccessEvidence(semanticLines) ||
      /(?:write occurred|item (?:was )?created|automatically bound)/i.test(output) ||
      /PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。/.test(output)
    ) {
      throw new Error("auto-develop did not pause safely without a tracking write");
    }
    return;
  }

  if (caseId === "auto-develop-blocked") {
    const { semanticLines, statusRecords } = autoDevelopReport;
    const corePauseLabels = [
      "external dependency blocker",
      "verified facts",
      "preserved work",
      "resume condition",
    ];
    const decisionPauseLabels = [
      "recommendation",
      "alternatives",
      "consequences",
    ];
    if (statusRecords.has("draft pr read-back") || hasDraftPrSuccessEvidence(semanticLines)) {
      throw new Error("auto-develop blocked path must not report draft PR success");
    }
    if (
      !/^exhausted\.?$/i.test(statusRecords.get("safe alternatives")?.value || "") ||
      !/^paused\.?$/i.test(statusRecords.get("risk gate status")?.value || "") ||
      corePauseLabels.some((label) => !statusRecords.has(label)) ||
      /safe alternatives:\s*not exhausted/i.test(output) ||
      /PR 合并后，可以让我清理本地开发工作树和任务分支，以释放资源。/.test(output)
    ) {
      throw new Error("auto-develop did not preserve work at an exhausted external-dependency blocker");
    }
    if (decisionPauseLabels.some((label) => !statusRecords.has(label))) {
      throw new Error("auto-develop external-dependency pause omitted its recommendation, alternatives, and consequences");
    }
    if ([...corePauseLabels, ...decisionPauseLabels].some((label) => !hasMeaningfulStatusValue(statusRecords, label))) {
      throw new Error("auto-develop external-dependency pause requires non-empty pause evidence and non-placeholder pause evidence");
    }
    if (!/(?:work|worktree)/i.test(statusRecords.get("preserved work")?.value || "")) {
      throw new Error("auto-develop did not preserve work at an exhausted external-dependency blocker");
    }
    return;
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
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(finalLine) ||
      /workitems\/parent-done/.test(output)
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

  if (caseId === "tapd-sync-phase-recorded") {
    const finalLine = output.trimEnd().split(/\r?\n/).at(-1) || "";
    if (
      !/^>?\s*TAPD:\s/.test(finalLine) ||
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(finalLine) ||
      !/(?:technical research|技术调研)/i.test(output) ||
      !/(?:read-back|回读|读取验证)/i.test(output)
    ) {
      throw new Error("tapd-sync did not report the verified parent phase update");
    }
    return;
  }

  if (caseId === "tapd-sync-query-default") {
    if (
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(output) ||
      /workitems\/parent-done/.test(output) ||
      !/(?:非终态.{0,24}(?:范围|工作项)|(?:范围|工作项).{0,24}非终态|non[- ]?terminal.{0,24}(?:scope|items?))/i.test(output)
    ) {
      throw new Error("tapd-sync did not default an all-items query to nonterminal results and report that scope");
    }
    return;
  }

  if (caseId === "tapd-sync-query-inclusive") {
    if (
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(output) ||
      !/\[【Trigger Evaluation Repository】Improve README agent documentation \(completed\)\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent-done\)/.test(output)
    ) {
      throw new Error("tapd-sync did not include terminal results after an explicit scope request");
    }
    return;
  }

  if (caseId === "tapd-sync-query-inclusive-incomplete") {
    const completeCoverageClaim =
      /\b(?:all|every)\b.{0,50}\b(?:returned|included)\b|(?:全部|所有).{0,40}(?:已返回|均已返回|已包含)|(?:(?:query|search|terminal(?:-inclusive)?)\s+)?(?:results?|coverage)\s+(?:is|are)\s+complete\b|(?:查询|检索|终态)?(?:结果|覆盖)(?:为|是)?(?:完整|全量)/i;
    const negatedOrPartial =
      /\b(?:not|cannot|can't|unable|incomplete|partial)\b|(?:无法|不能|未能|并非|不是|不完整|部分)/i;
    const claimsCompleteCoverage = output
      .split(/\r?\n|[。；;]|,\s*(?:but|however)\s+|(?:，|,)?\s*(?:但|但是|不过|然而)\s*/i)
      .some((clause) => !negatedOrPartial.test(clause) && completeCoverageClaim.test(clause));
    if (
      !/\[【Trigger Evaluation Repository】Improve README agent documentation\]\(https:\/\/tapd\.example\.invalid\/workitems\/parent\)/.test(output) ||
      /workitems\/parent-done/.test(output) ||
      claimsCompleteCoverage ||
      !/(?:无法|不能|未能|不完整|受限|incomplete|cannot|unable|limitation).{0,40}(?:终态|terminal)|(?:终态|terminal).{0,40}(?:无法|不能|未能|不完整|受限|incomplete|cannot|unable|limitation)/i.test(output)
    ) {
      throw new Error("tapd-sync did not report incomplete terminal coverage without claiming complete results");
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
      !/【Trigger Evaluation Repository】Improve README agent documentation(?! \(completed\))/.test(output) ||
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

export const assertAutoDevelopNotTriggered = (output, activationMarker) => {
  if (output.includes(`SKILL_ACTIVATED: ${activationMarker}`)) {
    throw new Error("ordinary automatic development request unexpectedly activated auto-develop");
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

const assertTapdOnlyCommand = (command, { allowPhaseWrite = false } = {}) => {
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
    if (allowPhaseWrite && /^work-items\s+activity\s+append(?:\s|$)/.test(args)) {
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

const isCompletePhaseEventPayload = (event, expectedState) => Boolean(
  event &&
  /^[a-z0-9][a-z0-9._-]*$/i.test(event.event_id || "") &&
  event.delivery_id === "delivery-42" &&
  event.stage === "technical research" &&
  event.state === expectedState &&
  isMeaningfulStatusValue(event.summary) &&
  isMeaningfulStatusValue(event.evidence) &&
  isMeaningfulStatusValue(event.next_stage) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.event_time || "")
);

export const assertTapdPhaseWriteActivity = (stdout) => {
  const operations = [];
  const commands = [];
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
    assertTapdOnlyCommand(command, { allowPhaseWrite: true });
    commands.push(command);
    const commandOutput = [event.item.aggregated_output, event.item.output]
      .filter((value) => value !== undefined)
      .join("\n");
    for (const line of commandOutput.split(/\r?\n/).filter(Boolean)) {
      try {
        const operation = JSON.parse(line);
        if (operation.fixture_operation) operations.push(operation);
      } catch {
        // Non-JSON CLI help text is irrelevant to phase mutation verification.
      }
    }
  }

  if (commands.length === 0) throw new Error("Codex did not inspect or update the TAPD phase");
  const appendOperations = operations.filter(
    ({ fixture_operation: operation }) => operation === "work-items-activity-appended",
  );
  if (appendOperations.length !== 1) {
    throw new Error("Codex did not append exactly one TAPD completion phase event");
  }
  const appendedOperation = appendOperations[0];
  const appendIndex = operations.indexOf(appendedOperation);
  const appendedEvent = appendedOperation.phase_event;
  if (!isCompletePhaseEventPayload(appendedEvent, "completed")) {
    throw new Error("Codex appended an incomplete TAPD phase event payload");
  }
  if (
    appendedEvent.event_id !== "delivery-42-03" ||
    appendedEvent.summary !== "research complete" ||
    appendedEvent.evidence !== "decision ledger D-03" ||
    appendedEvent.next_stage !== "solution design" ||
    appendedEvent.event_time !== "2026-08-19T09:02:00+08:00"
  ) {
    throw new Error("Codex appended the wrong TAPD completion phase event");
  }
  const historiesBefore = operations.slice(0, appendIndex).filter(
    ({ fixture_operation: operation }) => operation === "work-items-history-parent-1",
  );
  const recoveredStartedEvent = historiesBefore.some(({ phase_events: events }) =>
    events?.some((phaseEvent) =>
      phaseEvent.event_id === "delivery-42-02" &&
      phaseEvent.summary === "research started" &&
      phaseEvent.evidence === "decision ledger D-02" &&
      phaseEvent.next_stage === "technical research" &&
      phaseEvent.event_time === "2026-08-19T09:01:00+08:00" &&
      isCompletePhaseEventPayload(phaseEvent, "started"),
    ),
  );
  if (!recoveredStartedEvent) {
    throw new Error("Codex did not recover the ambiguous TAPD phase event before writing");
  }
  const historiesAfter = operations.slice(appendIndex + 1).filter(
    ({ fixture_operation: operation }) => operation === "work-items-history-parent-1",
  );
  const verifiedCompletion = historiesAfter.some(({ phase_events: events }) =>
    events?.some((phaseEvent) =>
      phaseEvent.event_id === appendedEvent.event_id &&
      JSON.stringify(phaseEvent) === JSON.stringify(appendedEvent),
    ),
  );
  if (!verifiedCompletion) {
    throw new Error("Codex did not read back the exact TAPD phase event payload");
  }
  if (operations.some(({ fixture_operation: operation, event_id: eventId }) =>
    operation === "work-items-activity-reused" && eventId === "delivery-42-02"
  )) {
    throw new Error("Codex retried a TAPD phase event already present in history");
  }
  return commands;
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
      if (triggerCase.fakeTapdScenario) {
        await writeFile(path.join(fakeBin, triggerCase.fakeTapdScenario), "");
      }
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
      const { args, shouldCaptureThreadId } = buildCodexTurnArgs({
        turns,
        turnIndex,
        threadId,
        workdir: tempRoot,
        outputPath,
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
        } else if (turn.toolPolicy === "tapd-phase-write") {
          assertTapdPhaseWriteActivity(result.stdout);
        } else {
          assertNoToolActivity(result.stdout);
        }
        const output = await resolveCodexOutput({ outputPath, stdout: result.stdout });
        const negativeAssertions = {
          "auto-develop": assertAutoDevelopNotTriggered,
          "tapd-summary": assertSummaryNotTriggered,
        };
        const negativeAssertion = turn.negativeAssertion || triggerCase.negativeAssertion;
        if (negativeAssertion) {
          const assertNegative = negativeAssertions[negativeAssertion];
          if (!assertNegative) throw new Error(`Unknown negative assertion: ${negativeAssertion}`);
          assertNegative(output, triggerCase.evalName);
        } else {
          assertTriggerBehavior(turn.behavior, output, triggerCase.evalName);
        }
        if (shouldCaptureThreadId) {
          threadId = resolveThreadId(result.stdout);
        }
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

    return { skill: triggerCase.id, mode: triggerCase.mode || "implicit" };
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
