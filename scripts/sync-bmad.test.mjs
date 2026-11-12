import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const syncModule = pathToFileURL(path.resolve('scripts/sync-bmad.mjs')).href;

function response({ status = 200, json = null, text = '' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    async json() { return json; },
    async text() { return text; },
  };
}

test('authenticates GitHub API requests when GITHUB_TOKEN is available', async () => {
  const previousCwd = process.cwd();
  const previousFetch = globalThis.fetch;
  const previousToken = process.env.GITHUB_TOKEN;
  const workdir = await mkdtemp(path.join(tmpdir(), 'chatgpt-bmad-sync-'));
  const requests = [];
  process.env.GITHUB_TOKEN = 'test-token';
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (String(url).endsWith('/commits/main')) return response({ json: { sha: 'abc123', commit: { message: 'test' } } });
    return response({ json: [] });
  };
  process.chdir(workdir);
  try {
    await import(`${syncModule}?auth=${Date.now()}`);
    assert.ok(requests.length >= 3);
    for (const request of requests) assert.equal(request.options.headers.Authorization, 'Bearer test-token');
  } finally {
    process.chdir(previousCwd);
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
    await rm(workdir, { recursive: true, force: true });
  }
});

test('includes GitHub API error detail in failed sync errors', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ status: 403, text: '{"message":"API rate limit exceeded"}' });
  try {
    await assert.rejects(import(`${syncModule}?error=${Date.now()}`), /API rate limit exceeded/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('syncs modular upstream metadata without reading legacy-only fields', async () => {
  const previousCwd = process.cwd();
  const previousFetch = globalThis.fetch;
  const workdir = await mkdtemp(path.join(tmpdir(), 'chatgpt-bmad-modular-sync-'));
  const requests = [];
  globalThis.fetch = async (url) => {
    const address = String(url);
    requests.push(address);
    if (address.endsWith('/commits/main')) {
      return response({ json: { sha: 'modular123', commit: { message: 'test modular upstream' } } });
    }
    if (address.includes('/contents/skills?ref=')) {
      return response({ json: [{ name: 'core-tools', path: 'skills/core-tools', type: 'dir' }] });
    }
    if (address.includes('/contents/skills/bmad/scripts?ref=')) {
      return response({ status: 404, text: '{"message":"Not Found"}' });
    }
    if (address.includes('/contents/skills/core-tools/bmad/scripts?ref=')) {
      return response({ json: [{ name: 'render_skill.py', path: 'skills/core-tools/bmad/scripts/render_skill.py', type: 'file' }] });
    }
    throw new Error(`Unexpected GitHub API request: ${address}`);
  };
  process.chdir(workdir);
  try {
    await import(`${syncModule}?modular=${Date.now()}`);
    const manifest = JSON.parse(await readFile(path.join(workdir, 'upstream', 'manifest.json'), 'utf8'));
    assert.equal(manifest.upstream.sha, 'modular123');
    assert.equal(manifest.roots.layout, 'modular');
    assert.equal(manifest.roots.skills.length, 1);
    assert.equal(manifest.roots.runtimeScripts.length, 1);
    assert.equal(requests.length, 4);
  } finally {
    process.chdir(previousCwd);
    globalThis.fetch = previousFetch;
    await rm(workdir, { recursive: true, force: true });
  }
});
