import crypto from 'node:crypto';
import { excerpt, extractAffectedTarget, isTransientInfrastructureFailure } from './compatibility-incident.mjs';

export const WDS_ISSUE_PREFIX = '[WDS compatibility]';
export const WDS_MARKER_PREFIX = '<!-- chatgpt-wds-compat:';

const categories = {
  upstream_clone: 'upstream_sync',
  adapter_generator: 'adapter_generator',
  validate_plugins: 'plugin_structural_validation',
  wds_integration: 'wds_runtime_integration',
  bmad_integration: 'cross_plugin_runtime_integration',
  publish: 'publication_failure',
};

export function classifyWdsFailure(stage, log = '') {
  if (stage === 'upstream_clone' && /(?:github|http) (?:401|403)\b/i.test(log)) {
    return { category: 'infrastructure_github_api', compatibility: false, affectedTarget: null };
  }
  if (isTransientInfrastructureFailure(log)) {
    return { category: 'infrastructure_transient', compatibility: false, affectedTarget: null };
  }
  return {
    category: categories[stage] ?? 'unknown_pipeline_failure',
    compatibility: true,
    affectedTarget: extractAffectedTarget(log),
  };
}

export function wdsIncidentMarker(upstreamSha, category) {
  const key = 'wds:' + (upstreamSha || 'unknown') + ':' + category;
  return WDS_MARKER_PREFIX + crypto.createHash('sha256').update(key).digest('hex').slice(0, 20) + ' -->';
}

export function buildWdsIssue(data) {
  const {
    upstreamVersion, upstreamSha, repoSha, runUrl, stage, category, affectedTarget,
    previousGoodVersion, previousGoodSha, log, timestamp,
  } = data;
  const marker = wdsIncidentMarker(upstreamSha, category);
  const tick = String.fromCharCode(96);
  const fence = tick.repeat(3);
  const title = WDS_ISSUE_PREFIX + ' ' + category + ': ' + (upstreamVersion || 'unknown-version') +
    ' (' + (upstreamSha?.slice(0, 12) || 'unknown') + ')';
  const previous = (previousGoodVersion || 'unknown-version') + ' (' + (previousGoodSha || 'unknown-sha') + ')';
  const reproduce = {
    upstream_clone: 'git clone --depth 1 https://github.com/bmad-code-org/bmad-method-wds-expansion.git .tmp/wds',
    adapter_generator: 'npm run build:wds -- .tmp/wds',
    validate_plugins: 'npm run check',
    wds_integration: 'npm run integration:wds',
    bmad_integration: 'npm run integration',
    publish: 'Inspect the linked GitHub Actions publication step',
  }[stage] || 'npm run check && npm run integration:wds';
  const diagnostic = excerpt(log).replaceAll(fence, tick + tick + ' ' + tick);
  const lines = [
    marker,
    '## WDS compatibility incident',
    '',
    '- **Upstream WDS version:** ' + (upstreamVersion || 'unknown'),
    '- **Upstream WDS SHA:** ' + tick + (upstreamSha || 'unknown') + tick,
    '- **chatgpt-bmad SHA:** ' + tick + (repoSha || 'unknown') + tick,
    '- **Failure category:** ' + tick + category + tick,
    '- **Failed stage:** ' + tick + stage + tick,
    '- **Previous known-good WDS:** ' + previous,
    '- **Workflow run:** ' + (runUrl || 'unavailable'),
    '- **Timestamp:** ' + (timestamp || new Date().toISOString()),
  ];
  if (affectedTarget) lines.push('- **Affected skill/workflow:** ' + tick + affectedTarget + tick);
  lines.push('', '## Reproduce', '', fence + 'bash', reproduce, fence,
    '', '## Diagnostic excerpt', '', fence + 'text', diagnostic, fence, '',
    'Diagnostic output is redacted and truncated. Full details remain in GitHub Actions logs.', '');
  return { marker, title, body: lines.join('\n') };
}

export async function listOpenWdsIncidents(request, repo) {
  const repoPath = repo.split('/').map(encodeURIComponent).join('/');
  const issues = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await request('/repos/' + repoPath + '/issues?state=open&per_page=100&page=' + page);
    if (!Array.isArray(batch)) throw new Error('Expected GitHub issues array');
    for (const item of batch) {
      if (item.pull_request) continue;
      if (item.title?.startsWith(WDS_ISSUE_PREFIX) &&
          item.body?.startsWith(WDS_MARKER_PREFIX)) issues.push(item);
    }
    if (batch.length < 100) return issues;
  }
  throw new Error('Too many open issues: WDS incident scan needs pagination extension');
}

export async function reportWdsIssue(request, repo, issue) {
  const repoPath = repo.split('/').map(encodeURIComponent).join('/');
  const existing = (await listOpenWdsIncidents(request, repo))
    .find(item => item.body.includes(issue.marker));
  if (existing) {
    await request('/repos/' + repoPath + '/issues/' + existing.number + '/comments',
      { method: 'POST', body: JSON.stringify({ body: '## Latest occurrence\n\n' + issue.body }) });
    return { updated: existing.number };
  }
  const created = await request('/repos/' + repoPath + '/issues',
    { method: 'POST', body: JSON.stringify({ title: issue.title, body: issue.body }) });
  return { created: created.number };
}

export async function resolveWdsIssues(request, repo, upstreamSha, runUrl) {
  const repoPath = repo.split('/').map(encodeURIComponent).join('/');
  const issues = await listOpenWdsIncidents(request, repo);
  for (const issue of issues) {
    const comment = 'WDS compatibility restored: upstream ' + (upstreamSha || 'unknown') +
      ' passed plugin build, validation, both runtime checks, and publication.' +
      (runUrl ? '\n\nSuccessful run: ' + runUrl : '');
    await request('/repos/' + repoPath + '/issues/' + issue.number + '/comments',
      { method: 'POST', body: JSON.stringify({ body: comment }) });
    await request('/repos/' + repoPath + '/issues/' + issue.number,
      { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
  }
  return issues.map(issue => issue.number);
}
