import assert from "node:assert/strict";
import test from "node:test";

import { initialState, tick, transition } from "./state-machine.js";

test("touch enters companion mode and returns to its base expression", () => {
  const result = transition(initialState(0), { type: "touch" }, 100);
  assert.equal(result.accepted, true);
  assert.equal(result.state.mode, "companion");
  assert.equal(result.state.expression, "happy");
  assert.equal(tick(result.state, 2600).expression, "curious");
});

test("training success is rejected outside training mode", () => {
  const result = transition(initialState(0), { type: "training_success" }, 100);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "Training is not active");
});

test("alert latch blocks lower priority events", () => {
  const alert = transition(initialState(0), { type: "alert_raised" }, 100).state;
  const touch = transition(alert, { type: "touch" }, 200);
  assert.equal(touch.accepted, false);
  assert.equal(touch.state.mode, "alert");
  const cleared = transition(alert, { type: "alert_cleared" }, 300);
  assert.equal(cleared.accepted, true);
  assert.equal(cleared.state.mode, "monitoring");
});

