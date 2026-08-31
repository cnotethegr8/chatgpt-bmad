#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

project_root = Path(sys.argv[1]).resolve()
skill_root = Path(__file__).resolve().parents[1]
plugin_root = skill_root.parents[1]
runtime_scripts = plugin_root / "runtime" / "scripts"
bmad_dir = project_root / "_bmad"
scripts_dir = bmad_dir / "scripts"
scripts_dir.mkdir(parents=True, exist_ok=True)
for source in runtime_scripts.iterdir():
    target = scripts_dir / source.name
    if source.is_dir():
        shutil.copytree(source, target, dirs_exist_ok=True)
    else:
        shutil.copy2(source, target)
config = bmad_dir / "config.toml"
if not config.exists():
    output = (project_root / "_bmad-output").as_posix()
    docs = (project_root / "docs").as_posix()
    project = project_root.name or "project"
    config.write_text(f'''[core]
user_name = "BMad"
project_name = "{project}"
communication_language = "English"
document_output_language = "English"
output_folder = "{output}"

[bmm]
user_skill_level = "intermediate"
planning_artifacts = "{output}/planning-artifacts"
implementation_artifacts = "{output}/implementation-artifacts"
project_knowledge = "{docs}"
''', encoding="utf-8")
print(bmad_dir)
