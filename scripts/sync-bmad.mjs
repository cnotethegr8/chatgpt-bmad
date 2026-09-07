import { mkdir, writeFile } from 'node:fs/promises';
import { discoverRemoteRoots } from './upstream-layout.mjs';

const OWNER = 'bmad-code-org';
const REPO = 'BMAD-METHOD';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'chatgpt-bmad-sync',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(path) {
  const response = await fetch(`${API}${path}`, { headers });
  if (!response.ok) {
    const error = new Error(`GitHub ${response.status}: ${path}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function listDirectory(path, ref) {
  const entries = await github(`/contents/${path}?ref=${encodeURIComponent(ref)}`);
  if (!Array.isArray(entries)) throw new Error(`Expected directory: ${path}`);
  return entries.map(({ name, path: itemPath, sha, size, type, download_url }) => ({
    name,
    path: itemPath,
    sha,
    size,
    type,
    downloadUrl: download_url,
  }));
}

const commit = await github(`/commits/${BRANCH}`);
const sha = commit.sha;
const roots = await discoverRemoteRoots(listDirectory, sha);

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  upstream: {
    repository: `${OWNER}/${REPO}`,
    branch: BRANCH,
    sha,
    committedAt: commit.commit?.committer?.date ?? commit.commit?.author?.date ?? null,
    message: commit.commit?.message ?? null,
  },
  roots,
};

await mkdir('upstream', { recursive: true });
await writeFile('upstream/VERSION', `${sha}\n`);
await writeFile('upstream/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Normalized BMAD ${sha} (${roots.layout} layout)`);
if (roots.layout === 'flat') console.log(`skills entries: ${roots.skills.length}`);
else {
  console.log(`bmm-skills entries: ${roots.bmmSkills.length}`);
  console.log(`core-skills entries: ${roots.coreSkills.length}`);
}
