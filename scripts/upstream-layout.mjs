import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function readFlatVersion(root) {
  const manifest = await readFile(path.join(root, 'skills', 'bmad', 'module-manifest.toml'), 'utf8');
  const match = manifest.match(/^version\s*=\s*["']([^"']+)["']\s*$/m);
  if (!match) throw new Error('Flat BMAD module manifest has no version');
  return match[1];
}

export async function discoverUpstreamLayout(root) {
  const marketplacePath = path.join(root, '.claude-plugin', 'marketplace.json');
  if (await exists(marketplacePath)) {
    const marketplace = JSON.parse(await readFile(marketplacePath, 'utf8'));
    const plugin = marketplace.plugins?.[0];
    if (!plugin?.skills?.length) throw new Error('Upstream BMAD marketplace has no skills');
    return {
      kind: 'legacy',
      marketplace,
      plugin,
      version: plugin.version,
      skillPaths: plugin.skills,
      runtimeScriptsPath: path.join(root, 'src', 'scripts'),
    };
  }

  const skillsRoot = path.join(root, 'skills');
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  const skillNames = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await exists(path.join(skillsRoot, entry.name, 'SKILL.md'))) skillNames.push(entry.name);
  }
  skillNames.sort();
  if (!skillNames.length) throw new Error('Upstream BMAD flat skills tree has no skills');

  return {
    kind: 'flat',
    marketplace: null,
    plugin: null,
    version: await readFlatVersion(root),
    skillPaths: skillNames.map((name) => `./skills/${name}`),
    runtimeScriptsPath: path.join(root, 'skills', 'bmad', 'scripts'),
  };
}

export async function discoverRemoteRoots(listDirectory, ref) {
  try {
    return {
      layout: 'flat',
      skills: await listDirectory('skills', ref),
      runtimeScripts: await listDirectory('skills/bmad/scripts', ref),
    };
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  return {
    layout: 'legacy',
    src: await listDirectory('src', ref),
    bmmSkills: await listDirectory('src/bmm-skills', ref),
    coreSkills: await listDirectory('src/core-skills', ref),
    runtimeScripts: await listDirectory('src/scripts', ref),
  };
}
