#!/usr/bin/env python3
"""Prepare the official WDS source tree and compatibility scripts in a project."""
import json
import shutil
import sys
from pathlib import Path
sys.dont_write_bytecode = True
if len(sys.argv) != 2:
    raise SystemExit("usage: chatgpt_bootstrap.py PROJECT_ROOT")
project = Path(sys.argv[1]).expanduser().resolve()
skill = Path(__file__).resolve().parents[1]
plugin = skill.parents[1]
source = plugin / "runtime" / "src"
if not source.is_dir():
    raise SystemExit("WDS source runtime missing; reinstall the WDS plugin")
target = project / "_bmad" / "wds"
target.mkdir(parents=True, exist_ok=True)
shutil.copytree(source, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns("config.yaml"))
scripts = project / "_bmad" / "scripts"
scripts.mkdir(parents=True, exist_ok=True)
for item in (plugin / "runtime" / "scripts").glob("*.py"):
    dst = scripts / item.name
    if not dst.exists():
        shutil.copy2(item, dst)
config = target / "config.yaml"
if not config.exists():
    values = {
        "project_name": project.name,
        "user_name": "User",
        "communication_language": "English",
        "document_output_language": "English",
        "output_folder": str(project / "design-artifacts"),
        "design_artifacts": str(project / "design-artifacts"),
        "project_knowledge": str(project / "docs"),
        "design_system_mode": "building",
        "methodology_version": "wds-v6",
        "project_type": "digital_product",
        "product_languages": ["en"]
    }
    config.write_text("".join(k + ": " + json.dumps(v, ensure_ascii=False) + "\n" for k, v in values.items()), encoding="utf-8")
print(target)
