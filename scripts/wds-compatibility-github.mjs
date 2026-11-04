import { readFile } from 'node:fs/promises';
import { redact } from './compatibility-incident.mjs';
import {
  buildWdsIssue, classifyWdsFailure, reportWdsIssue, resolveWdsIssues
} from './wds-compatibility.mjs';

function arg(name) {
  const index = process.argv.indexOf('--' + name);
  return index >= 0 ? process.argv[index + 1] : null;
}
async function readText(file) {
  try { return (await readFile(file, 'utf8')).trim(); } catch { return null; }
}
async function readJson(file) {
  const value = await readText(file);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

const action = process.argv[2];
if (!['report', 'resolve'].includes(action)) {
  throw new Error('Usage: wds-compatibility-github.mjs report --stage STAGE --log FILE | resolve');
}
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required');
const api = process.env.GITHUB_API_URL || 'https://api.github.com';
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: 'Bearer ' + token,
  'User-Agent': 'chatgpt-wds-compatibility-reporter',
  'X-GitHub-Api-Version': '2022-11-28',
  'Content-Type': 'application/json',
};
async function request(endpoint, options = {}) {
  const response = await fetch(api + endpoint, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) {
    const detail = redact(await response.text());
    throw new Error('GitHub API ' + response.status + ': ' + detail.slice(0, 1000));
  }
  return response.status === 204 ? null : response.json();
}

const upstreamSha = await readText('.tmp/wds-compat/upstream-sha');
const upstreamVersion = await readText('.tmp/wds-compat/upstream-version');
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
  ? process.env.GITHUB_SERVER_URL + '/' + repo + '/actions/runs/' + process.env.GITHUB_RUN_ID
  : null;

if (action === 'resolve') {
  const closed = await resolveWdsIssues(request, repo, upstreamSha, runUrl);
  console.log('Resolved WDS compatibility issues: ' + (closed.join(', ') || 'none'));
} else {
  const stage = arg('stage');
  const logPath = arg('log');
  if (!stage || !logPath) throw new Error('report requires --stage and --log');
  const log = await readText(logPath) || '(no stage log captured)';
  const diagnosis = classifyWdsFailure(stage, log);
  console.log('WDS failure category: ' + diagnosis.category);
  if (!diagnosis.compatibility) {
    console.log('Transient or infrastructure failure: no WDS compatibility issue opened');
  } else {
    const knownGood = await readJson('.tmp/wds-compat/previous-good.json');
    const issue = buildWdsIssue({
      upstreamVersion, upstreamSha, repoSha: process.env.GITHUB_SHA,
      runUrl, stage, category: diagnosis.category, affectedTarget: diagnosis.affectedTarget,
      previousGoodVersion: knownGood?.version, previousGoodSha: knownGood?.sha,
      log, timestamp: new Date().toISOString(),
    });
    const result = await reportWdsIssue(request, repo, issue);
    console.log('WDS issue ' + JSON.stringify(result));
  }
}
