import time
from datetime import datetime, timezone

from .controller import RobotController
from .process_transport import ProcessTransport
from .protocol import (event_command, set_mode_command, ping_command,
                       get_config_command, set_config_command, reset_config_command)


def iso_now():
    return datetime.now(timezone.utc).isoformat()


class DeviceRuntime:
    def __init__(self, root, saved):
        self.root = root
        self.transport = ProcessTransport(root, saved.get("device"))
        self.controller = RobotController(self.transport)
        self.sequence = saved.get("sequence", 0)
        self.trace = saved.get("trace", [])
        self.trace_seq = saved.get("traceSeq", 0)
        self.started = saved.get("started", time.time())
        self.stats = saved.get("stats", dict(commandsSent=0, acceptedAcks=0,
            rejectedAcks=0, sensorEvents=0, receivedFrames=0, reboots=0))

    def record(self, direction, route, frame):
        self.trace_seq += 1
        self.trace.append(dict(seq=self.trace_seq, at=iso_now(),
                               direction=direction, route=route, frame=frame))
        self.trace = self.trace[-1000:]

    def receive(self):
        for frame in self.transport.last_frames:
            self.stats["receivedFrames"] += 1
            if frame["type"] == "ack":
                self.stats["acceptedAcks" if frame["accepted"] else "rejectedAcks"] += 1
            self.record("RX", "ESP32 → Pi", frame)

    def ensure_connected(self):
        if self.transport.process.poll() is not None:
            snapshot = self.transport.snapshot
            self.transport.close()
            self.transport = ProcessTransport(self.root, snapshot)
            self.controller = RobotController(self.transport)
            self.record("SYSTEM", "Python", {"event": "device_process_reconnected"})

    def action(self, action):
        self.ensure_connected()
        kind = action.get("type")
        if kind in {"touch", "long_press", "motion", "shake"}:
            self.stats["sensorEvents"] += 1
            self.record("SENSOR", "sensor → ESP32", {"type": "sensor", "event": kind})
            response = self.transport.request("sense", event=kind)
            self.receive()
            return response["result"]
        if kind == "reboot":
            self.transport.request("reboot")
            self.stats["reboots"] += 1
            self.record("SYSTEM", "ESP32", {"event": "virtual_reboot"})
            self.receive()
            return {"accepted": True}
        self.sequence += 1
        command_id = f"pi-{self.sequence:06d}"
        if kind == "set_mode":
            command = set_mode_command(action.get("mode"), command_id)
        elif kind == "ping":
            command = ping_command(command_id)
        elif kind == "get_config":
            command = get_config_command(command_id)
        elif kind == "set_config":
            command = set_config_command(action.get("key"), action.get("value"), command_id)
        elif kind == "reset_config":
            command = reset_config_command(command_id)
        elif kind == "raw":
            raw = action.get("raw")
            if not isinstance(raw, str) or len(raw) > 4096:
                raise ValueError("raw frame must be a string of at most 4096 characters")
            self.stats["commandsSent"] += 1
            self.record("TX", "Pi → ESP32", {"raw": raw})
            self.transport.request("command", line=raw)
            self.receive()
            return self.transport.last_frames[0]
        else:
            command = event_command(kind, command_id=command_id)
        self.stats["commandsSent"] += 1
        self.record("TX", "Pi → ESP32", command)
        result = self.controller.execute(command)
        self.receive()
        while self.controller.read_message() is not None:
            pass
        return result

    def tick(self):
        self.ensure_connected()
        self.transport.request("tick")
        self.receive()

    def state(self):
        state = self.transport.snapshot["state"]
        return dict(v=1, type="state", mode=state["mode"], expression=state["expression"],
                    alert_latched=state["alertLatched"], revision=state["revision"])

    def checkpoint(self):
        return dict(device=self.transport.snapshot, sequence=self.sequence,
                    trace=self.trace, traceSeq=self.trace_seq, started=self.started, stats=self.stats)

    def close(self):
        self.transport.close()
