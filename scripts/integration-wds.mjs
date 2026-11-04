import { mkdtemp, readFile, rm, access, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const project = await mkdtemp(path.join(os.tmpdir(), 'wds-plugin-smoke-'));
function run(skill) {
 const res = spawnSync('python3', [path.resolve('plugins/wds/skills', skill, 'scripts/chatgpt_bootstrap.py'), project], {encoding:'utf8'});
 if (res.status !== 0) throw new Error('WDS bootstrap failed: ' + res.stderr);
}
try {
 run('wds-agent-freya-ux');
 const configPath = path.join(project, '_bmad/wds/config.yaml');
 const before = await readFile(configPath, 'utf8');
 if (!before.includes('methodology_version')) throw new Error('Missing WDS configuration');
 await access(path.join(project, '_bmad/wds/workflows/wds-4-ux-design/workflow.md'));
 await access(path.join(project, '_bmad/scripts/resolve_customization.py'));
 await writeFile(configPath, before + '# preserved\n');
 run('wds-4-ux-design');
 if (!(await readFile(configPath, 'utf8')).includes('# preserved')) throw new Error('WDS config overwritten');
 const resolve = spawnSync('python3', [path.join(project, '_bmad/scripts/resolve_customization.py'),
 '--project-root', project, '--skill', path.resolve('plugins/wds/skills/wds-agent-freya-ux'), '--key', 'agent'], {encoding:'utf8'});
 if (resolve.status !== 0 || !resolve.stdout.includes('Freya')) throw new Error('Freya customization resolver failed: ' + resolve.stderr);
 console.log('WDS integration smoke passed: Freya, runtime, config preservation, customization');
} finally { await rm(project, {recursive:true, force:true}); }
