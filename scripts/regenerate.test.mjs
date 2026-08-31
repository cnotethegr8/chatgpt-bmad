import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./regenerate.mjs', import.meta.url));

test('regenerate refreshes upstream checkout and runs the full pipeline in order', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'chatgpt-bmad-regenerate-'));
  const bin = path.join(root, 'bin');
  const log = path.join(root, 'commands.log');
  await mkdir(path.join(root, '.tmp', 'bmad'), { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(path.join(root, '.tmp', 'bmad', 'stale'), 'old');

  await writeFile(path.join(bin, 'npm'), `#!/bin/sh\necho "npm $*" >> "${log}"\n`, { mode: 0o755 });
  await writeFile(path.join(bin, 'git'), `#!/bin/sh\necho "git $*" >> "${log}"\nmkdir -p .tmp/bmad\necho fresh > .tmp/bmad/fresh\n`, { mode: 0o755 });

  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(log, 'utf8'), [
    'npm run sync',
    'git clone --depth 1 https://github.com/bmad-code-org/BMAD-METHOD.git .tmp/bmad',
    'npm run build -- .tmp/bmad',
    'npm run check',
    'npm run integration',
    '',
  ].join('\n'));
  await assert.rejects(readFile(path.join(root, '.tmp', 'bmad', 'stale'), 'utf8'));
  assert.equal(await readFile(path.join(root, '.tmp', 'bmad', 'fresh'), 'utf8'), 'fresh\n');
});
