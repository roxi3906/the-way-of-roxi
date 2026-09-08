import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderExecutionReport } from './render-execution-report.mjs';

const serviceName = 'auto-develop-report';
const digest = value => createHash('sha256').update(value).digest('hex');

async function readState(statePath) {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  if (state.service !== serviceName || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(state.url) || typeof state.token !== 'string' || !/^[\da-f-]{36}$/.test(state.token)) throw new Error('Invalid report service state');
  return state;
}

export async function controlReportService(action, statePath) {
  if (!['status', 'stop'].includes(action) || !path.isAbsolute(statePath)) throw new Error('Use status or stop with an absolute --state path');
  const state = await readState(statePath);
  const response = await fetch(`${state.url}${action}`, {
    method: action === 'stop' ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${state.token}` },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw new Error(`Report service ${action} failed: HTTP ${response.status}`);
  const result = await response.json();
  if (result.service !== serviceName || result.instance !== state.instance) throw new Error('Report service identity mismatch');
  return result;
}

export async function startReportService({ ledgerPath, reportPath, outputPath, statePath, port = 0, interval = 500 }) {
  const files = { ledgerPath, reportPath, outputPath, statePath };
  for (const value of Object.values(files)) if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error('All four absolute file paths are required');
  if (!outputPath.endsWith('.html') || !statePath.endsWith('.json')) throw new Error('Use a separate .html output and .json state');
  for (const [key, value] of Object.entries(files)) {
    try { files[key] = await realpath(value); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      files[key] = path.join(await realpath(path.dirname(value)), path.basename(value));
    }
  }
  if (new Set(Object.values(files)).size !== 4) throw new Error('Inputs, output, and state must be separate files');
  if (new Set(Object.values(files).map(value => path.dirname(value))).size !== 1) throw new Error('Keep report service files in the same private directory');
  ({ ledgerPath, reportPath, outputPath, statePath } = files);
  if (!Number.isInteger(port) || port < 0 || port > 65535 || !Number.isFinite(interval) || interval < 25) throw new Error('Invalid port or refresh interval');
  let existing;
  try { existing = await readState(statePath); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (existing) {
    if (Object.entries(files).some(([key, value]) => existing[key] !== value)) throw new Error('State belongs to a different report');
    try { return { receipt: { ...await controlReportService('status', statePath), reused: true } }; }
    catch { throw new Error('Existing report state is unreachable; verify its process and remove only the stale state file before restarting'); }
  }

  let current;
  let sourceHash;
  let errorMessage = '';
  let busy = false;
  let closing = false;
  let closePromise;
  let timer;
  let heartbeat;
  const clients = new Set();
  const token = randomUUID();
  const instance = randomUUID();
  const event = () => `data: ${JSON.stringify({ revision: current.revision, error: errorMessage })}\n\n`;
  const broadcast = () => { for (const client of clients) client.write(event()); };
  const status = () => ({ service: serviceName, instance, pid: process.pid, url: receipt.url, ...files, revision: current.revision, updatedAt: current.updatedAt, error: errorMessage });

  async function refresh() {
    if (busy || closing) return;
    busy = true;
    let temporary;
    try {
      const [ledgerRaw, reportRaw] = await Promise.all([readFile(ledgerPath, 'utf8'), readFile(reportPath, 'utf8')]);
      const nextHash = digest(JSON.stringify([ledgerRaw, reportRaw]));
      if (nextHash === sourceHash) {
        if (errorMessage) { errorMessage = ''; broadcast(); }
        return;
      }
      const ledger = JSON.parse(ledgerRaw);
      const report = JSON.parse(reportRaw);
      if (typeof ledger.task?.ledgerPath !== 'string' || !path.isAbsolute(ledger.task.ledgerPath) || await realpath(ledger.task.ledgerPath) !== ledgerPath) throw new Error('Decision ledger path does not match the service input');
      const snapshot = renderExecutionReport(ledger, report);
      const revision = digest(snapshot);
      const liveHtml = renderExecutionReport(ledger, report, { live: true }).replace('</head>', `<meta name="report-revision" content="${revision}"></head>`);
      temporary = `${outputPath}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await rename(temporary, outputPath);
      current = { revision, liveHtml, ledgerRaw, updatedAt: new Date().toISOString() };
      sourceHash = nextHash;
      errorMessage = '';
      broadcast();
    } catch (error) {
      if (!current) throw error;
      if (errorMessage !== error.message) { errorMessage = error.message; broadcast(); }
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      busy = false;
    }
  }

  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    const allowedHosts = [`127.0.0.1:${server.address()?.port}`, `localhost:${server.address()?.port}`];
    if (!allowedHosts.includes(request.headers.host)) { response.writeHead(403).end(); return; }
    const route = request.url;
    const json = (code, value) => { response.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(value)); };
    if (route === '/status' || route === '/stop') {
      if (request.headers.authorization !== `Bearer ${token}` || request.headers.origin) { json(403, { error: 'Forbidden' }); return; }
      if (request.method !== (route === '/stop' ? 'POST' : 'GET')) { json(405, { error: 'Method not allowed' }); return; }
      json(200, route === '/stop' ? { service: serviceName, instance, stopping: true } : status());
      if (route === '/stop') void close();
      return;
    }
    if (request.method !== 'GET') { response.writeHead(405).end(); return; }
    if (route === '/') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(current.liveHtml); return; }
    if (route === '/decision-tree.json') { response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(current.ledgerRaw); return; }
    if (route === '/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive' });
      response.write(event());
      clients.add(response);
      response.on('close', () => clients.delete(response));
      return;
    }
    response.writeHead(404).end();
  });

  function close() {
    if (closePromise) return closePromise;
    closing = true;
    clearInterval(timer);
    clearInterval(heartbeat);
    for (const client of clients) client.end();
    closePromise = (async () => {
      const forceClose = setTimeout(() => server.closeAllConnections(), 1000);
      await new Promise(resolve => server.close(resolve));
      clearTimeout(forceClose);
      while (busy) await new Promise(resolve => setTimeout(resolve, 10));
      try { if ((await readState(statePath)).instance === instance) await unlink(statePath); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    })();
    return closePromise;
  }

  // Validate before listening; polling only replaces the snapshot after a complete valid render.
  await refresh();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const receipt = { service: serviceName, instance, pid: process.pid, url: `http://127.0.0.1:${server.address().port}/`, ...files };
  try { await writeFile(statePath, JSON.stringify({ ...receipt, token }, null, 2), { mode: 0o600, flag: 'wx' }); }
  catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
  timer = setInterval(() => { void refresh(); }, interval);
  heartbeat = setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
  return { receipt, close };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const flags = new Map();
  const allowed = command === 'start' ? ['--ledger', '--report', '--output', '--state', '--port'] : ['--state'];
  for (let index = 0; index < args.length; index += 2) {
    if (!allowed.includes(args[index]) || !args[index + 1] || flags.has(args[index])) throw new Error('Invalid report service arguments');
    flags.set(args[index], args[index + 1]);
  }
  if (command === 'status' || command === 'stop') {
    process.stdout.write(`${JSON.stringify(await controlReportService(command, flags.get('--state')))}\n`);
    return;
  }
  if (command !== 'start') throw new Error('Use start, status, or stop');
  const service = await startReportService({ ledgerPath: flags.get('--ledger'), reportPath: flags.get('--report'), outputPath: flags.get('--output'), statePath: flags.get('--state'), port: flags.has('--port') ? Number(flags.get('--port')) : 0 });
  process.stdout.write(`${JSON.stringify(service.receipt)}\n`);
  if (service.close) {
    const stop = () => { service.close().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
