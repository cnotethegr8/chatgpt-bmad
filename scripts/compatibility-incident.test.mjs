import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssue, classifyFailure, incidentKey, incidentMarker, redact } from './compatibility-incident.mjs';

test('classifies transient clone failures as non-compatibility infrastructure', () => {
  assert.deepEqual(classifyFailure('upstream_clone', 'fatal: Could not resolve host: github.com'), { category: 'infrastructure_transient', compatibility: false, affectedTarget: null });
});

test('classifies runtime bootstrap and extracts affected skill', () => {
  assert.deepEqual(classifyFailure('integration', 'bootstrap bmad-prd failed (exit 1)'), { category: 'runtime_bootstrap', compatibility: true, affectedTarget: 'bmad-prd' });
});

test('classifies rendered workflow failures separately', () => {
  assert.deepEqual(classifyFailure('integration', 'render bmad-build failed (exit 1)'), { category: 'bmad_workflow_runtime', compatibility: true, affectedTarget: 'bmad-build' });
});

test('redacts known token shapes and secret env values', () => {
  const output = redact('Authorization: Bearer abcdefghijklmnop token=supersecret ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', { GITHUB_TOKEN: 'abcdefghijklmnop', CUSTOM_SECRET: 'supersecret' });
  assert.equal(output.includes('abcdefghijklmnop'), false);
  assert.equal(output.includes('supersecret'), false);
  assert.equal(output.includes('ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456'), false);
  assert.match(output, /\[REDACTED\]/);
});

test('dedupe marker is stable for upstream SHA plus category', () => {
  const key = incidentKey({ upstreamSha: 'abc123', category: 'adapter_generator' });
  assert.equal(key, 'abc123:adapter_generator');
  assert.equal(incidentMarker(key), incidentMarker(key));
  assert.notEqual(incidentMarker(key), incidentMarker('abc123:runtime_bootstrap'));
});

test('issue output includes required diagnostics and truncates logs', () => {
  const issue = buildIssue({ upstreamVersion: '9.9.9', upstreamSha: 'a'.repeat(40), repoSha: 'b'.repeat(40), runUrl: 'https://github.com/example/repo/actions/runs/1', stage: 'adapter_generator', category: 'adapter_generator', previousGoodVersion: '9.9.8', previousGoodSha: 'c'.repeat(40), log: `password=hunter2\n${'x'.repeat(7000)}`, timestamp: '2026-08-31T00:00:00Z' });
  assert.match(issue.body, /9\.9\.9/);
  assert.match(issue.body, /Previous known-good BMAD/);
  assert.match(issue.body, /diagnostic excerpt truncated/);
  assert.equal(issue.body.includes('hunter2'), false);
});
