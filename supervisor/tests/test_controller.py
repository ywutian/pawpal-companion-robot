import json
import unittest
from collections import deque

from pawpal_supervisor.controller import RobotController
from pawpal_supervisor.protocol import encode_message, set_mode_command


class RetryTransport:
    def __init__(self):
        self.writes = []
        self.responses = deque()

    def write(self, payload):
        self.writes.append(payload)
        if len(self.writes) == 2:
            command = json.loads(payload)
            self.responses.append(
                encode_message(
                    {
                        "v": 1,
                        "type": "ack",
                        "id": command["id"],
                        "accepted": True,
                        "duplicate": True,
                    }
                )
            )

    def readline(self):
        return self.responses.popleft() if self.responses else b""

    def close(self):
        return None


class ControllerTests(unittest.TestCase):
    def test_execute_retries_with_same_command_id(self):
        transport = RetryTransport()
        controller = RobotController(transport)
        command = set_mode_command("training", "stable-id")
        ack = controller.execute(command, timeout=0.01, retries=1)
        self.assertTrue(ack["accepted"])
        self.assertTrue(ack["duplicate"])
        self.assertEqual(2, len(transport.writes))
        self.assertEqual(transport.writes[0], transport.writes[1])

    def test_wait_for_ack_preserves_state_telemetry(self):
        transport = RetryTransport()
        transport.responses.extend(
            [
                encode_message(
                    {
                        "v": 1,
                        "type": "state",
                        "mode": "idle",
                        "expression": "neutral",
                        "alert_latched": False,
                        "revision": 0,
                    }
                ),
                encode_message(
                    {"v": 1, "type": "ack", "id": "cmd-1", "accepted": True}
                ),
            ]
        )
        controller = RobotController(transport)
        ack = controller.wait_for_ack("cmd-1", timeout=0.05)
        self.assertTrue(ack["accepted"])
        self.assertEqual("state", controller.read_message()["type"])


if __name__ == "__main__":
    unittest.main()
