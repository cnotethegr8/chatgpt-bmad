import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const upstreamRoot = process.argv[2] ?? '.tmp/bmad';
const outRoot = 'plugin';
const sourceMarketplace = JSON.parse(await readFile(path.join(upstreamRoot, '.claude-plugin', 'marketplace.json'), 'utf8'));
const upstreamPlugin = sourceMarketplace.plugins?.[0];
if (!upstreamPlugin?.skills?.length) throw new Error('Upstream BMAD marketplace has no skills');

await rm(outRoot, { recursive: true, force: true });
await mkdir(path.join(outRoot, 'skills'), { recursive: true });
await mkdir(path.join(outRoot, 'runtime'), { recursive: true });

const copiedSkills = [];
for (const relativeSkill of upstreamPlugin.skills) {
  const source = path.resolve(upstreamRoot, relativeSkill);
  const name = path.basename(source);
  const dest = path.join(outRoot, 'skills', name);
  await cp(source, dest, { recursive: true });

  const agentDir = path.join(dest, 'agents');
  await mkdir(agentDir, { recursive: true });
  const displayName = name.replace(/^bmad-/, 'BMad ').split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ').replace(/^Bmad /, 'BMad ');
  await writeFile(path.join(agentDir, 'openai.yaml'), `interface:\n  display_name: "${displayName}"\n  short_description: "BMAD Method workflow: ${name}"\n`);
  copiedSkills.push(`./skills/${name}`);
}

await cp(path.join(upstreamRoot, 'src', 'scripts'), path.join(outRoot, 'runtime', 'scripts'), { recursive: true });

const marketplace = {
  name: 'chatgpt-bmad',
  owner: { name: 'chatgpt-bmad' },
  description: 'ChatGPT-compatible distribution of the complete BMAD Method skill library.',
  repository: 'https://github.com/cnotethegr8/chatgpt-bmad',
  plugins: [{
    name: 'bmad-method',
    displayName: 'BMAD Method',
    source: './plugin',
    description: upstreamPlugin.description,
    version: upstreamPlugin.version,
    author: upstreamPlugin.author,
    skills: copiedSkills,
  }],
};

await mkdir('.claude-plugin', { recursive: true });
await writeFile('.claude-plugin/marketplace.json', `${JSON.stringify(marketplace, null, 2)}\n`);
await writeFile(path.join(outRoot, 'UPSTREAM.json'), `${JSON.stringify({ name: sourceMarketplace.name, version: upstreamPlugin.version, skillCount: copiedSkills.length }, null, 2)}\n`);
console.log(`Built ChatGPT BMAD plugin with ${copiedSkills.length} skills from BMAD ${upstreamPlugin.version}`);
