import crypto from 'node:crypto';

const TRANSIENT_PATTERNS = [
  /could not resolve host/i,
  /connection (?:timed out|reset|refused)/i,
  /temporary failure/i,
  /network is unreachable/i,
  /http(?:s)? .*\b(?:429|500|502|503|504)\b/i,
  /github (?:429|5\d\d)/i,
  /service unavailable/i,
  /rate limit/i,
  /runner.*(?:lost|shutdown|unavailable)/i,
  /no space left on device/i,
];

const SECRET_PATTERNS = [
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  /\b(?:xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{10,})\b/g,
  /(authorization\s*:\s*(?:bearer|token)\s+)[^\s]+/gi,
  /((?:token|secret|password|passwd|api[_-]?key|access[_-]?key)\s*[=:]\s*)[^\s]+/gi,
];

export function redact(text = '', env = process.env) {
  let value = String(text);
  for (const pattern of SECRET_PATTERNS) {
    value = value.replace(pattern, (_, prefix) => `${prefix ?? ''}[REDACTED]`);
  }
  for (const [name, secret] of Object.entries(env)) {
    if (!/(?:TOKEN|SECRET|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i.test(name)) continue;
    if (typeof secret !== 'string' || secret.length < 7) continue;
    value = value.split(secret).join('[REDACTED]');
  }
  return value;
}

export function isTransientInfrastructureFailure(log = '') {
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(log));
}

export function extractAffectedTarget(log = '') {
  const patterns = [
    /bootstrap\s+([\w-]+)/i,
    /render\s+([\w-]+)/i,
    /resolve\s+([\w-]+)\s+customization/i,
    /skill(?:\s+|=)([\w-]+)/i,
    /workflow(?:\s+|=)([\w-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = log.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function classifyFailure(stage, log = '') {
  if ((stage === 'upstream_clone' || stage === 'upstream_sync') && isTransientInfrastructureFailure(log)) {
    return { category: 'infrastructure_transient', compatibility: false, affectedTarget: null };
  }
  if (stage === 'integration') {
    const affectedTarget = extractAffectedTarget(log);
    if (/\bbootstrap\b/i.test(log)) return { category: 'runtime_bootstrap', compatibility: true, affectedTarget };
    if (/\brender\b/i.test(log)) return { category: 'bmad_workflow_runtime', compatibility: true, affectedTarget };
    return { category: 'runtime_integration', compatibility: true, affectedTarget };
  }
  const mapping = {
    upstream_clone: 'upstream_sync',
    upstream_sync: 'upstream_sync',
    adapter_generator: 'adapter_generator',
    validate_manifest: 'openai_marketplace_compatibility',
    validate_plugin: 'plugin_structural_validation',
  };
  return { category: mapping[stage] ?? 'unknown_pipeline_failure', compatibility: stage !== 'unknown', affectedTarget: extractAffectedTarget(log) };
}

export function incidentKey({ upstreamSha, category }) {
  return `${upstreamSha || 'unknown'}:${category}`;
}

export function incidentMarker(key) {
  return `<!-- chatgpt-bmad-compat:${crypto.createHash('sha256').update(key).digest('hex').slice(0, 20)} -->`;
}

export function excerpt(log = '', maxChars = 6000, env = process.env) {
  const clean = redact(log, env).trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars)}\n... [diagnostic excerpt truncated; see workflow logs]`;
}

export function reproductionCommand(stage) {
  return {
    upstream_clone: 'git clone --depth 1 https://github.com/bmad-code-org/BMAD-METHOD.git .tmp/bmad',
    upstream_sync: 'npm run sync',
    adapter_generator: 'npm run build -- .tmp/bmad',
    validate_manifest: 'node scripts/validate-manifest.mjs',
    validate_plugin: 'node scripts/validate-plugin.mjs',
    integration: 'npm run integration',
  }[stage] ?? 'npm run check && npm run integration';
}

export function buildIssue({ upstreamVersion, upstreamSha, repoSha, runUrl, stage, category, affectedTarget, previousGoodVersion, previousGoodSha, log, timestamp }) {
  const key = incidentKey({ upstreamSha, category });
  const marker = incidentMarker(key);
  const shortSha = upstreamSha ? upstreamSha.slice(0, 12) : 'unknown';
  const version = upstreamVersion || 'unknown-version';
  const title = `[BMAD compatibility] ${category}: ${version} (${shortSha})`;
  const targetLine = affectedTarget ? `\n- **Affected skill/workflow:** \`${affectedTarget}\`` : '';
  const previousGood = previousGoodSha || previousGoodVersion ? `${previousGoodVersion || 'unknown-version'} (${previousGoodSha || 'unknown-sha'})` : 'unknown';
  const body = `${marker}\n## Compatibility incident\n\n- **Upstream BMAD version:** ${version}\n- **Upstream BMAD SHA:** \`${upstreamSha || 'unknown'}\`\n- **chatgpt-bmad SHA:** \`${repoSha || 'unknown'}\`\n- **Failure category:** \`${category}\`\n- **Failed pipeline stage:** \`${stage}\`${targetLine}\n- **Previous known-good BMAD:** ${previousGood}\n- **Workflow run:** ${runUrl || 'unavailable'}\n- **Timestamp:** ${timestamp || new Date().toISOString()}\n\n## Suggested reproduction\n\n\`\`\`bash\n${reproductionCommand(stage)}\n\`\`\`\n\n## Diagnostic excerpt\n\n\`\`\`text\n${excerpt(log)}\n\`\`\`\n\nFull logs remain in the linked GitHub Actions run. Diagnostic output is redacted and truncated before publication.\n`;
  return { key, marker, title, body };
}
