import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function readUpstreamVersion(root) {
  // Prefer current modular BMAD metadata, then the previous flat layouts.
  for (const relative of [
    'skills/core-tools/bmod-core-tools/bmod.toml',
    'skills/bmad/bmod.toml',
    'skills/bmad/module-manifest.toml',
  ]) {
    let manifest;
    try {
      manifest = await readFile(join(root, relative), 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    const match = manifest.match(/^version\s*=\s*["']([^"']+)["']\s*$/m);
    if (match) return match[1];
  }
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2] ?? '.';
  const version = await readUpstreamVersion(root);
  if (version) process.stdout.write(version);
}
