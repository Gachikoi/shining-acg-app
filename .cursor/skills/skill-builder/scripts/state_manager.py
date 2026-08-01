"""Persist and load phase state under .meta/."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SKILL_ROOT = Path(__file__).resolve().parent.parent
META_DIR = SKILL_ROOT / ".meta"

PHASE_FILES = {
    "clarify": "clarify_state.json",
    "design": "design_state.json",
    "build": "build_state.json",
}


def meta_path(name: str) -> Path:
    return META_DIR / name


def load_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"状态文件不存在: {path}")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict[str, Any]) -> None:
    META_DIR.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_requirements_schema() -> dict[str, Any]:
    return load_json(meta_path("requirements_schema.json"))


def load_phase_state(phase: str) -> dict[str, Any]:
    filename = PHASE_FILES[phase]
    return load_json(meta_path(filename))


def save_phase_state(phase: str, state: dict[str, Any]) -> None:
    filename = PHASE_FILES[phase]
    save_json(meta_path(filename), state)


def init_requirements(mode: str) -> list[dict[str, Any]]:
    schema = load_requirements_schema()
    if mode not in schema:
        raise ValueError(f"未知 mode: {mode}")
    requirements: list[dict[str, Any]] = []
    for item in schema[mode]:
        requirements.append(
            {
                "id": item["id"],
                "label": item["label"],
                "description": item.get("description", ""),
                "required": item.get("required", True),
                "validate": item.get("validate"),
                "default": item.get("default"),
                "state": "pending",
                "value": None,
            }
        )
    return requirements


def init_clarify_state(mode: str) -> dict[str, Any]:
    state: dict[str, Any] = {
        "version": "2.5.0",
        "mode": mode,
        "current_phase": "clarify",
        "requirements": init_requirements(mode),
        "clarify_record": {},
        "loop_context": {},
        "next_action": None,
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("clarify", state)
    return state


def requirements_to_record(requirements: list[dict[str, Any]]) -> dict[str, Any]:
    record: dict[str, Any] = {}
    for req in requirements:
        record[req["id"]] = req.get("value")
    return record


def sync_clarify_record(state: dict[str, Any]) -> None:
    state["clarify_record"] = {
        **requirements_to_record(state["requirements"]),
        "mode": state.get("mode"),
        "user_confirmed": state.get("user_confirmed", False),
    }


def init_design_state(clarify_state: dict[str, Any]) -> dict[str, Any]:
    mode = clarify_state.get("mode", "create")
    skill_name = clarify_state.get("clarify_record", {}).get("skill_name")
    if mode == "create" and skill_name:
        target_dir = f".cursor/skills/{skill_name}"
    elif mode == "iterate":
        path = clarify_state.get("clarify_record", {}).get("target_skill_path", "")
        target_dir = str(Path(path).parent).replace("\\", "/") if path else ""
    else:
        target_dir = ""

    state: dict[str, Any] = {
        "version": "2.5.0",
        "current_phase": "design",
        "mode": mode,
        "clarify_record": clarify_state.get("clarify_record", {}),
        "design_record": {
            "design_doc": "",
            "target_dir": target_dir,
            "file_plan": [],
            "schema_draft": {},
        },
        "next_action": {
            "type": "show_design",
            "message": "请审查设计方案，回复「确认」进入 build，或指出修改点。",
        },
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("design", state)
    return state


def init_build_state(design_state: dict[str, Any]) -> dict[str, Any]:
    design_record = design_state.get("design_record", {})
    files_planned = list(design_record.get("file_plan") or [])
    if not files_planned:
        files_planned = ["SKILL.md", "schema.json"]

    state: dict[str, Any] = {
        "version": "2.5.0",
        "current_phase": "build",
        "mode": design_state.get("mode", "create"),
        "build_record": {
            "target_dir": design_record.get("target_dir", ""),
            "files_planned": files_planned,
            "files_done": [],
            "files_skipped": [],
        },
        "next_action": None,
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("build", state)
    return state


def reset_idle_design_state(mode: str | None = None) -> dict[str, Any]:
    """Reset design phase to idle shell (no active session)."""
    state: dict[str, Any] = {
        "version": "2.5.0",
        "current_phase": "design",
        "mode": mode,
        "clarify_record": {},
        "design_record": {
            "design_doc": "",
            "target_dir": "",
            "file_plan": [],
            "schema_draft": {},
        },
        "next_action": None,
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("design", state)
    return state


def reset_idle_build_state(mode: str | None = None) -> dict[str, Any]:
    """Reset build phase to idle shell (no active session)."""
    state: dict[str, Any] = {
        "version": "2.5.0",
        "current_phase": "build",
        "mode": mode,
        "build_record": {
            "target_dir": "",
            "files_planned": [],
            "files_done": [],
            "files_skipped": [],
        },
        "next_action": None,
        "user_confirmed": False,
        "can_exit": False,
    }
    save_phase_state("build", state)
    return state


def reset_runtime_states(mode: str) -> dict[str, Any]:
    """
    Reset all phase runtime files for a new skill-builder session.
    Returns fresh clarify state (without next_action; caller runs loop_guard).
    """
    reset_idle_design_state(mode)
    reset_idle_build_state(mode)
    return init_clarify_state(mode)
