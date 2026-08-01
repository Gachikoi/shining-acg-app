"""Parse user replies and update requirement values."""

from __future__ import annotations

import re
from typing import Any

KEBAB_CASE = re.compile(r"^[a-z][a-z0-9-]*$")

CONFIRM_PATTERNS = [
    r"^确认$",
    r"^确认设计方案$",
    r"^确认设计$",
    r"^ok$",
    r"^好的$",
    r"^可以$",
    r"^没问题$",
    r"^对的$",
    r"^是的$",
    r"^yes$",
    r"^confirm$",
]

WAIVE_PATTERNS = [
    r"没有",
    r"无",
    r"不需要",
    r"不用",
    r"跳过",
    r"none",
    r"no ref",
    r"n/a",
]


def is_confirmation(text: str) -> bool:
    normalized = text.strip().lower()
    for pat in CONFIRM_PATTERNS:
        if re.search(pat, normalized, re.IGNORECASE):
            return True
    return False


def is_waive_optional(text: str) -> bool:
    normalized = text.strip().lower()
    for pat in WAIVE_PATTERNS:
        if re.search(pat, normalized, re.IGNORECASE):
            return True
    return False


def validate_kebab_case(value: str) -> str | None:
    v = value.strip().strip("`\"'")
    if KEBAB_CASE.match(v):
        return v
    return None


def extract_kebab_from_text(text: str) -> str | None:
    backtick = re.search(r"`([a-z][a-z0-9-]*)`", text)
    if backtick:
        return backtick.group(1)
    quoted = re.search(r"['\"]([a-z][a-z0-9-]*)['\"]", text)
    if quoted:
        return quoted.group(1)
    tokens = re.findall(r"[a-z][a-z0-9-]*", text.lower())
    for token in reversed(tokens):
        if "-" in token and KEBAB_CASE.match(token):
            return token
    if tokens and KEBAB_CASE.match(tokens[-1]):
        return tokens[-1]
    return None


def infer_mode_from_text(text: str) -> str | None:
    lower = text.lower()
    iterate_kw = ["迭代", "更新", "修改", "改 skill", "升级", "iterate", "update"]
    create_kw = ["新建", "创建", "写 skill", "开发 skill", "从零", "create", "new skill"]
    if any(k in lower for k in iterate_kw):
        return "iterate"
    if any(k in lower for k in create_kw):
        return "create"
    return None


def find_requirement(requirements: list[dict[str, Any]], req_id: str) -> dict[str, Any] | None:
    for req in requirements:
        if req["id"] == req_id:
            return req
    return None


def apply_value_to_requirement(
    req: dict[str, Any], raw_text: str, *, allow_extract: bool = False
) -> tuple[bool, str | None]:
    """Returns (ok, error_message)."""
    text = raw_text.strip()
    if not text:
        return False, "回答不能为空"

    if req.get("validate") == "kebab_case":
        value = validate_kebab_case(text)
        if not value and allow_extract:
            value = extract_kebab_from_text(text)
        if not value:
            return False, "skill_name 须为 kebab-case（如 pr-description-builder）"
        req["value"] = value
        req["state"] = "confirmed"
        return True, None

    if not req.get("required", True) and is_waive_optional(text):
        req["value"] = req.get("default") or "none"
        req["state"] = "waived"
        return True, None

    req["value"] = text
    req["state"] = "confirmed"
    return True, None


def apply_answer(
    state: dict[str, Any], requirement_id: str, user_text: str
) -> tuple[dict[str, Any], str | None]:
    requirements = state.get("requirements", [])
    req = find_requirement(requirements, requirement_id)
    if req is None:
        return state, f"未知 requirement_id: {requirement_id}"

    ok, err = apply_value_to_requirement(req, user_text, allow_extract=False)
    if not ok:
        return state, err

    return state, None


def parse_active_answer(
    state: dict[str, Any], user_text: str
) -> tuple[dict[str, Any], str | None]:
    """Apply user text to the active requirement from next_action."""
    next_action = state.get("next_action") or {}
    if next_action.get("type") != "ask_question":
        if is_confirmation(user_text):
            state["user_confirmed"] = True
            return state, None
        return state, "当前不在提问状态；请使用 confirm 或指定 --id"

    req_id = next_action.get("requirement_id")
    if not req_id:
        return state, "next_action 缺少 requirement_id"

    requirements = state.get("requirements", [])
    req = find_requirement(requirements, req_id)
    if req is None:
        return state, f"未知 requirement_id: {req_id}"

    ok, err = apply_value_to_requirement(req, user_text, allow_extract=True)
    if not ok:
        return state, err

    return state, None
