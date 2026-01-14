import json
import random
import string
import unittest

from pawpal_supervisor.protocol import (
    decode_message,
    encode_message,
    event_command,
    get_config_command,
    parse_state,
    ping_command,
    reset_config_command,
    set_config_command,
    set_mode_command,
)


class ProtocolTests(unittest.TestCase):
    def test_set_mode_round_trip(self):
        command = set_mode_command("training", "cmd-1")
        self.assertEqual(1, command["v"])
        self.assertEqual(command, decode_message(encode_message(command)))

    def test_rejects_unknown_mode(self):
        with self.assertRaises(ValueError):
            set_mode_command("dancing")

    def test_event_is_compact_newline_delimited_json(self):
        payload = encode_message(event_command("alert_raised", 0.8, "cmd-2"))
        self.assertTrue(payload.endswith(b"\n"))
        self.assertNotIn(b" ", payload)
        self.assertEqual("alert_raised", json.loads(payload)["event"])

    def test_parse_state(self):
        state = parse_state(
            {
                "type": "state",
                "mode": "monitoring",
                "expression": "sleepy",
                "alert_latched": False,
                "revision": 8,
            }
        )
        self.assertEqual("monitoring", state.mode)
        self.assertEqual(8, state.revision)

    def test_ping_has_protocol_version_and_id(self):
        command = ping_command("health-1")
        self.assertEqual({"v": 1, "id": "health-1", "type": "ping"}, command)

    def test_config_commands_are_versioned_and_bounded(self):
        self.assertEqual("get_config", get_config_command("cfg-1")["type"])
        command = set_config_command("motion_threshold_dps", 55, "cfg-2")
        self.assertEqual(55.0, command["value"])
        self.assertEqual("reset_config", reset_config_command("cfg-3")["type"])
        with self.assertRaises(ValueError):
            set_config_command("unknown", 1)

    def test_rejects_unsupported_protocol_version(self):
        with self.assertRaisesRegex(ValueError, "unsupported protocol version"):
            decode_message('{"v":2,"type":"state"}')

    def test_decoder_fuzz_never_returns_non_object(self):
        rng = random.Random(8259)
        alphabet = string.printable
        for _ in range(500):
            payload = "".join(rng.choice(alphabet) for _ in range(rng.randrange(0, 80)))
            try:
                decoded = decode_message(payload)
            except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
                continue
            self.assertIsInstance(decoded, dict)


if __name__ == "__main__":
    unittest.main()
