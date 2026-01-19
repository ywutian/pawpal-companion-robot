import test from "node:test";
import assert from "node:assert/strict";
import { VirtualEspDevice, VirtualPiSupervisor } from "./virtual-link.js";

test("mode command travels through NDJSON and returns ack plus state", () => {
  const messages = [];
  const pi = new VirtualPiSupervisor({ now: () => 100, onMessage: (message) => messages.push(message) });
  pi.connect();
  const frames = pi.sendMode("training");
  assert.equal(frames[0].type, "ack");
  assert.equal(frames[0].accepted, true);
  assert.equal(frames[1].mode, "training");
  assert.equal(messages.at(-1).revision, 1);
});

test("alert latch rejects a lower-priority Pi command with a real negative ack", () => {
  const pi = new VirtualPiSupervisor({ now: () => 200 });
  pi.connect();
  pi.sendEvent("alert_raised");
  const frames = pi.sendMode("companion");
  assert.deepEqual(frames, [
    { v: 1, type: "ack", id: "pi-002", accepted: false, error: "alert_latched" },
  ]);
  assert.equal(pi.device.state.mode, "alert");
});

test("local touch sensor changes device state and sends telemetry to Pi", () => {
  const pi = new VirtualPiSupervisor({ now: () => 300 });
  pi.connect();
  const result = pi.sense("touch");
  assert.equal(result.accepted, true);
  assert.equal(pi.device.state.mode, "companion");
  assert.equal(JSON.parse(result.frames[0]).type, "state");
});

test("invalid serial JSON returns a negative ack", () => {
  const device = new VirtualEspDevice(0);
  assert.deepEqual(JSON.parse(device.receive("not json", 0)[0]), {
    v: 1,
    type: "ack",
    id: "",
    accepted: false,
    error: "invalid_json",
  });
});

test("duplicate command replays cached ack without reapplying behavior", () => {
  const device = new VirtualEspDevice(0);
  const command = JSON.stringify({ v: 1, id: "retry-1", type: "set_mode", mode: "training" });
  const first = device.receive(command, 10).map(JSON.parse);
  const revision = device.state.revision;
  const second = device.receive(command, 20).map(JSON.parse);
  assert.equal(first[0].accepted, true);
  assert.equal(second[0].duplicate, true);
  assert.equal(second.length, 1);
  assert.equal(device.state.revision, revision);
});

test("ping confirms liveness and unsupported versions are rejected", () => {
  const device = new VirtualEspDevice(0);
  const ping = JSON.parse(device.receive('{"v":1,"id":"ping-1","type":"ping"}', 0)[0]);
  assert.equal(ping.accepted, true);
  const rejected = JSON.parse(device.receive('{"v":2,"id":"bad-v","type":"ping"}', 0)[0]);
  assert.equal(rejected.error, "unsupported_version");
});

test("NVS-style config and ack cache survive a virtual reboot", () => {
  const persistence = null;
  const device = new VirtualEspDevice(0, persistence);
  const setCommand = JSON.stringify({
    v: 1,
    id: "cfg-persist",
    type: "set_config",
    key: "motion_threshold_dps",
    value: 55,
  });
  const first = device.receive(setCommand, 10).map(JSON.parse);
  assert.equal(first[0].accepted, true);
  assert.equal(first[1].motion_threshold_dps, 55);
  const rebooted = new VirtualEspDevice(20, device.persistence);
  const duplicate = rebooted.receive(setCommand, 30).map(JSON.parse);
  assert.equal(duplicate[0].duplicate, true);
  assert.equal(rebooted.persistence.config.motion_threshold_dps, 55);
});

test("stress run keeps revisions monotonic across 1000 bounded commands", () => {
  const device = new VirtualEspDevice(0);
  let lastRevision = 0;
  for (let index = 0; index < 1000; index += 1) {
    const mode = index % 2 === 0 ? "training" : "monitoring";
    const frames = device
      .receive(JSON.stringify({ v: 1, id: `stress-${index}`, type: "set_mode", mode }), index)
      .map(JSON.parse);
    const state = frames.find((frame) => frame.type === "state");
    assert.ok(state.revision >= lastRevision);
    lastRevision = state.revision;
  }
  assert.equal(device.ackCache.size, 8);
});

test("supervisor diagnostics count malformed frames and reboot recovery", () => {
  const pi = new VirtualPiSupervisor({ now: () => 500 });
  pi.connect();
  const frames = pi.sendRaw("not-json");
  assert.equal(frames[0].error, "invalid_json");
  assert.equal(pi.metrics().rejectedAcks, 1);
  pi.sendMode("training");
  pi.reboot();
  assert.equal(pi.device.state.mode, "idle");
  assert.equal(pi.metrics().reboots, 1);
  assert.equal(pi.trace.at(-2).frame.event, "virtual_reboot");
});
