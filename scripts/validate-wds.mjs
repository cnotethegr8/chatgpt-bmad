import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateSkillFrontmatter } from './skill-frontmatter.mjs';
const marketplace = JSON.parse(await readFile('.agents/plugins/marketplace.json', 'utf8'));
if (marketplace.plugins?.length !== 2) throw new Error('Expected BMAD and WDS entries');
for (const [name, expected] of [['bmad-method', './plugins/bmad-method'], ['wds', './plugins/wds']]) {
  const entry = marketplace.plugins.find(p => p.name === name);
  if (entry?.source?.source !== 'local' || entry.source.path !== expected) throw new Error('Missing marketplace plugin ' + name);
}
const root = path.join('plugins', 'wds');
const manifest = JSON.parse(await readFile(path.join(root, '.codex-plugin', 'plugin.json'), 'utf8'));
if (manifest.name !== 'wds' || manifest.skills !== './skills/' || !manifest.author?.name) throw new Error('Invalid WDS plugin metadata');
const upstream = JSON.parse(await readFile(path.join(root, 'UPSTREAM.json'), 'utf8'));
const dirs = (await readdir(path.join(root, 'skills'), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort();
if (dirs.length !== upstream.skillCount || dirs.length < 13) throw new Error('WDS skill count mismatch');
for (const name of dirs) {
  const dir = path.join(root, 'skills', name);
  validateSkillFrontmatter(await readFile(path.join(dir, 'SKILL.md'), 'utf8'), name);
  await access(path.join(dir, 'scripts', 'chatgpt_bootstrap.py'));
  await access(path.join(dir, 'agents', 'openai.yaml'));
}
for (const file of ['agents/wds-agent-freya-ux/SKILL.md', 'workflows/wds-4-ux-design/workflow.md', 'module.yaml']) {
  await access(path.join(root, 'runtime', 'src', file));
}
await access(path.join(root, 'runtime', 'scripts', 'resolve_customization.py'));
const freya = await readFile(path.join(root, 'skills/wds-agent-freya-ux/customize.toml'), 'utf8');
if (freya.includes('bmad-wds-outline-scenarios')) throw new Error('Freya menu uses unavailable upstream skill aliases');
console.log('WDS plugin valid: ' + dirs.length + ' independently discoverable skills');
