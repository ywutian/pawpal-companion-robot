"""Actual Python supervisor → NDJSON → reusable JS device model process."""
from collections import deque
import json
import os
from pathlib import Path
import select
import subprocess


class ProcessTransport:
    def __init__(self, root: Path, snapshot=None):
        self.process = subprocess.Popen(
            [os.environ.get("PAWPAL_NODE", "node"), str(root / "simulator/device-worker.mjs")],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1,
        )
        self.responses = deque()
        self.snapshot = None
        self.last_frames = []
        try:
            self.request("restore", snapshot=snapshot)
        except Exception:
            self.close()
            raise

    def request(self, op, **fields):
        if self.process.poll() is not None:
            raise ConnectionError("virtual device process disconnected")
        self.process.stdin.write(json.dumps({"op": op, **fields}) + "\n")
        self.process.stdin.flush()
        if not select.select([self.process.stdout], [], [], 3)[0]:
            self.process.kill()
            self.process.wait()
            raise TimeoutError("virtual device response timed out")
        line = self.process.stdout.readline()
        if not line:
            raise ConnectionError("virtual device process disconnected")
        response = json.loads(line)
        if "error" in response:
            raise ValueError(response["error"])
        self.snapshot = response["snapshot"]
        self.last_frames = [json.loads(frame) for frame in response["frames"]]
        return response

    def write(self, payload):
        response = self.request("command", line=payload.decode("utf-8"))
        self.responses.extend(frame.encode("utf-8") for frame in response["frames"])

    def readline(self):
        return self.responses.popleft() if self.responses else b""

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.process.stdin.close()
        self.process.stdout.close()
