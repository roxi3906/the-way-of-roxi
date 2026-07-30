import { spawn } from "node:child_process";

export const runProcessWithClosedStdin = ({
  file,
  args,
  cwd,
  env,
  signal,
  timeoutMs,
  killGraceMs = 2_000,
  maxBuffer = 64 * 1024 * 1024,
}) =>
  new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(file, args, {
      cwd,
      env,
      detached,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    let failureReason = null;
    let killTimer = null;
    let forceRejectTimer = null;

    const signalProcessTree = (signal) => {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    };

    const terminate = (reason) => {
      if (failureReason) return;
      failureReason = reason;
      signalProcessTree("SIGTERM");
      killTimer = setTimeout(() => signalProcessTree("SIGKILL"), killGraceMs);
      forceRejectTimer = setTimeout(() => {
        finish(() => {
          const error = new Error(`${file} ${failureReason}`);
          error.stdout = stdout;
          error.stderr = stderr;
          reject(error);
        });
      }, killGraceMs + 1_000);
    };

    const timeoutTimer = timeoutMs
      ? setTimeout(() => terminate(`timed out after ${timeoutMs}ms`), timeoutMs)
      : null;
    const abortListener = () => terminate("was aborted");
    if (signal?.aborted) abortListener();
    else signal?.addEventListener("abort", abortListener, { once: true });

    function finish(callback) {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (forceRejectTimer) clearTimeout(forceRejectTimer);
      signal?.removeEventListener("abort", abortListener);
      callback();
    }

    const collect = (streamName) => (chunk) => {
      if (failureReason) return;
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > maxBuffer) {
        terminate(`exceeded the ${maxBuffer}-byte output limit`);
        return;
      }
      if (streamName === "stdout") stdout += chunk;
      else stderr += chunk;
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));
    child.stdin.on("error", (error) => {
      if (error?.code !== "EPIPE" && !failureReason) finish(() => reject(error));
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => {
      if (code === 0 && !failureReason) {
        finish(() => resolve({ stdout, stderr }));
        return;
      }

      const reason =
        failureReason || `exited with code ${code}${signal ? ` (signal ${signal})` : ""}`;
      const error = new Error(`${file} ${reason}`);
      error.stdout = stdout;
      error.stderr = stderr;
      finish(() => reject(error));
    });

    child.stdin.end();
  });
