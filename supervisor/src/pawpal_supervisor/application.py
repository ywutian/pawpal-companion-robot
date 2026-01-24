from copy import deepcopy
import threading
import time

from .runtime import DeviceRuntime, iso_now
from .scenarios import ScenarioRunner
from .store import StateStore


class Application:
    def __init__(self, root, database):
        self.root = root
        self.lock = threading.RLock()
        self.store = StateStore(database)
        saved = self.store.load() or {}
        try:
            self.runtime = DeviceRuntime(root, saved)
        except Exception:
            self.store.close()
            raise
        self.runner = ScenarioRunner(self.runtime, saved.get("runs", []))
        self.request_ids = saved.get("requestIds", {})
        self.version = saved.get("version", 0)
        self.error = None
        self.save()

    def save(self):
        payload = deepcopy({**self.runtime.checkpoint(), "schema": 1, "version": self.version + 1,
                            "runs": self.runner.runs, "requestIds": self.request_ids})
        try:
            self.store.save(payload)
        except Exception:
            # The device is a software process: roll it back with the failed transaction.
            if hasattr(self, "_durable"):
                saved = deepcopy(self._durable)
                self.runtime.close()
                self.runtime = DeviceRuntime(self.root, saved)
                self.runner = ScenarioRunner(self.runtime, saved["runs"])
                self.request_ids = saved["requestIds"]
            raise
        self.version = payload["version"]
        self._durable = payload

    def tick(self):
        with self.lock:
            before = self.runtime.trace_seq
            self.runtime.tick()
            self.runner.advance(time.time())
            if before != self.runtime.trace_seq:
                self.save()
            self.error = None

    def status(self):
        with self.lock:
            self.tick()
            return deepcopy(dict(
                project="PawPal Companion Robot",
                environment="Python supervisor + virtual ESP32 process",
                scope="local software demonstration with synthetic input fixtures",
                generatedAt=iso_now(), version=self.version, finalState=self.runtime.state(),
                metrics={**self.runtime.stats,
                         "uptimeMs": int((time.time() - self.runtime.started) * 1000)},
                trace=self.runtime.trace, runs=self.runner.runs,
                activeRun=self.runner.active, config=self.runtime.transport.snapshot["persistence"],
                retention={"runs": 100, "trace": 1000}, connected=True,
            ))

    def mutate(self, path, body):
        with self.lock:
            request_id = body.get("requestId")
            if not isinstance(request_id, str) or not 1 <= len(request_id) <= 100:
                raise ValueError("requestId is required (1–100 characters)")
            signature = {key: value for key, value in body.items() if key != "requestId"}
            if request_id in self.request_ids:
                if self.request_ids[request_id] != [path, signature]:
                    raise ValueError("requestId was already used for a different operation")
                return self.status()
            self.tick()
            if path == "/api/scenario":
                self.runner.start(body.get("name"), time.time())
            elif path == "/api/confirm":
                self.runner.confirm(body.get("runId"))
            elif path == "/api/stop":
                self.runner.stop()
            elif path == "/api/reset-history":
                if self.runner.active or self.runtime.state()["alert_latched"]:
                    raise ValueError("finish or acknowledge the active run before resetting")
                self.runtime.action({"type": "set_mode", "mode": "idle"})
                self.runner.runs.clear()
                self.runtime.trace.clear()
                self.runtime.stats = dict(commandsSent=0, acceptedAcks=0,
                    rejectedAcks=0, sensorEvents=0, receivedFrames=0, reboots=0)
                self.runtime.started = time.time()
                self.runtime.record("SYSTEM", "Python", {"event": "demo_history_reset"})
            elif path == "/api/action":
                action = body.get("action")
                if not isinstance(action, dict):
                    raise ValueError("action must be an object")
                if self.runner.active and action.get("type") not in {"ping", "get_config"}:
                    raise ValueError("finish the active scenario before using manual controls")
                if action.get("type") == "test_persistence":
                    self.runtime.action({"type": "set_config", "key": "motion_threshold_dps", "value": 55})
                    self.runtime.action({"type": "reboot"})
                    self.runtime.action({"type": "get_config"})
                    if self.runtime.transport.snapshot["persistence"]["config"]["motion_threshold_dps"] != 55:
                        raise RuntimeError("persistence verification failed")
                    self.runtime.record("SYSTEM", "Python", {"event": "NVS persistence verified across reboot"})
                else:
                    self.runtime.action(action)
            else:
                raise ValueError("unknown API route")
            self.request_ids[request_id] = [path, signature]
            self.request_ids = dict(list(self.request_ids.items())[-200:])
            self.save()
            return self.status()

    def close(self):
        with self.lock:
            self.runtime.close()
            self.store.close()
