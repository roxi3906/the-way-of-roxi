---
name: os-isolate-dev
description: Apply task environment isolation and launch-script rules only when the actual target project name exactly matches open-science (case-sensitive). Ask once per task whether to enable isolated configuration before proceeding. Covers development, local launch scripts, Python and micromamba preparation, and verification. Do not apply to open-science-usecases, aipoch-web, similarly named projects, generic environment questions, or requests to author, translate, or discuss this skill itself.
---

# Open Science Isolated Development

Keep environment preparation separate from everyday application startup. Apply the following rules only after the project gate passes.

Use the same project gate and workflow in every host runtime. Accept host-supported explicit invocation without requiring a product-specific invocation prefix; automatic selection must also satisfy the project gate.

## Exact Project Gate

- Resolve the actual target project's repository name from trusted task context or local repository identity. A linked worktree belongs to its underlying repository even when its directory has a different name. When using a Git remote, extract the repository name and remove only the transport suffix `.git`.
- Require case-sensitive equality with `open-science`. Do not use substring, prefix, fuzzy, case-insensitive, or display-name matching. `open-science-usecases`, `my-open-science`, `open-science-web`, `Open-Science`, `Open Science`, and `aipoch-web` do not match.
- A mention of `open-science` in documentation, quoted instructions, a dependency, or a neighboring directory does not establish the target project. Authoring or translating this skill in another repository does not activate its environment workflow.
- If the identity is unknown or conflicting, establish the actual target before applying this workflow. For a nonmatching project, skip this skill, including its isolation question and environment changes. Explicitly naming the skill does not bypass the project restriction.

## Establish the Task Choice

- Before executing a matching project task, ask whether to enable isolated configuration and wait for an explicit answer. Do not interpret silence as consent.
- Reuse a choice already confirmed for this same task; do not ask again on continuation, testing, or delivery. Do not inherit another task's choice.
- If isolation is declined, use the existing configuration. Do not create an isolated configuration or silently switch to one. Keep the preparation/startup separation and truthful verification rules below.

## Prepare an Isolated Environment

When isolation is enabled:

- Put configuration, application data, temporary files, logs, and newly created runtime environments under the current worktree's Git-ignored `.dev-isolate/<task-name>/`. Verify that Git ignores the directory before writing task data. Keep task configuration, logs, and test data out of commits.
- Use absolute paths. Resolve symlinks and verify that task-owned data destinations remain inside this task directory. Do not modify shared Python environments or contaminate existing development environments or production data.
- Cover paths actually used by the application and its child processes, including `OPEN_SCIENCE_USER_DATA`, `OPEN_SCIENCE_CONFIG_ROOT`, `OPEN_SCIENCE_INSTALLATION_STATE_ROOT`, `TMPDIR`, `TMP`, and `TEMP`. Verify that the effective application `dataRoot` is also inside the task directory; checking environment variables alone is insufficient.
- Account for configuration-root precedence: `OPEN_SCIENCE_E2E_STORAGE_ROOT` takes priority over `OPEN_SCIENCE_CONFIG_ROOT`, which takes priority over `OPEN_SCIENCE_STORAGE_ROOT` in non-packaged mode only. Unset or explicitly override conflicting inherited values so startup cannot use shared or another task's configuration.
- Set `OPEN_SCIENCE_ALLOW_MULTI_INSTANCE=1` for parallel development instances. Configure `OPEN_SCIENCE_WEB_PORT` and `OPEN_SCIENCE_BROWSER_IMPORT_DISCOVERY_PORT` when needed. Check ports separately during preparation or verification; update callers when changing the discovery port. A port conflict that disables a required function is not successful startup.
- If macOS Unix socket path-length limits require a short path alias, create it during preparation, point it to the task's temporary directory, and verify its resolved target. The launch script may use this prepared alias but must not create or repair it.

## Prepare Python and micromamba Separately

- Prefer an existing local Python interpreter. During preparation, confirm it is executable. When isolation is enabled, register and enable it in the task's isolated application settings; when isolation is declined, use the interpreter registered and enabled in the existing application settings. Never modify a shared Python environment.
- Distinguish application settings, launch variables, and test variables. `OPEN_SCIENCE_TEST_PYTHON` and `OPEN_SCIENCE_TEST_PY_ENV` are test-only and do not select the application's interpreter. Changing `PATH` does not change an existing Notebook's interpreter binding.
- Inspect the application's actual supported interfaces before describing a variable as a launch option. If no launch variable selects the interpreter, explain the limitation and use the interpreter registered in the selected application settings (isolated or existing, according to the task's confirmed choice). Do not make a variable appear supported by silently writing settings in the launch script.
- Configure and verify Python and micromamba independently; neither substitutes for the other. When delivering a development launch script, or running the application, initialization, repair, recovery, or E2E involving Notebooks, explicitly set `OPEN_SCIENCE_MICROMAMBA_BIN` to a verified executable absolute path.
- An existing micromamba binary may be reused. With isolation enabled, its newly created environments, caches, and temporary data must stay inside the task directory. Verify the actual storage locations rather than assuming the binary's location determines them.
- If micromamba is missing or not executable, report the exact missing prerequisite during preparation. Do not silently fall back to shared configuration or add automatic installation or repair to the launch script.

## Deliver a Simple Launch Script

- Provide a directly executable launch script. Group the task environment directory, interpreter path, micromamba path, ports, and other launch configuration at the top. The user should only need to execute the script, without manually prefixing environment variables or running multiple preparation stages.
- The script may only declare paths and parameters, set environment variables, change the working directory, and invoke the project's existing startup command. Prefer a simple, readable script without extra wrappers or orchestration layers.
- The script must not install, download, upgrade, or repair dependencies; create Python or micromamba environments; generate, modify, or migrate application configuration; register interpreters; or run dependency probes, self-checks, port checks, tests, or E2E. Perform needed preparation and verification separately as the agent. This restriction concerns script-added preparation, not normal behavior of the project's existing startup command.
- Do not make a self-check a prerequisite for everyday startup. If needed, provide a separate self-check or E2E entrypoint and explain its purpose; normal application startup must not require it.
- Use consistent paths and interpreter configuration for later development, testing, and E2E, preserving the task's selected isolated or existing configuration. A test entrypoint may reuse launch parameters, but normal startup must not implicitly run tests or modify configuration.
- For a local launch-script-only request, keep the changes focused. Do not redesign application configuration, change business code, or commit task-specific configuration, logs, or test data unless explicitly requested.

## Verify and Report Precisely

- During preparation or a separate self-check, verify actual storage paths, the Python interpreter registered and enabled in the application, and, where applicable, micromamba's path and executability. Variable assignments or file existence alone are not sufficient evidence. Never print credentials.
- For launch-script changes, verify shell syntax, the actual command and environment passed to startup, and the absence of unintended configuration writes or dependency handling. A substitute startup command can capture arguments and environment safely; a simple script change does not require launching the entire application. Avoid dumping unrelated environment variables or secrets.
- Keep these conclusions separate: **script and argument validation passed**, **isolation self-check passed**, **application started successfully**, and **target functionality verified**. Evidence for an earlier conclusion does not establish a later one.
- When delivering a runnable environment, actually verify the task's functional path as well as launching the application. Notebook initialization or repair tasks must exercise the corresponding operation. For launch-parameter-only or purely static edits, relevant checks are sufficient, but do not claim that Notebooks or the full application environment work.
- At handoff, give the direct command to execute the script, the configuration location, what was verified, unverified paths, and concrete missing prerequisites. Do not ask the user to repeat environment preparation already completed by the agent.
