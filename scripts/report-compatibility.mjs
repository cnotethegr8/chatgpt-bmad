import { readFile } from 'node:fs/promises';
import { buildIssue, classifyFailure, redact } from './compatibility-incident.mjs';

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const stage = arg('stage');
const logPath = arg('log');
if (!stage || !logPath) throw new Error('Usage: report-compatibility.mjs --stage <stage> --log <path>');
const log = await readFile(logPath, 'utf8').catch(() => '(no stage log captured)');
const classification = classifyFailure(stage, log);
console.log(`Failure classification: ${classification.category}`);
if (!classification.compatibility) {
  console.log('Failure appears transient/infrastructure-related; no compatibility issue will be opened.');
  process.exit(0);
}

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
const api = process.env.GITHUB_API_URL || 'https://api.github.com';
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'chatgpt-bmad-compatibility-reporter', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!response.ok) {
    const detail = redact(await response.text());
    throw new Error(`GitHub API ${response.status} ${path}: ${detail.slice(0, 1000)}`);
  }
  return response.status === 204 ? null : response.json();
}
async function readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } }
async function readText(path) { try { return (await readFile(path, 'utf8')).trim(); } catch { return null; } }

const upstreamPackage = await readJson('.tmp/bmad/package.json');
const generatedUpstream = await readJson('plugins/bmad-method/UPSTREAM.json');
const previousGood = await readJson('.tmp/compat/previous-good.json');
const previousGoodSha = previousGood?.sha || await readText('upstream/VERSION');
const capturedUpstreamSha = process.env.UPSTREAM_SHA || await readText('.tmp/compat/upstream-sha');
const upstreamSha = stage === 'upstream_clone' ? capturedUpstreamSha : (capturedUpstreamSha || previousGoodSha);
const upstreamVersion = process.env.UPSTREAM_VERSION || upstreamPackage?.version || generatedUpstream?.version || null;
const previousGoodVersion = previousGood?.version || generatedUpstream?.version || null;
const repoSha = process.env.GITHUB_SHA || null;
const runUrl = process.env.GITHUB_SERVER_URL && repo && process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;
const issue = buildIssue({ upstreamVersion, upstreamSha, repoSha, runUrl, stage, category: classification.category, affectedTarget: classification.affectedTarget, previousGoodVersion, previousGoodSha, log, timestamp: new Date().toISOString() });

const [owner, name] = repo.split('/');
const query = encodeURIComponent(`repo:${repo} is:issue is:open in:body "${issue.marker}"`);
const search = await request(`/search/issues?q=${query}&per_page=10`);
const existing = search.items?.find((item) => item.body?.includes(issue.marker));
if (existing) {
  await request(`/repos/${owner}/${name}/issues/${existing.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `## Latest failure\n\n${issue.body}` }) });
  console.log(`Updated compatibility issue #${existing.number}`);
} else {
  const created = await request(`/repos/${owner}/${name}/issues`, { method: 'POST', body: JSON.stringify({ title: issue.title, body: issue.body }) });
  console.log(`Created compatibility issue #${created.number}`);
}
