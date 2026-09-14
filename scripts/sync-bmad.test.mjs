import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
