import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const validator = path.resolve('scripts/validate-manifest.mjs');
const upstreamSha = 'a'.repeat(40);

async function validate(roots) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'chatgpt-bmad-manifest-'));
  try {
    await mkdir(path.join(dir, 'upstream'));
    await writeFile(path.join(dir, 'upstream', 'VERSION'), upstreamSha + '\n');
    await writeFile(path.join(dir, 'upstream', 'manifest.json'), JSON.stringify({
      schemaVersion: 1,
      upstream: { sha: upstreamSha },
      roots,
    }));
    return spawnSync(process.execPath, [validator], { cwd: dir, encoding: 'utf8' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('accepts modular upstream inventories', async () => {
  const result = await validate({ layout: 'modular', skills: [], runtimeScripts: [] });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Manifest valid/);
});

test('rejects modular inventory without runtime scripts', async () => {
  const result = await validate({ layout: 'modular', skills: [] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing runtime scripts inventory/);
});

test('preserves flat and legacy layout validation', async () => {
  for (const roots of [
    { layout: 'flat', skills: [], runtimeScripts: [] },
    { layout: 'legacy', bmmSkills: [], coreSkills: [] },
  ]) {
    const result = await validate(roots);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('rejects unknown upstream layout instead of assuming legacy', async () => {
  const result = await validate({ layout: 'unknown', skills: [] });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported upstream layout/);
});
