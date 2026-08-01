#!/usr/bin/env python3
"""
skill-builder phase loop runner.

Harness 每轮调用；Agent 不直接执行。

用法示例:
  python scripts/clarify_loop.py session reset --mode create
  python scripts/clarify_loop.py clarify init --mode create
  python scripts/clarify_loop.py clarify status
  python scripts/clarify_loop.py clarify parse --text "pr-description-builder"
  python scripts/clarify_loop.py clarify apply --id skill_name --value pr-description-builder
  python scripts/clarify_loop.py clarify confirm
  python scripts/clarify_loop.py clarify next
  python scripts/clarify_loop.py design init --from-clarify
  python scripts/clarify_loop.py build init --from-design
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import loop_guard  # noqa: E402
import requirement_parser  # noqa: E402
import state_manager  # noqa: E402


def _print_json(data: dict) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def _load_or_fail(phase: str) -> dict:
    try:
        return state_manager.load_phase_state(phase)
    except FileNotFoundError as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


def _bootstrap_clarify(mode: str) -> dict:
    """New session: clear all runtime states and start clarify."""
    state = state_manager.reset_runtime_states(mode)
    state = loop_guard.compute_clarify_next_action(state)
    state_manager.sync_clarify_record(state)
    state_manager.save_phase_state("clarify", state)
    return state


def cmd_session_reset(args: argparse.Namespace) -> None:
    clarify = _bootstrap_clarify(args.mode)
    design = state_manager.load_phase_state("design")
    build = state_manager.load_phase_state("build")
    _print_json(
        {
            "reset": True,
            "mode": args.mode,
            "clarify": clarify,
            "design": design,
            "build": build,
        }
    )


def cmd_clarify_init(args: argparse.Namespace) -> None:
    _print_json(_bootstrap_clarify(args.mode))


def cmd_clarify_status(_: argparse.Namespace) -> None:
    state = _load_or_fail("clarify")
    _print_json(state)


def cmd_clarify_apply(args: argparse.Namespace) -> None:
    state = _load_or_fail("clarify")
    state, err = requirement_parser.apply_answer(state, args.id, args.value)
    if err:
        print(json.dumps({"error": err}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    state["user_confirmed"] = False
    state_manager.sync_clarify_record(state)
    state = loop_guard.compute_clarify_next_action(state)
    state_manager.save_phase_state("clarify", state)
    _print_json(state)


def cmd_clarify_parse(args: argparse.Namespace) -> None:
    state = _load_or_fail("clarify")
    state, err = requirement_parser.parse_active_answer(state, args.text)
    if err:
        print(json.dumps({"error": err}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    state_manager.sync_clarify_record(state)
    state = loop_guard.compute_clarify_next_action(state)
    state_manager.save_phase_state("clarify", state)
    _print_json(state)


def cmd_clarify_confirm(_: argparse.Namespace) -> None:
    state = _load_or_fail("clarify")
    pending = loop_guard.get_pending_requirements(state.get("requirements", []))
    if pending:
        print(
            json.dumps(
                {
                    "error": "仍有未填必填项",
                    "pending_ids": [p["id"] for p in pending],
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        sys.exit(1)
    state["user_confirmed"] = True
    state_manager.sync_clarify_record(state)
    state = loop_guard.compute_clarify_next_action(state)
    state_manager.save_phase_state("clarify", state)
    _print_json(state)


def cmd_clarify_next(_: argparse.Namespace) -> None:
    state = _load_or_fail("clarify")
    state_manager.sync_clarify_record(state)
    state = loop_guard.compute_clarify_next_action(state)
    state_manager.save_phase_state("clarify", state)
    _print_json(state)


def cmd_design_init(args: argparse.Namespace) -> None:
    if args.from_clarify:
        clarify = _load_or_fail("clarify")
        if not loop_guard.check_exit_condition("clarify", clarify):
            print(
                json.dumps({"error": "clarify 未满足退出条件"}, ensure_ascii=False),
                file=sys.stderr,
            )
            sys.exit(1)
        state = state_manager.init_design_state(clarify)
    else:
        state = state_manager.load_phase_state("design") if Path(
            state_manager.meta_path("design_state.json")
        ).exists() else {
            "version": "2.5.0",
            "current_phase": "design",
            "design_record": {},
            "user_confirmed": False,
        }
    state = loop_guard.compute_design_next_action(state)
    state_manager.save_phase_state("design", state)
    _print_json(state)


def cmd_design_status(_: argparse.Namespace) -> None:
    _print_json(_load_or_fail("design"))


def cmd_design_update_doc(args: argparse.Namespace) -> None:
    state = _load_or_fail("design")
    record = state.setdefault("design_record", {})
    record["design_doc"] = args.doc
    if args.target_dir:
        record["target_dir"] = args.target_dir
    if args.file_plan:
        record["file_plan"] = [s.strip() for s in args.file_plan.split(",") if s.strip()]
    state["user_confirmed"] = False
    state = loop_guard.compute_design_next_action(state)
    state_manager.save_phase_state("design", state)
    _print_json(state)


def cmd_design_confirm(_: argparse.Namespace) -> None:
    state = _load_or_fail("design")
    doc = (state.get("design_record") or {}).get("design_doc", "")
    if not doc or not str(doc).strip():
        print(json.dumps({"error": "design_doc 为空"}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
    state["user_confirmed"] = True
    state = loop_guard.compute_design_next_action(state)
    state_manager.save_phase_state("design", state)
    _print_json(state)


def cmd_design_next(_: argparse.Namespace) -> None:
    state = _load_or_fail("design")
    state = loop_guard.compute_design_next_action(state)
    state_manager.save_phase_state("design", state)
    _print_json(state)


def cmd_build_init(args: argparse.Namespace) -> None:
    if args.from_design:
        design = _load_or_fail("design")
        if not loop_guard.check_exit_condition("design", design):
            print(
                json.dumps({"error": "design 未满足退出条件"}, ensure_ascii=False),
                file=sys.stderr,
            )
            sys.exit(1)
        state = state_manager.init_build_state(design)
    else:
        state = {
            "version": "2.5.0",
            "current_phase": "build",
            "build_record": {"files_planned": [], "files_done": [], "files_skipped": []},
            "user_confirmed": False,
        }
    state = loop_guard.compute_build_next_action(state)
    state_manager.save_phase_state("build", state)
    _print_json(state)


def cmd_build_status(_: argparse.Namespace) -> None:
    _print_json(_load_or_fail("build"))


def cmd_build_mark_done(args: argparse.Namespace) -> None:
    state = _load_or_fail("build")
    record = state.setdefault("build_record", {})
    done: list[str] = list(record.get("files_done") or [])
    if args.file_path not in done:
        done.append(args.file_path)
    record["files_done"] = done
    state = loop_guard.compute_build_next_action(state)
    state_manager.save_phase_state("build", state)
    _print_json(state)


def cmd_build_confirm(_: argparse.Namespace) -> None:
    state = _load_or_fail("build")
    state["user_confirmed"] = True
    state = loop_guard.compute_build_next_action(state)
    state_manager.save_phase_state("build", state)
    _print_json(state)


def cmd_build_next(_: argparse.Namespace) -> None:
    state = _load_or_fail("build")
    state = loop_guard.compute_build_next_action(state)
    state_manager.save_phase_state("build", state)
    _print_json(state)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="skill-builder phase loop runner")
    sub = parser.add_subparsers(dest="phase", required=True)

    session = sub.add_parser("session", help="会话级操作（激活时 reset）")
    ssub = session.add_subparsers(dest="command", required=True)
    p = ssub.add_parser("reset", help="清空三阶段运行时元数据并启动 clarify")
    p.add_argument("--mode", choices=["create", "iterate"], required=True)
    p.set_defaults(func=cmd_session_reset)

    clarify = sub.add_parser("clarify", help="clarify 阶段")
    csub = clarify.add_subparsers(dest="command", required=True)

    p = csub.add_parser("init")
    p.add_argument("--mode", choices=["create", "iterate"], required=True)
    p.set_defaults(func=cmd_clarify_init)

    p = csub.add_parser("status")
    p.set_defaults(func=cmd_clarify_status)

    p = csub.add_parser("apply")
    p.add_argument("--id", required=True)
    p.add_argument("--value", required=True)
    p.set_defaults(func=cmd_clarify_apply)

    p = csub.add_parser("parse")
    p.add_argument("--text", required=True)
    p.set_defaults(func=cmd_clarify_parse)

    p = csub.add_parser("confirm")
    p.set_defaults(func=cmd_clarify_confirm)

    p = csub.add_parser("next")
    p.set_defaults(func=cmd_clarify_next)

    design = sub.add_parser("design", help="design 阶段")
    dsub = design.add_subparsers(dest="command", required=True)

    p = dsub.add_parser("init")
    p.add_argument("--from-clarify", action="store_true")
    p.set_defaults(func=cmd_design_init)

    p = dsub.add_parser("status")
    p.set_defaults(func=cmd_design_status)

    p = dsub.add_parser("update-doc")
    p.add_argument("--doc", required=True)
    p.add_argument("--target-dir", default=None)
    p.add_argument("--file-plan", default=None, help="逗号分隔文件列表")
    p.set_defaults(func=cmd_design_update_doc)

    p = dsub.add_parser("confirm")
    p.set_defaults(func=cmd_design_confirm)

    p = dsub.add_parser("next")
    p.set_defaults(func=cmd_design_next)

    build = sub.add_parser("build", help="build 阶段")
    bsub = build.add_subparsers(dest="command", required=True)

    p = bsub.add_parser("init")
    p.add_argument("--from-design", action="store_true")
    p.set_defaults(func=cmd_build_init)

    p = bsub.add_parser("status")
    p.set_defaults(func=cmd_build_status)

    p = bsub.add_parser("mark-done")
    p.add_argument("--file-path", required=True)
    p.set_defaults(func=cmd_build_mark_done)

    p = bsub.add_parser("confirm")
    p.set_defaults(func=cmd_build_confirm)

    p = bsub.add_parser("next")
    p.set_defaults(func=cmd_build_next)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
