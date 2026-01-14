from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

PROTOCOL_VERSION = 1
VALID_MODES = {"idle", "companion", "training", "monitoring", "alert", "error"}
VALID_EVENTS = {"training_success", "alert_raised", "alert_cleared", "motion", "shake"}


@dataclass(frozen=True)
class RobotState:
    mode: str
    expression: str
    alert_latched: bool
    revision: int


def _command_id() -> str:
    return uuid4().hex[:12]


def set_mode_command(mode: str, command_id: str | None = None) -> dict[str, Any]:
    if mode not in VALID_MODES:
        raise ValueError(f"unknown mode: {mode}")
    return {
        "v": PROTOCOL_VERSION,
        "id": command_id or _command_id(),
        "type": "set_mode",
        "mode": mode,
    }


def event_command(
    event: str, intensity: float = 0.0, command_id: str | None = None
) -> dict[str, Any]:
    if event not in VALID_EVENTS:
        raise ValueError(f"unknown event: {event}")
    return {
        "v": PROTOCOL_VERSION,
        "id": command_id or _command_id(),
        "type": "event",
        "event": event,
        "intensity": intensity,
    }


def ping_command(command_id: str | None = None) -> dict[str, Any]:
    return {"v": PROTOCOL_VERSION, "id": command_id or _command_id(), "type": "ping"}


def get_config_command(command_id: str | None = None) -> dict[str, Any]:
    return {
        "v": PROTOCOL_VERSION,
        "id": command_id or _command_id(),
        "type": "get_config",
    }


def set_config_command(
    key: str, value: float, command_id: str | None = None
) -> dict[str, Any]:
    if key not in {"motion_threshold_dps", "shake_threshold_dps"}:
        raise ValueError(f"unknown config: {key}")
    return {
        "v": PROTOCOL_VERSION,
        "id": command_id or _command_id(),
        "type": "set_config",
        "key": key,
        "value": float(value),
    }


def reset_config_command(command_id: str | None = None) -> dict[str, Any]:
    return {
        "v": PROTOCOL_VERSION,
        "id": command_id or _command_id(),
        "type": "reset_config",
    }


def encode_message(message: dict[str, Any]) -> bytes:
    return (json.dumps(message, separators=(",", ":")) + "\n").encode("utf-8")


def decode_message(line: bytes | str) -> dict[str, Any]:
    text = line.decode("utf-8") if isinstance(line, bytes) else line
    value = json.loads(text)
    if not isinstance(value, dict) or "type" not in value:
        raise ValueError("message must be an object with a type")
    version = value.get("v", PROTOCOL_VERSION)
    if version != PROTOCOL_VERSION:
        raise ValueError(f"unsupported protocol version: {version}")
    return value


def parse_state(message: dict[str, Any]) -> RobotState:
    if message.get("type") != "state":
        raise ValueError("not a state message")
    return RobotState(
        mode=str(message["mode"]),
        expression=str(message["expression"]),
        alert_latched=bool(message["alert_latched"]),
        revision=int(message["revision"]),
    )
