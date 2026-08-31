import { readFile } from 'node:fs/promises';
import { incidentMarker, incidentKey } from './compatibility-incident.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
const upstreamSha = process.env.UPSTREAM_SHA || (await readFile('.tmp/compat/upstream-sha', 'utf8')).trim();
const api = process.env.GITHUB_API_URL || 'https://api.github.com';
const [owner, name] = repo.split('/');
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'chatgpt-bmad-compatibility-reporter', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, { ...options, headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status} ${path}`);
  return response.status === 204 ? null : response.json();
}

const categories = ['upstream_sync', 'adapter_generator', 'openai_marketplace_compatibility', 'plugin_structural_validation', 'runtime_bootstrap', 'bmad_workflow_runtime', 'runtime_integration'];
for (const category of categories) {
  const marker = incidentMarker(incidentKey({ upstreamSha, category }));
  const q = encodeURIComponent(`repo:${repo} is:issue is:open in:body "${marker}"`);
  const result = await request(`/search/issues?q=${q}&per_page=10`);
  for (const item of result.items || []) {
    if (!item.body?.includes(marker)) continue;
    await request(`/repos/${owner}/${name}/issues/${item.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `Compatibility restored for upstream \`${upstreamSha}\` in workflow run ${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}. Closing automatically.` }) });
    await request(`/repos/${owner}/${name}/issues/${item.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
    console.log(`Closed compatibility issue #${item.number}`);
  }
}

const unknownCloneMarker = incidentMarker(incidentKey({ upstreamSha: null, category: 'upstream_sync' }));
const unknownQuery = encodeURIComponent(`repo:${repo} is:issue is:open in:body "${unknownCloneMarker}"`);
const unknownResult = await request(`/search/issues?q=${unknownQuery}&per_page=10`);
for (const item of unknownResult.items || []) {
  if (!item.body?.includes(unknownCloneMarker)) continue;
  await request(`/repos/${owner}/${name}/issues/${item.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `Upstream fetch succeeded for \`${upstreamSha}\` in workflow run ${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}. Closing the prior unattributed clone incident automatically.` }) });
  await request(`/repos/${owner}/${name}/issues/${item.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  console.log(`Closed compatibility issue #${item.number}`);
}
