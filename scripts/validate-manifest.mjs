import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile('upstream/manifest.json', 'utf8'));
const version = (await readFile('upstream/VERSION', 'utf8')).trim();

const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
};

if (manifest.schemaVersion !== 1) fail('Unsupported manifest schemaVersion');
if (!/^[0-9a-f]{40}$/.test(manifest.upstream?.sha ?? '')) fail('Invalid upstream SHA');
if (manifest.upstream?.sha !== version) fail('VERSION does not match manifest SHA');
switch (manifest.roots?.layout) {
  case 'flat':
  case 'modular':
    if (!Array.isArray(manifest.roots.skills)) fail('Missing skills inventory');
    if (!Array.isArray(manifest.roots.runtimeScripts)) fail('Missing runtime scripts inventory');
    break;
  case 'legacy':
    if (!Array.isArray(manifest.roots.bmmSkills)) fail('Missing bmmSkills inventory');
    if (!Array.isArray(manifest.roots.coreSkills)) fail('Missing coreSkills inventory');
    break;
  default:
    fail(`Unsupported upstream layout: ${manifest.roots?.layout ?? '(missing)'}`);
}

if (!process.exitCode) console.log(`Manifest valid for BMAD ${version}`);
