import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const marketplace = JSON.parse(await readFile('.claude-plugin/marketplace.json', 'utf8'));
const plugin = marketplace.plugins?.[0];
if (!plugin) throw new Error('Marketplace has no plugin');
if (plugin.name !== 'bmad-method') throw new Error(`Unexpected plugin name: ${plugin.name}`);
if (!Array.isArray(plugin.skills) || plugin.skills.length === 0) throw new Error('Plugin has no skills');

const seen = new Set();
for (const rel of plugin.skills) {
  const name = path.basename(rel);
  if (seen.has(name)) throw new Error(`Duplicate skill: ${name}`);
  seen.add(name);
  const root = path.join('plugin', 'skills', name);
  const skill = await readFile(path.join(root, 'SKILL.md'), 'utf8');
  if (!skill.includes('## ChatGPT adapter bootstrap')) throw new Error(`Missing bootstrap instructions: ${name}`);
  await access(path.join(root, 'scripts', 'chatgpt_bootstrap.py'));
  await access(path.join(root, 'agents', 'openai.yaml'));
}
await access(path.join('plugin', 'runtime', 'scripts', 'render_skill.py'));
console.log(`Plugin valid: ${plugin.skills.length} BMAD skills with ChatGPT bootstrap`);
