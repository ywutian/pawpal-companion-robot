"""Deterministic synthetic fixtures, not camera inference or live pet observations."""
from copy import deepcopy
from uuid import uuid4

from .runtime import iso_now

FIXTURES = {
    "companion": {
        "mode": "companion", "rule": "A touch rising edge triggers a companion response.",
        "samples": [{"touch": False}, {"touch": True}, {"touch": True}, {"touch": False}],
    },
    "training": {
        "mode": "training", "rule": "Three consecutive sit samples with confidence ≥ 0.8.",
        "samples": [{"pose": "stand", "confidence": .95}, {"pose": "sit", "confidence": .55},
                    {"pose": "sit", "confidence": .91}, {"pose": "sit", "confidence": .93},
                    {"pose": "sit", "confidence": .94}],
    },
    "monitoring": {
        "mode": "monitoring", "rule": "Three consecutive activity scores ≥ 0.8 raise a latched alert.",
        "samples": [{"activity": .2}, {"activity": .9}, {"activity": .3},
                    {"activity": .85}, {"activity": .91}, {"activity": .95},
                    {"activity": .15}],
    },
}


class ScenarioRunner:
    def __init__(self, runtime, runs=None):
        self.runtime = runtime
        self.runs = runs or []

    @property
    def active(self):
        return next((run for run in self.runs if run["status"] in
                     {"running", "awaiting_confirmation"}), None)

    def apply(self, action):
        result = self.runtime.action(action)
        if not result.get("accepted"):
            raise ValueError(result.get("error", result.get("reason", "action rejected")))
        return result

    def start(self, name, now):
        if name not in FIXTURES:
            raise ValueError("unknown scenario")
        if self.active or self.runtime.state()["alert_latched"]:
            raise ValueError("finish or acknowledge the current run/alert first")
        fixture = deepcopy(FIXTURES[name])
        self.apply({"type": "set_mode", "mode": fixture["mode"]})
        run = dict(id=uuid4().hex[:12], name=name, source="synthetic fixture v1",
                   rule=fixture["rule"], samples=fixture["samples"], timeline=[],
                   status="running", cursor=0, streak=0, triggered=False,
                   startedAt=iso_now(), nextAt=now, interval=.6, outcome=None)
        self.runs.insert(0, run)
        self.runs = self.runs[:100]
        return run

    def advance(self, now):
        run = self.active
        if not run or run["status"] != "running":
            return
        # After a restart, catch up deterministically from the saved cursor.
        while run["cursor"] < len(run["samples"]) and now >= run["nextAt"]:
            sample = run["samples"][run["cursor"]]
            event = None
            if run["name"] == "companion":
                previous = run["samples"][run["cursor"] - 1] if run["cursor"] else {}
                if sample["touch"] and not previous.get("touch"):
                    event = "touch"
            else:
                qualifies = (sample.get("activity", 0) >= .8 if run["name"] == "monitoring"
                             else sample.get("pose") == "sit" and sample.get("confidence", 0) >= .8)
                run["streak"] = run["streak"] + 1 if qualifies else 0
                if run["streak"] >= 3 and not run["triggered"]:
                    event = "alert_raised" if run["name"] == "monitoring" else "training_success"
            if event:
                self.apply({"type": event})
                run["triggered"] = True
            entry = dict(index=run["cursor"] + 1, sample=sample, streak=run["streak"],
                         event=event, result="triggered" if event else "observed",
                         state=self.runtime.state(), at=iso_now())
            run["timeline"].append(entry)
            self.runtime.record("INPUT", "fixture → Python rule", entry)
            run["cursor"] += 1
            run["nextAt"] += run["interval"]
        if run["cursor"] == len(run["samples"]):
            run["status"] = ("awaiting_confirmation" if run["name"] == "monitoring"
                             and run["triggered"] else "completed")
            run["outcome"] = "alert awaiting owner confirmation" if run["status"] == "awaiting_confirmation" else "feedback delivered"
            run["finishedAt"] = iso_now()

    def confirm(self, run_id):
        run = next((item for item in self.runs if item["id"] == run_id), None)
        if run and run["status"] == "acknowledged":
            return run
        if not run or run["status"] != "awaiting_confirmation":
            raise ValueError("this run is not awaiting confirmation")
        self.apply({"type": "alert_cleared"})
        run.update(status="acknowledged", confirmedAt=iso_now(),
                   outcome="owner confirmed; returned to monitoring")
        self.runtime.record("OWNER", "owner → Python", {"event": "alert_confirmed", "run_id": run_id})
        return run

    def stop(self):
        run = self.active
        if not run:
            return
        if self.runtime.state()["alert_latched"]:
            raise ValueError("an active alert must be acknowledged, not cancelled")
        self.apply({"type": "set_mode", "mode": "idle"})
        run.update(status="cancelled", finishedAt=iso_now(), outcome="stopped by user")
