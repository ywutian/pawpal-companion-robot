from __future__ import annotations

from collections import deque
from typing import Protocol


class Transport(Protocol):
    def write(self, payload: bytes) -> None: ...

    def readline(self) -> bytes: ...

    def close(self) -> None: ...


class SerialTransport:
    def __init__(self, port: str, baudrate: int = 115200, timeout: float = 1.0):
        try:
            import serial
        except ModuleNotFoundError as error:
            raise RuntimeError(
                "serial hardware support is not installed; "
                "run: python -m pip install -e 'supervisor[hardware]'"
            ) from error

        self._serial = serial.Serial(port, baudrate=baudrate, timeout=timeout)

    def write(self, payload: bytes) -> None:
        self._serial.write(payload)
        self._serial.flush()

    def readline(self) -> bytes:
        return self._serial.readline()

    def close(self) -> None:
        self._serial.close()


class RecordingTransport:
    """No-hardware transport used by the demo and tests."""

    def __init__(self):
        self.writes: list[bytes] = []
        self.responses: deque[bytes] = deque()

    def write(self, payload: bytes) -> None:
        self.writes.append(payload)

    def readline(self) -> bytes:
        return self.responses.popleft() if self.responses else b""

    def close(self) -> None:
        return None
