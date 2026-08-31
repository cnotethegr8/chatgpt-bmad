import { appendFile } from 'node:fs/promises';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

export function simulationDiagnostic(requested, stage) {
  if (!requested || requested === 'none') return null;

  const directStages = new Set([
    'upstream_sync',
    'adapter_generator',
    'validate_manifest',
    'validate_plugin',
  ]);
  if (directStages.has(requested) && requested === stage) {
    return `BMAD compatibility acceptance test: simulated ${stage} failure`;
  }

  if (stage !== 'integration') return null;
  if (requested === 'runtime_bootstrap') {
    return 'bootstrap bmad-prd failed (exit 97) — simulated compatibility acceptance failure';
  }
  if (requested === 'bmad_workflow_runtime') {
    return 'render bmad-build failed (exit 97) — simulated compatibility acceptance failure';
  }
  if (requested === 'runtime_integration') {
    return 'integration smoke failed (exit 97) — simulated compatibility acceptance failure';
  }
  return null;
}

const stage = arg('stage');
const logPath = arg('log');
if (!stage || !logPath) {
  throw new Error('Usage: simulate-compatibility-failure.mjs --stage <stage> --log <path>');
}

const diagnostic = simulationDiagnostic(process.env.SIMULATE_FAILURE_STAGE, stage);
if (!diagnostic) process.exit(0);

await appendFile(
  logPath,
  `${diagnostic}\nAuthorization: Bearer compat-acceptance-secret-123456789\n`,
  'utf8',
);
console.error(diagnostic);
process.exit(97);
