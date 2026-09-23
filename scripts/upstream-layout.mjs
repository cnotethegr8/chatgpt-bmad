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

function parseVersion(manifest, label) {
  const match = manifest.match(/^version\s*=\s*["']([^"']+)["']\s*$/m);
  if (!match) throw new Error(`${label} has no version`);
  return match[1];
}

async function readFlatVersion(root) {
  const skillsRoot = path.join(root, 'skills');
  const bmadRecordPath = path.join(skillsRoot, 'bmad', 'bmod.toml');
  if (await exists(bmadRecordPath)) {
    const bmadRecord = await readFile(bmadRecordPath, 'utf8');
    const moduleMatch = bmadRecord.match(/^bmod\s*=\s*["']([^"']+)["']\s*$/m);
    if (moduleMatch) {
      const moduleRecordPath = path.join(skillsRoot, moduleMatch[1], 'bmod.toml');
      if (await exists(moduleRecordPath)) {
        return parseVersion(await readFile(moduleRecordPath, 'utf8'), `Flat BMAD module record ${moduleMatch[1]}`);
      }
    }
  }

  const legacyManifestPath = path.join(skillsRoot, 'bmad', 'module-manifest.toml');
  if (await exists(legacyManifestPath)) {
    return parseVersion(await readFile(legacyManifestPath, 'utf8'), 'Flat BMAD module manifest');
  }

  throw new Error('Flat BMAD layout has no readable version metadata');
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
