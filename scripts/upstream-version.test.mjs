import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readUpstreamVersion } from './upstream-version.mjs';

test('reads the version field from the canonical BMAD module manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bmad-version-'));
  const manifestDir = join(root, 'skills', 'bmad');
  await mkdir(manifestDir, { recursive: true });
  await writeFile(
    join(manifestDir, 'module-manifest.toml'),
    'module = "toolbox"\nversion = "99.88.77-test"\nupdate_source = "github:example/repo"\n',
  );

  assert.equal(await readUpstreamVersion(root), '99.88.77-test');
});

test('returns null when the canonical manifest is unavailable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bmad-version-'));
  assert.equal(await readUpstreamVersion(root), null);
});
