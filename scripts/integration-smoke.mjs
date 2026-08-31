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

  const workflowPath = output.split(/\r?\n/).filter(Boolean).at(-1);
  if (!workflowPath || !path.isAbsolute(workflowPath)) {
    throw new Error(`Renderer did not return an absolute workflow path for ${skillName}: ${output}`);
  }
  await access(workflowPath);
  if (path.basename(workflowPath) !== 'workflow.md') {
    throw new Error(`Renderer returned unexpected artifact for ${skillName}: ${workflowPath}`);
  }
}

try {
  run('uv', ['--version'], 'uv availability');

  // Exercise one skill from each major BMAD layer against the same fresh project.
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

  // Exercise the same render path ChatGPT follows for implementation workflows.
  await render('bmad-build');
  await render('bmad-code-review');

  console.log('Integration smoke passed: bootstrap, config preservation, build render, code-review render');
} finally {
  await rm(projectRoot, { recursive: true, force: true });
}
