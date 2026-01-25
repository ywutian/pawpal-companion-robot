from pathlib import Path
from tempfile import TemporaryDirectory
import time
import unittest
from unittest.mock import patch
import sqlite3

from pawpal_supervisor.application import Application

ROOT = Path(__file__).resolve().parents[2]


class ApplicationTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory()
        self.database = Path(self.directory.name) / "state.sqlite3"
        self.app = Application(ROOT, self.database)
        self.counter = 0

    def tearDown(self):
        self.app.close()
        self.directory.cleanup()

    def mutate(self, route, **body):
        self.counter += 1
        return self.app.mutate(route, {"requestId": str(self.counter), **body})

    def finish_replay(self):
        with self.app.lock:
            self.app.runner.advance(time.time() + 20)
            self.app.save()
        return self.app.status()

    def test_python_controller_sends_to_separate_device_process(self):
        result = self.mutate("/api/action", action={"type": "set_mode", "mode": "training"})
        self.assertEqual(result["finalState"]["mode"], "training")
        self.assertTrue(any(row["direction"] == "TX" for row in result["trace"]))
        self.assertTrue(any(row["frame"].get("type") == "ack" for row in result["trace"]))

    def test_monitoring_requires_confirmation_and_survives_restart(self):
        self.mutate("/api/scenario", name="monitoring")
        result = self.finish_replay()
        run = result["activeRun"]
        self.assertEqual(run["status"], "awaiting_confirmation")
        self.assertTrue(result["finalState"]["alert_latched"])
        self.assertEqual(sum(bool(row["event"]) for row in run["timeline"]), 1)
        self.assertEqual(run["timeline"][2]["streak"], 0)  # isolated spike rejected
        self.app.close()
        self.app = Application(ROOT, self.database)
        self.assertEqual(self.app.status()["activeRun"]["id"], run["id"])
        self.assertTrue(self.app.status()["finalState"]["alert_latched"])
        confirmed = self.mutate("/api/confirm", runId=run["id"])
        self.assertIsNone(confirmed["activeRun"])
        self.assertEqual(confirmed["runs"][0]["status"], "acknowledged")
        self.assertEqual(confirmed["finalState"]["mode"], "monitoring")
        again = self.mutate("/api/confirm", runId=run["id"])
        self.assertEqual(again["metrics"]["commandsSent"], confirmed["metrics"]["commandsSent"])

    def test_companion_and_training_feedback_are_saved(self):
        for name, event in [("companion", "touch"), ("training", "training_success")]:
            self.mutate("/api/scenario", name=name)
            run = self.finish_replay()["runs"][0]
            self.assertEqual(run["status"], "completed")
            self.assertEqual([item["event"] for item in run["timeline"] if item["event"]], [event])

    def test_active_run_blocks_manual_override_and_alert_cancellation(self):
        self.mutate("/api/scenario", name="monitoring")
        with self.assertRaises(ValueError):
            self.mutate("/api/action", action={"type": "set_mode", "mode": "idle"})
        self.finish_replay()
        with self.assertRaises(ValueError):
            self.mutate("/api/stop")

    def test_cancel_stops_replay_and_returns_idle(self):
        self.mutate("/api/scenario", name="training")
        result = self.mutate("/api/stop")
        self.assertEqual(result["runs"][0]["status"], "cancelled")
        self.assertEqual(result["finalState"]["mode"], "idle")
        self.assertIsNone(result["activeRun"])

    def test_idempotent_start_and_conflicting_request_id(self):
        body = {"requestId": "unique", "name": "training"}
        first = self.app.mutate("/api/scenario", body)
        second = self.app.mutate("/api/scenario", body)
        self.assertEqual(first["activeRun"]["id"], second["activeRun"]["id"])
        self.assertEqual(len(second["runs"]), 1)
        with self.assertRaises(ValueError):
            self.app.mutate("/api/scenario", {**body, "name": "monitoring"})

    def test_reset_history_is_scoped_and_requires_no_active_alert(self):
        self.mutate("/api/scenario", name="companion")
        self.finish_replay()
        result = self.mutate("/api/reset-history")
        self.assertEqual(result["runs"], [])
        self.assertEqual(result["finalState"]["mode"], "idle")
        self.assertEqual(result["metrics"]["commandsSent"], 0)
        self.assertEqual(result["trace"][0]["frame"]["event"], "demo_history_reset")
        self.mutate("/api/scenario", name="monitoring")
        self.finish_replay()
        with self.assertRaises(ValueError):
            self.mutate("/api/reset-history")

    def test_device_disconnect_recovers_state_and_records_it(self):
        self.mutate("/api/action", action={"type": "set_mode", "mode": "training"})
        self.app.runtime.transport.process.kill()
        self.app.runtime.transport.process.wait()
        result = self.app.status()
        self.assertEqual(result["finalState"]["mode"], "training")
        self.assertTrue(any(row["frame"].get("event") == "device_process_reconnected" for row in result["trace"]))

    def test_invalid_raw_frame_is_rejected_without_stopping_service(self):
        result = self.mutate("/api/action", action={"type": "raw", "raw": "null"})
        self.assertEqual(result["metrics"]["rejectedAcks"], 1)
        result = self.mutate("/api/action", action={"type": "ping"})
        self.assertEqual(result["metrics"]["acceptedAcks"], 1)

    def test_failed_save_does_not_falsely_confirm_alert(self):
        self.mutate("/api/scenario", name="monitoring")
        run = self.finish_replay()["activeRun"]
        with patch.object(self.app.store, "save", side_effect=sqlite3.OperationalError("disk full")):
            with self.assertRaises(sqlite3.OperationalError):
                self.mutate("/api/confirm", runId=run["id"])
        result = self.app.status()
        self.assertEqual(result["activeRun"]["status"], "awaiting_confirmation")
        self.assertTrue(result["finalState"]["alert_latched"])
        confirmed = self.mutate("/api/confirm", runId=run["id"])
        self.assertEqual(confirmed["runs"][0]["status"], "acknowledged")
