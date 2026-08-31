import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const marketplace = JSON.parse(await readFile('.agents/plugins/marketplace.json', 'utf8'));
const pluginEntry = marketplace.plugins?.[0];
if (!pluginEntry) throw new Error('Marketplace has no plugin');
if (pluginEntry.name !== 'bmad-method') throw new Error(`Unexpected marketplace plugin name: ${pluginEntry.name}`);
if (pluginEntry.source?.source !== 'local') throw new Error('Marketplace plugin source must be local');
if (pluginEntry.source?.path !== './plugins/bmad-method') throw new Error(`Unexpected marketplace plugin path: ${pluginEntry.source?.path}`);

const pluginRoot = path.join('plugins', 'bmad-method');
const manifest = JSON.parse(await readFile(path.join(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'));
if (manifest.name !== pluginEntry.name) {
  throw new Error(`Marketplace entry ${pluginEntry.name} does not match plugin manifest name ${manifest.name}`);
}
if (manifest.skills !== './skills/') throw new Error(`Unexpected plugin skills path: ${manifest.skills}`);

const skillsRoot = path.join(pluginRoot, 'skills');
const skillNames = (await import('node:fs/promises')).readdir(skillsRoot, { withFileTypes: true });
const dirs = (await skillNames).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (dirs.length !== 28) throw new Error(`Expected 28 BMAD skills, found ${dirs.length}`);

const seen = new Set();
for (const name of dirs) {
  if (seen.has(name)) throw new Error(`Duplicate skill: ${name}`);
  seen.add(name);
  const root = path.join(skillsRoot, name);
  const skill = await readFile(path.join(root, 'SKILL.md'), 'utf8');
  if (!skill.includes('## ChatGPT adapter bootstrap')) throw new Error(`Missing bootstrap instructions: ${name}`);
  await access(path.join(root, 'scripts', 'chatgpt_bootstrap.py'));
  await access(path.join(root, 'agents', 'openai.yaml'));
}
await access(path.join(pluginRoot, 'runtime', 'scripts', 'render_skill.py'));
console.log(`Plugin valid: ${dirs.length} BMAD skills with canonical OpenAI marketplace layout`);
