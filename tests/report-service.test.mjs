import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { startReportService, controlReportService } from '../skills/auto-develop/scripts/serve-execution-report.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'report-service-'));
  const files = { ledgerPath: path.join(root, 'task-decision-tree.json'), reportPath: path.join(root, 'task-report.json'), outputPath: path.join(root, 'task-report.html'), statePath: path.join(root, 'task-service.json') };
  const ledger = { schemaVersion: 1, session: { id: 'live-test', name: 'Live report', language: 'en' }, task: { summary: 'Live task', ledgerPath: files.ledgerPath }, decisions: [] };
  const report = { status: 'running', summary: 'Initial result', startedAt: '', endedAt: '', context: [], stages: [], reviews: [], reviewSummary: 'Not reviewed', verification: [], records: [] };
  await writeFile(files.ledgerPath, JSON.stringify(ledger));
  await writeFile(files.reportPath, JSON.stringify(report));
  return { root, files, ledger, report };
}

async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for report update');
}

test('live service updates atomically, retains last valid HTML on errors, and closes only with its own token', async () => {
  const { root, files, report, ledger } = await fixture();
  let service;
  try {
    const originalLedger = await readFile(files.ledgerPath, 'utf8');
    service = await startReportService({ ...files, interval: 25 });
    const { url } = service.receipt;
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
    assert.match(await (await fetch(url)).text(), /Initial result/);
    assert.equal((await fetch(`${url}etc/passwd`)).status, 404);
    assert.equal((await fetch(`${url}stop`, { method: 'POST' })).status, 403);
    assert.equal((await fetch(`${url}status`)).status, 403);
    const events = await fetch(`${url}events`);
    const reader = events.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /revision/);
    const initial = await controlReportService('status', files.statePath);
    report.summary = 'Updated result';
    await writeFile(`${files.reportPath}.tmp`, JSON.stringify(report));
    await rename(`${files.reportPath}.tmp`, files.reportPath);
    await until(async () => (await controlReportService('status', files.statePath)).revision !== initial.revision);
    assert.match(new TextDecoder().decode((await reader.read()).value), /revision/);
    await reader.cancel();
    assert.match(await (await fetch(url)).text(), /Updated result/);
    assert.match(await readFile(files.outputPath, 'utf8'), /Updated result/);
    assert.doesNotMatch(await readFile(files.outputPath, 'utf8'), /EventSource/);
    await writeFile(files.reportPath, '{unfinished');
    await until(async () => (await controlReportService('status', files.statePath)).error);
    assert.match(await (await fetch(url)).text(), /Updated result/);
    await writeFile(files.reportPath, JSON.stringify(report));
    await until(async () => !(await controlReportService('status', files.statePath)).error);
    ledger.task.ledgerPath = files.reportPath;
    await writeFile(files.ledgerPath, JSON.stringify(ledger));
    await until(async () => (await controlReportService('status', files.statePath)).error.includes('ledger path'));
    assert.match(await readFile(files.outputPath, 'utf8'), /Updated result/);
    await writeFile(files.ledgerPath, originalLedger);
    await until(async () => !(await controlReportService('status', files.statePath)).error);
    const reused = await startReportService({ ...files, interval: 25 });
    assert.equal(reused.receipt.reused, true);
    assert.equal(reused.receipt.url, url);
    assert.equal(await readFile(files.ledgerPath, 'utf8'), originalLedger);
    const { stdout } = await promisify(execFile)(process.execPath, [new URL('../skills/auto-develop/scripts/serve-execution-report.mjs', import.meta.url).pathname, 'stop', '--state', files.statePath]);
    assert.equal(JSON.parse(stdout).stopping, true);
    await until(async () => { try { await readFile(files.statePath); return false; } catch { return true; } });
    await assert.rejects(fetch(url));
  } finally {
    await service?.close?.();
    await rm(root, { recursive: true, force: true });
  }
});

test('service rejects overlapping paths and invalid startup data without modifying inputs', async () => {
  const { root, files } = await fixture();
  try {
    const before = await readFile(files.ledgerPath, 'utf8');
    await assert.rejects(startReportService({ ...files, outputPath: files.ledgerPath }), /separate|html/i);
    await writeFile(files.reportPath, '{}');
    await assert.rejects(startReportService(files));
    assert.equal(await readFile(files.ledgerPath, 'utf8'), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
