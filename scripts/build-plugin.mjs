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

const bootstrapPy = `#!/usr/bin/env python3\nfrom pathlib import Path\nimport shutil\nimport sys\n\nproject_root = Path(sys.argv[1]).resolve()\nskill_root = Path(__file__).resolve().parents[1]\nplugin_root = skill_root.parents[1]\nruntime_scripts = plugin_root / "runtime" / "scripts"\nbmad_dir = project_root / "_bmad"\nscripts_dir = bmad_dir / "scripts"\nscripts_dir.mkdir(parents=True, exist_ok=True)\nfor source in runtime_scripts.iterdir():\n    target = scripts_dir / source.name\n    if source.is_dir():\n        shutil.copytree(source, target, dirs_exist_ok=True)\n    else:\n        shutil.copy2(source, target)\nconfig = bmad_dir / "config.toml"\nif not config.exists():\n    output = (project_root / "_bmad-output").as_posix()\n    docs = (project_root / "docs").as_posix()\n    project = project_root.name or "project"\n    config.write_text(f'''[core]\nuser_name = "BMad"\nproject_name = "{project}"\ncommunication_language = "English"\ndocument_output_language = "English"\noutput_folder = "{output}"\n\n[bmm]\nuser_skill_level = "intermediate"\nplanning_artifacts = "{output}/planning-artifacts"\nimplementation_artifacts = "{output}/implementation-artifacts"\nproject_knowledge = "{docs}"\n''', encoding="utf-8")\nprint(bmad_dir)\n`;

function injectBootstrap(skillMarkdown) {
  const marker = '\n---\n';
  const frontmatterEnd = skillMarkdown.indexOf(marker, 4);
  if (!skillMarkdown.startsWith('---\n') || frontmatterEnd < 0) throw new Error('Invalid SKILL.md frontmatter');
  const insertAt = frontmatterEnd + marker.length;
  const adapter = `\n## ChatGPT adapter bootstrap\n\nBefore following the upstream BMAD instructions below, run this once for the current project root:\n\n\`\`\`bash\npython3 "{skill-root}/scripts/chatgpt_bootstrap.py" "{project-root}"\n\`\`\`\n\nThis materializes BMAD's shared runtime and neutral default configuration at \`{project-root}/_bmad\` when they are not already present. Existing BMAD configuration is preserved. If bootstrap fails, report the error and halt.\n\n`;
  return skillMarkdown.slice(0, insertAt) + adapter + skillMarkdown.slice(insertAt);
}

const copiedSkills = [];
for (const relativeSkill of upstreamPlugin.skills) {
  const source = path.resolve(upstreamRoot, relativeSkill);
  const name = path.basename(source);
  const dest = path.join(outRoot, 'skills', name);
  await cp(source, dest, { recursive: true });

  const originalSkill = await readFile(path.join(dest, 'SKILL.md'), 'utf8');
  await writeFile(path.join(dest, 'SKILL.md'), injectBootstrap(originalSkill));

  const scriptsDir = path.join(dest, 'scripts');
  await mkdir(scriptsDir, { recursive: true });
  await writeFile(path.join(scriptsDir, 'chatgpt_bootstrap.py'), bootstrapPy);

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
