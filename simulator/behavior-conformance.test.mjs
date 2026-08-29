import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { initialState, tick, transition } from "./state-machine.js";
import { ERROR_CODES } from "./core/protocol-frames.js";

// Replays the shared fixture that firmware/test/test_conformance also replays,
// so the JS and C++ behavior implementations cannot drift.
const FIXTURE_URL = new URL(
  "../firmware/test/test_conformance/behavior_conformance.txt",
  import.meta.url,
);

test("state machine replays the shared conformance fixture", () => {
  let state = initialState(0);
  let steps = 0;
  for (const raw of readFileSync(FIXTURE_URL, "utf8").split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const [at, op, arg, expect, mode, expression, revision] = line.split(/\s+/);
    steps += 1;

    let accepted = true;
    let reason;
    if (op === "tick") {
      state = tick(state, Number(at));
    } else {
      const action = op === "mode" ? { type: "set_mode", mode: arg } : { type: arg };
      const result = transition(state, action, Number(at));
      state = result.state;
      accepted = result.accepted;
      reason = result.reason;
    }

    if (expect.startsWith("reject:")) {
      assert.equal(accepted, false, line);
      assert.equal(ERROR_CODES[reason], expect.slice(7), line);
    } else {
      assert.equal(accepted, true, line);
    }
    assert.equal(state.mode, mode, line);
    assert.equal(state.expression, expression, line);
    assert.equal(state.revision, Number(revision), line);
  }
  assert.ok(steps >= 20, "fixture unexpectedly short");
});
