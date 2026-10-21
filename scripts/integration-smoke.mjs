import { access, appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const pluginRoot = path.join(repoRoot, 'plugins', 'bmad-method');
const skillsRoot = path.join(pluginRoot, 'skills');
const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'chatgpt-bmad-smoke-'));

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (exit ${result.status})\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

async function bootstrap(skillName) {
  const skillRoot = path.join(skillsRoot, skillName);
  const script = path.join(skillRoot, 'scripts', 'chatgpt_bootstrap.py');
  await access(script);
  const output = run('python3', [script, projectRoot], `bootstrap ${skillName}`);
  if (path.resolve(output) !== path.join(projectRoot, '_bmad')) {
    throw new Error(`Unexpected bootstrap output for ${skillName}: ${output}`);
  }
}

async function render(skillName) {
  const skillRoot = path.join(skillsRoot, skillName);
  const renderer = path.join(projectRoot, '_bmad', 'scripts', 'render_skill.py');
  const output = run(
    'uv',
    ['run', '--no-cache', renderer, '--project-root', projectRoot, '--skill', skillRoot],
    `render ${skillName}`,
  );

  const handoff = output.split(/\\r?\\n/).filter(Boolean).at(-1) ?? '';
  const prefix = 'read and follow ';
  if (!handoff.startsWith(prefix)) {
    throw new Error(`Renderer did not return a workflow handoff for ${skillName}: ${output}`);
  }
  const workflowPath = handoff.slice(prefix.length).trim();
  if (!path.isAbsolute(workflowPath) || path.basename(workflowPath) !== 'workflow.md') {
    throw new Error(`Renderer returned an invalid workflow path for ${skillName}: ${workflowPath}`);
  }
  await access(workflowPath);
  const workflow = await readFile(workflowPath, 'utf8');
  const firstStepMatch = workflow.match(/^Read fully and follow: \`([^\`]+)\` to begin the workflow\\.$/m);
  if (!firstStepMatch || !path.isAbsolute(firstStepMatch[1])) {
    throw new Error(`Rendered workflow has no absolute first-step handoff for ${skillName}: ${workflowPath}`);
  }
  const firstStepPath = path.resolve(firstStepMatch[1]);
  if (!firstStepPath.startsWith(path.dirname(workflowPath) + path.sep) ||
      path.basename(firstStepPath) !== 'step-01-clarify-and-route.md') {
    throw new Error(`Rendered workflow has an unexpected first-step path for ${skillName}: ${firstStepPath}`);
  }
  await access(firstStepPath);
  const firstStep = await readFile(firstStepPath, 'utf8');
  if (!firstStep.includes('# Step 1: Clarify')) {
    throw new Error(`Rendered first step is invalid for ${skillName}: ${firstStepPath}`);
  }
}

async function exercisePrdRuntime() {
  const prdSkill = path.join(skillsRoot, 'bmad-prd');
  const resolveCustomization = path.join(projectRoot, '_bmad', 'scripts', 'resolve_customization.py');
  const memlog = path.join(projectRoot, '_bmad', 'scripts', 'memlog.py');

  const customization = run(
    'uv',
    ['run', '--no-cache', resolveCustomization, '--skill', prdSkill, '--project-root', projectRoot, '--key', 'workflow'],
    'resolve bmad-prd customization',
  );
  const parsed = JSON.parse(customization);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('PRD customization did not resolve to an object');
  }

  const workspace = path.join(projectRoot, '_bmad-output', 'smoke-prd');
  run('uv', ['run', '--no-cache', memlog, 'init', '--workspace', workspace, '--field', 'topic=smoke'], 'init memlog');
  run(
    'uv',
    ['run', '--no-cache', memlog, 'append', '--workspace', workspace, '--type', 'decision', '--text', 'integration smoke decision'],
    'append memlog',
  );
  const memlogPath = path.join(workspace, '.memlog.md');
  const contents = await readFile(memlogPath, 'utf8');
  if (!contents.includes('integration smoke decision')) {
    throw new Error('Memlog append did not persist the smoke decision');
  }
}

try {
  run('uv', ['--version'], 'uv availability');

  // Exercise representative core, planning, and implementation skills.
  await bootstrap('bmad-brainstorming');
  await bootstrap('bmad-prd');
  await bootstrap('bmad-build');

  const configPath = path.join(projectRoot, '_bmad', 'config.toml');
  const rendererPath = path.join(projectRoot, '_bmad', 'scripts', 'render_skill.py');
  await access(configPath);
  await access(rendererPath);

  const initialConfig = await readFile(configPath, 'utf8');
  if (!initialConfig.includes('[core]') || !initialConfig.includes('[bmm]')) {
    throw new Error('Bootstrap config is missing required core/bmm sections');
  }

  // Existing project configuration must survive subsequent skill activation.
  const preservationMarker = '\n# chatgpt-bmad-smoke-preserve\n';
  await appendFile(configPath, preservationMarker);
  await bootstrap('bmad-code-review');
  const preservedConfig = await readFile(configPath, 'utf8');
  if (!preservedConfig.includes(preservationMarker.trim())) {
    throw new Error('Bootstrap overwrote existing BMAD project configuration');
  }

  // Exercise a direct/conversational workflow's shared utilities.
  await exercisePrdRuntime();

  // Exercise the rendered implementation path used by bmad-build.
  await render('bmad-build');

  console.log('Integration smoke passed: bootstrap, config preservation, PRD runtime, build render');
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
