import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { repairSkillFrontmatter } from './skill-frontmatter.mjs';

const upstream = path.resolve(process.argv[2] || '.tmp/wds');
const root = path.join('plugins', 'wds');
await access(path.join(upstream, 'src', 'module.yaml'));
await rm(root, { recursive: true, force: true });
await mkdir(path.join(root, 'skills'), { recursive: true });
await mkdir(path.join(root, 'runtime'), { recursive: true });
await mkdir(path.join(root, '.codex-plugin'), { recursive: true });
await cp(path.join(upstream, 'src'), path.join(root, 'runtime', 'src'), { recursive: true });
await cp(path.join(upstream, 'LICENSE'), path.join(root, 'LICENSE'));

const scriptsRoot = path.join(root, 'runtime', 'scripts');
await mkdir(scriptsRoot, { recursive: true });
// WDS uses BMAD's TOML customization resolver; bundle the shared resolver
// in WDS to avoid depending on installation order for this utility.
for (const file of ['config_utils.py', 'resolve_customization.py', 'setup_check.py']) {
  await cp(path.join('plugins', 'bmad-method', 'runtime', 'scripts', file), path.join(scriptsRoot, file));
}
const bootstrap = "#!/usr/bin/env python3\n\"\"\"Prepare the official WDS source tree and compatibility scripts in a project.\"\"\"\nimport json\nimport shutil\nimport sys\nfrom pathlib import Path\nsys.dont_write_bytecode = True\nif len(sys.argv) != 2:\n    raise SystemExit(\"usage: chatgpt_bootstrap.py PROJECT_ROOT\")\nproject = Path(sys.argv[1]).expanduser().resolve()\nskill = Path(__file__).resolve().parents[1]\nplugin = skill.parents[1]\nsource = plugin / \"runtime\" / \"src\"\nif not source.is_dir():\n    raise SystemExit(\"WDS source runtime missing; reinstall the WDS plugin\")\ntarget = project / \"_bmad\" / \"wds\"\ntarget.mkdir(parents=True, exist_ok=True)\nshutil.copytree(source, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns(\"config.yaml\"))\nscripts = project / \"_bmad\" / \"scripts\"\nscripts.mkdir(parents=True, exist_ok=True)\nfor item in (plugin / \"runtime\" / \"scripts\").glob(\"*.py\"):\n    dst = scripts / item.name\n    if not dst.exists():\n        shutil.copy2(item, dst)\nconfig = target / \"config.yaml\"\nif not config.exists():\n    values = {\n        \"project_name\": project.name,\n        \"user_name\": \"User\",\n        \"communication_language\": \"English\",\n        \"document_output_language\": \"English\",\n        \"output_folder\": str(project / \"design-artifacts\"),\n        \"design_artifacts\": str(project / \"design-artifacts\"),\n        \"project_knowledge\": str(project / \"docs\"),\n        \"design_system_mode\": \"building\",\n        \"methodology_version\": \"wds-v6\",\n        \"project_type\": \"digital_product\",\n        \"product_languages\": [\"en\"]\n    }\n    config.write_text(\"\".join(k + \": \" + json.dumps(v, ensure_ascii=False) + \"\\n\" for k, v in values.items()), encoding=\"utf-8\")\nprint(target)\n";
const menuAliases = new Map([
  ['bmad-wds-outline-scenarios', 'wds-3-scenarios'],
  ['bmad-wds-conceptual-sketching', 'wds-4-ux-design'],
  ['bmad-wds-conceptual-specs', 'wds-4-ux-design'],
  ['bmad-wds-spec-audit', 'wds-4-ux-design'],
  ['bmad-wds-visual-design', 'wds-6-asset-generation'],
  ['bmad-wds-design-system', 'wds-7-design-system'],
  ['bmad-wds-design-delivery', 'wds-5-agentic-development'],
  ['bmad-wds-product-evolution', 'wds-8-product-evolution'],
]);
const created = [];
for (const group of ['agents', 'workflows']) {
  const base = path.join(upstream, 'src', group);
  for (const entry of (await readdir(base, { withFileTypes: true })).filter(x => x.isDirectory())) {
    const name = entry.name;
    const src = path.join(base, name);
    try { await access(path.join(src, 'SKILL.md')); } catch { continue; }
    const dest = path.join(root, 'skills', name);
    await cp(src, dest, { recursive: true });
    const original = await readFile(path.join(dest, 'SKILL.md'), 'utf8');
    const safe = repairSkillFrontmatter(original, name);
    const frontEnd = safe.indexOf('\n---\n', 4);
    if (frontEnd < 0) throw new Error('Missing frontmatter boundary in ' + name);
    const insertion = `
## ChatGPT WDS bootstrap

Before executing this upstream WDS agent or workflow, initialize the project's WDS runtime:

\`\`\`bash
python3 "{skill-root}/scripts/chatgpt_bootstrap.py" "{project-root}"
\`\`\`

This installs WDS's upstream workflows and shared references into
\`{project-root}/_bmad/wds\`, retaining any existing WDS project configuration.
Keep the BMAD Method plugin available for BMAD core workflows.
If bootstrap fails, report the error; do not continue with incomplete setup.

`;
    await writeFile(path.join(dest, 'SKILL.md'), safe.slice(0, frontEnd + 5) + insertion + safe.slice(frontEnd + 5));
    const scripts = path.join(dest, 'scripts');
    await mkdir(scripts, { recursive: true });
    await writeFile(path.join(scripts, 'chatgpt_bootstrap.py'), bootstrap);
    const agentDir = path.join(dest, 'agents');
    await mkdir(agentDir, { recursive: true });
    const displayName = name.replace(/^wds-/, 'WDS ').split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ').replace(/^Wds /, 'WDS ');
    await writeFile(path.join(agentDir, 'openai.yaml'), `interface:\n  display_name: "${displayName}"\n  short_description: "WDS agent or workflow: ${name}"\n`);
    if (name === 'wds-agent-freya-ux') {
      const customization = path.join(dest, 'customize.toml');
      let content = await readFile(customization, 'utf8');
      for (const [from, to] of menuAliases) content = content.replaceAll(`"${from}"`, `"${to}"`);
      await writeFile(customization, content);
    }
    created.push(name);
  }
}
if (created.length < 13 || !created.includes('wds-agent-freya-ux')) {
  throw new Error('WDS layout changed: expected Freya and 13+ core agents/workflows');
}
let sha = 'unknown';
try { sha = execFileSync('git', ['-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
const packageInfo = JSON.parse(await readFile(path.join(upstream, 'package.json'), 'utf8'));
const version = packageInfo.version || '0.0.0';
await writeFile(path.join(root, 'UPSTREAM.json'), JSON.stringify({
  repository: 'https://github.com/bmad-code-org/bmad-method-wds-expansion',
  sha, version, skillCount: created.length, skills: created.sort()
}, null, 2) + '\n');
const manifest = {
  name: 'wds', version, description: 'Whiteport Design Studio',
  author: { name: 'Whiteport Collective / BMad Code' },
  homepage: 'https://github.com/bmad-code-org/bmad-method-wds-expansion',
  repository: 'https://github.com/cnotethegr8/chatgpt-bmad',
  license: 'MIT', keywords: ['wds', 'bmad', 'ux', 'wireframes', 'design-systems'],
  skills: './skills/',
  interface: {
    displayName: 'WDS — Whiteport Design Studio',
    shortDescription: 'UX scenarios, wireframes, specifications, and design systems with Freya',
    longDescription: 'Whiteport Design Studio provides Freya, Saga, Mimir, and its complete WDS design and development workflow library.',
    developerName: 'Whiteport Collective / chatgpt-bmad',
    category: 'Developer Tools', capabilities: ['Interactive', 'Write'],
    websiteURL: 'https://github.com/bmad-code-org/bmad-method-wds-expansion',
    defaultPrompt: ['Use Freya from WDS to design the UX for this feature.',
      'Use WDS to create UX scenarios and a design system.',
      'Review this UX specification using WDS.']
  }
};
await writeFile(path.join(root, '.codex-plugin', 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Built WDS plugin with ' + created.length + ' skills from WDS ' + version + ' at ' + sha);
