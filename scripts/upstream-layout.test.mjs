import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { discoverRemoteRoots, discoverUpstreamLayout } from './upstream-layout.mjs';

async function tempRoot() {
  return mkdtemp(path.join(os.tmpdir(), 'chatgpt-bmad-layout-'));
}

async function write(root, relative, content = '') {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

test('discovers legacy marketplace layout', async () => {
  const root = await tempRoot();
  await write(root, '.claude-plugin/marketplace.json', JSON.stringify({
    name: 'bmad-method',
    plugins: [{ version: '1.2.3', skills: ['./src/core-skills/example'] }],
  }));
  await write(root, 'src/core-skills/example/SKILL.md', '---\nname: example\n---\n');
  await mkdir(path.join(root, 'src/scripts'), { recursive: true });

  const layout = await discoverUpstreamLayout(root);
  assert.equal(layout.kind, 'legacy');
  assert.equal(layout.version, '1.2.3');
  assert.deepEqual(layout.skillPaths, ['./src/core-skills/example']);
  assert.equal(layout.runtimeScriptsPath, path.join(root, 'src/scripts'));
});

test('discovers flat skills layout introduced by upstream BMAD', async () => {
  const root = await tempRoot();
  await write(root, 'skills/bmad/module-manifest.toml', 'version = "7.0.0"\n');
  await write(root, 'skills/bmad/SKILL.md', '---\nname: bmad\n---\n');
  await write(root, 'skills/bmad/scripts/runtime.py', 'print("ok")\n');
  await write(root, 'skills/bmad-prd/SKILL.md', '---\nname: bmad-prd\n---\n');
  await mkdir(path.join(root, 'skills/not-a-skill'), { recursive: true });

  const layout = await discoverUpstreamLayout(root);
  assert.equal(layout.kind, 'flat');
  assert.equal(layout.version, '7.0.0');
  assert.deepEqual(layout.skillPaths, ['./skills/bmad', './skills/bmad-prd']);
  assert.equal(layout.runtimeScriptsPath, path.join(root, 'skills/bmad/scripts'));
});

test('remote discovery falls back from flat skills to legacy src layout', async () => {
  const calls = [];
  const listDirectory = async (directory) => {
    calls.push(directory);
    if (directory === 'skills') throw Object.assign(new Error('not found'), { status: 404 });
    return [{ path: directory }];
  };

  const roots = await discoverRemoteRoots(listDirectory, 'abc123');
  assert.equal(roots.layout, 'legacy');
  assert.deepEqual(calls, ['skills', 'src', 'src/bmm-skills', 'src/core-skills', 'src/scripts']);
});
