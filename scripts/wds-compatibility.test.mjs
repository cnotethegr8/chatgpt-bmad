import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentMarker } from './compatibility-incident.mjs';
import {
  buildWdsIssue, classifyWdsFailure, listOpenWdsIncidents, reportWdsIssue,
  resolveWdsIssues, wdsIncidentMarker
} from './wds-compatibility.mjs';

test('WDS clone transient failures do not open compatibility incidents', () => {
  const result = classifyWdsFailure('upstream_clone', 'fatal: Could not resolve host: github.com');
  assert.equal(result.compatibility, false);
  assert.equal(result.category, 'infrastructure_transient');
});

test('classifies build and workflow failures with independent categories', () => {
  assert.equal(classifyWdsFailure('adapter_generator', 'could not read Freya source').category,
    'adapter_generator');
  assert.equal(classifyWdsFailure('wds_integration', 'bootstrap wds-agent-freya-ux failed').affectedTarget,
    'wds-agent-freya-ux');
  assert.equal(classifyWdsFailure('bmad_integration', 'render bmad-build failed').category,
    'cross_plugin_runtime_integration');
});

test('WDS issue keys never collide with BMAD issues', () => {
  const sha = 'a'.repeat(40);
  const marker = wdsIncidentMarker(sha, 'adapter_generator');
  assert.match(marker, /^<!-- chatgpt-wds-compat:[0-9a-f]{20} -->$/);
  assert.notEqual(marker, incidentMarker(sha + ':adapter_generator'));
  assert.notEqual(marker, wdsIncidentMarker(sha, 'wds_runtime_integration'));
});

test('WDS issues include source identity and redact diagnostics', () => {
  const issue = buildWdsIssue({
    upstreamVersion: '0.4.3', upstreamSha: 'a'.repeat(40), repoSha: 'b'.repeat(40),
    category: 'adapter_generator', stage: 'adapter_generator',
    previousGoodVersion: '0.4.2', previousGoodSha: 'c'.repeat(40),
    log: 'password=hunter2\n' + 'x'.repeat(7000),
  });
  assert.match(issue.body, /Previous known-good WDS/);
  assert.match(issue.body, /diagnostic excerpt truncated/);
  assert.equal(issue.body.includes('hunter2'), false);
  assert.match(issue.title, /WDS compatibility/);
});

test('deduplicates recurring WDS failures and leaves BMAD incidents alone', async () => {
  const wds = buildWdsIssue({ stage: 'adapter_generator', category: 'adapter_generator',
    upstreamSha: 'f'.repeat(40), log: 'failed' });
  const existing = { number: 9, title: wds.title, body: wds.body };
  const other = { number: 10, title: '[BMAD compatibility] adapter_generator',
    body: '<!-- chatgpt-bmad-compat:12345678901234567890 -->' };
  const calls = [];
  const request = async (url, options) => {
    calls.push({ url, options });
    if (!options) return [existing, other];
    return { number: 9 };
  };
  assert.equal((await listOpenWdsIncidents(request, 'example/repo')).length, 1);
  const result = await reportWdsIssue(request, 'example/repo', wds);
  assert.deepEqual(result, { updated: 9 });
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
  assert.match(calls.at(-1).url, /issues\/9\/comments/);
});

test('resolves only WDS-created open issues after a successful sync', async () => {
  const wds = buildWdsIssue({ stage: 'adapter_generator', category: 'adapter_generator', log: 'failed' });
  const records = [
    { number: 4, title: wds.title, body: wds.body },
    { number: 5, title: '[BMAD compatibility] other', body: '<!-- chatgpt-bmad-compat:123 -->' },
    { number: 6, title: 'Manual WDS report', body: wds.body },
  ];
  const writes = [];
  const request = async (url, options) => {
    if (!options) return records;
    writes.push({ url, options });
    return {};
  };
  const ids = await resolveWdsIssues(request, 'example/repo', 'a'.repeat(40),
    'https://github.com/example/repo/actions/runs/99');
  assert.deepEqual(ids, [4]);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(writes[1].options.body), { state: 'closed', state_reason: 'completed' });
});
