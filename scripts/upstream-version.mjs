import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function readUpstreamVersion(root) {
  try {
    const manifest = await readFile(join(root, 'skills', 'bmad', 'module-manifest.toml'), 'utf8');
    const match = manifest.match(/^version\s*=\s*["']([^"']+)["']\s*$/m);
    return match?.[1] ?? null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.argv[2] ?? '.';
  const version = await readUpstreamVersion(root);
  if (version) process.stdout.write(version);
}
