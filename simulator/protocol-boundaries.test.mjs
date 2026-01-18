import test from "node:test";
import assert from "node:assert/strict";
import { VirtualEspDevice } from "./core/virtual-device.js";

for (const input of ["null", "[]", "123", '"text"', "false"]) {
  test(`non-object JSON is rejected without crashing: ${input}`, () => {
    const frames = new VirtualEspDevice(0).receive(input).map(JSON.parse);
    assert.equal(frames[0].accepted, false);
    assert.equal(frames[0].error, "missing_id");
  });
}
test("command IDs use the firmware 24-byte limit", () => {
  for (const [id, accepted] of [["x".repeat(24), true], ["x".repeat(25), false], ["狗".repeat(9), false]]) {
    const frame = JSON.parse(new VirtualEspDevice(0).receive(JSON.stringify({v:1,id,type:"ping"}))[0]);
    assert.equal(frame.accepted, accepted);
    if (!accepted) assert.equal(frame.error, "id_too_long");
  }
});
test("oversize frames reject and the next valid frame succeeds", () => {
  const device = new VirtualEspDevice(0);
  assert.equal(JSON.parse(device.receive("x".repeat(513))[0]).error, "frame_too_long");
  assert.equal(JSON.parse(device.receive(" ".repeat(512) + '{"id":"p","type":"ping"}')[0]).error, "frame_too_long");
  assert.equal(JSON.parse(device.receive('{"v":1,"id":"ok","type":"ping"}')[0]).accepted, true);
});
test("serial events cannot impersonate local touch inputs", () => {
  const frame = JSON.parse(new VirtualEspDevice(0).receive('{"v":1,"id":"a","type":"event","event":"touch"}')[0]);
  assert.equal(frame.error, "unknown_event");
});
