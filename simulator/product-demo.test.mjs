import assert from "node:assert/strict";
import test from "node:test";
import { createProductDemo } from "./product-demo.js";

function harness() {
  const button = { textContent: "Run product demo" };
  const actions = [];
  const waits = [];
  const run = createProductDemo(button, (action) => actions.push(action), {
    delay: (_, signal) => new Promise((resolve, reject) => {
      const cancel = () => reject(signal.reason);
      signal.addEventListener("abort", cancel, { once: true });
      waits.push(() => {
        signal.removeEventListener("abort", cancel);
        resolve();
      });
    }),
  });
  return { button, actions, waits, run };
}

test("product demo executes all nine steps and restores its button", async () => {
  const { button, actions, waits, run } = harness();
  const result = run();
  await Promise.resolve();
  assert.equal(button.textContent, "Stop demo");
  for (let index = 0; index < 9; index += 1) {
    assert.equal(actions.length, index + 1);
    waits.shift()();
    await Promise.resolve();
    await Promise.resolve();
  }
  await result;
  assert.deepEqual(actions.map((action) => action.type), [
    "set_mode", "touch", "set_mode", "training_success", "set_mode",
    "alert_raised", "touch", "set_mode", "alert_cleared",
  ]);
  assert.equal(button.textContent, "Run product demo");
});

test("stop prevents the next demo step", async () => {
  const { button, actions, run } = harness();
  const result = run();
  await run();
  await result;
  assert.equal(actions.length, 1);
  assert.equal(button.textContent, "Run product demo");
});

test("a cancelled run cannot reset a rapid restart", async () => {
  const { button, actions, run } = harness();
  const first = run();
  const stop = run();
  const second = run();
  await Promise.all([first, stop]);
  assert.equal(button.textContent, "Stop demo");
  assert.equal(actions.length, 2);
  await run();
  await second;
  assert.equal(button.textContent, "Run product demo");
});

test("a dispatch failure restores the button and remains observable", async () => {
  const button = { textContent: "Run product demo" };
  const run = createProductDemo(button, () => { throw new Error("dispatch failed"); });
  await assert.rejects(run(), /dispatch failed/);
  assert.equal(button.textContent, "Run product demo");
});
