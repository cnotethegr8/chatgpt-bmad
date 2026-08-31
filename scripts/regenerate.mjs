import { rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const upstreamDir = '.tmp/bmad';
const upstreamRepo = 'https://github.com/bmad-code-org/BMAD-METHOD.git';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(npmCommand, ['run', 'sync']);
await rm(upstreamDir, { recursive: true, force: true });
run('git', ['clone', '--depth', '1', upstreamRepo, upstreamDir]);
run(npmCommand, ['run', 'build', '--', upstreamDir]);
run(npmCommand, ['run', 'check']);
run(npmCommand, ['run', 'integration']);
