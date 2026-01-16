from __future__ import annotations

import time
from collections import deque
from typing import Any

from .protocol import (
    decode_message,
    encode_message,
    event_command,
    get_config_command,
    ping_command,
    reset_config_command,
    set_config_command,
    set_mode_command,
)
from .transport import Transport


class RobotController:
    def __init__(self, transport: Transport):
        self._transport = transport
        self._inbox: deque[dict[str, Any]] = deque()

    def send(self, command: dict[str, Any]) -> None:
        self._transport.write(encode_message(command))

    def set_mode(self, mode: str) -> dict[str, Any]:
        command = set_mode_command(mode)
        self.send(command)
        return command

    def event(self, event: str, intensity: float = 0.0) -> dict[str, Any]:
        command = event_command(event, intensity)
        self.send(command)
        return command

    def ping(self) -> dict[str, Any]:
        command = ping_command()
        self.send(command)
        return command

    def get_config(self) -> dict[str, Any]:
        command = get_config_command()
        self.send(command)
        return command

    def set_config(self, key: str, value: float) -> dict[str, Any]:
        command = set_config_command(key, value)
        self.send(command)
        return command

    def reset_config(self) -> dict[str, Any]:
        command = reset_config_command()
        self.send(command)
        return command

    def read_message(self) -> dict[str, Any] | None:
        if self._inbox:
            return self._inbox.popleft()
        line = self._transport.readline()
        return decode_message(line) if line else None

    def wait_for_ack(self, command_id: str, timeout: float = 2.0) -> dict[str, Any]:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            line = self._transport.readline()
            message = decode_message(line) if line else None
            if message and message.get("type") == "ack" and message.get("id") == command_id:
                return message
            if message:
                self._inbox.append(message)
            else:
                time.sleep(0.005)
        raise TimeoutError(f"no acknowledgement for command {command_id}")

    def execute(
        self,
        command: dict[str, Any],
        *,
        timeout: float = 0.5,
        retries: int = 2,
    ) -> dict[str, Any]:
        """Send one idempotent command, retrying with the same command ID."""
        if retries < 0:
            raise ValueError("retries must be non-negative")
        command_id = str(command["id"])
        for attempt in range(retries + 1):
            self.send(command)
            try:
                return self.wait_for_ack(command_id, timeout)
            except TimeoutError:
                if attempt == retries:
                    raise
        raise AssertionError("unreachable")

    def close(self) -> None:
        self._transport.close()
