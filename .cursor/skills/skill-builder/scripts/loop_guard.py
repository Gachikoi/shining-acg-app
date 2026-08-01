"""Compute next_action and exit conditions for each phase."""

from __future__ import annotations

from typing import Any

MAX_BATCH_QUESTIONS = 4


def _is_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    return True


def get_pending_requirements(requirements: list[dict[str, Any]]) -> list[dict[str, Any]]:
    pending: list[dict[str, Any]] = []
    for req in requirements:
        if req.get("state") == "waived":
            continue
        if not req.get("required", True):
            if _is_filled(req.get("value")):
                continue
            pending.append(req)
            continue
        if not _is_filled(req.get("value")) or req.get("state") == "pending":
            pending.append(req)
    return pending


def build_ask_message(req: dict[str, Any]) -> str:
    """Human-facing ask line; Agent may wrap with mode/progress prose."""
    label = req.get("label", req.get("id", ""))
    desc = req.get("description", "")
    if desc:
        return f"请提供{label}（{desc}）："
    return f"请提供{label}："


def compute_clarify_next_action(state: dict[str, Any]) -> dict[str, Any]:
    requirements = state.get("requirements", [])
    pending = get_pending_requirements(requirements)

    state["loop_context"] = {
        "pending_count": len(pending),
        "pending_ids": [r["id"] for r in pending[:MAX_BATCH_QUESTIONS]],
    }

    if pending:
        nxt = pending[0]
        state["loop_context"]["next_pending"] = {
            "id": nxt["id"],
            "label": nxt.get("label"),
            "description": nxt.get("description"),
        }
        state["next_action"] = {
            "type": "ask_question",
            "requirement_id": nxt["id"],
            "message": build_ask_message(nxt),
        }
        state["can_exit"] = False
        return state

    if not state.get("user_confirmed", False):
        state["loop_context"]["next_pending"] = None
        state["next_action"] = {
            "type": "wait_for_confirmation",
            "message": (
                "请核对 clarify_record 摘要，回复「确认」进入 design，"
                "或指出需要修改的字段。"
            ),
        }
        state["can_exit"] = False
        return state

    state["next_action"] = {"type": "exit_to_design"}
    state["can_exit"] = True
    return state


def compute_design_next_action(state: dict[str, Any]) -> dict[str, Any]:
    design_doc = (state.get("design_record") or {}).get("design_doc", "")
    if not _is_filled(design_doc):
        state["next_action"] = {
            "type": "show_design",
            "message": "请起草并展示设计文档，请用户确认或修改。",
        }
        state["can_exit"] = False
        return state

    if not state.get("user_confirmed", False):
        state["next_action"] = {
            "type": "show_design",
            "message": "请审查以下设计方案，回复「确认」进入 build，或指出修改点。",
        }
        state["can_exit"] = False
        return state

    state["next_action"] = {"type": "exit_to_build"}
    state["can_exit"] = True
    return state


def compute_build_next_action(state: dict[str, Any]) -> dict[str, Any]:
    record = state.get("build_record") or {}
    planned: list[str] = list(record.get("files_planned") or [])
    done: list[str] = list(record.get("files_done") or [])
    skipped: list[str] = list(record.get("files_skipped") or [])

    remaining = [f for f in planned if f not in done and f not in skipped]

    if remaining:
        nxt_file = remaining[0]
        state["next_action"] = {
            "type": "generate_file",
            "file_path": nxt_file,
            "message": f"请生成文件：{nxt_file}",
        }
        state["can_exit"] = False
        return state

    if not state.get("user_confirmed", False):
        state["next_action"] = {
            "type": "build_complete",
            "message": "请展示 build_record 摘要，请用户确认 build 结果。",
        }
        state["can_exit"] = False
        return state

    state["next_action"] = {"type": "done"}
    state["can_exit"] = True
    return state


def check_exit_condition(phase: str, state: dict[str, Any]) -> bool:
    if phase == "clarify":
        return bool(state.get("can_exit")) and state.get("user_confirmed") is True
    if phase == "design":
        return bool(state.get("can_exit")) and state.get("user_confirmed") is True
    if phase == "build":
        return bool(state.get("can_exit")) and state.get("user_confirmed") is True
    return False
