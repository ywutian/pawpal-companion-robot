import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import test from "node:test";
import { abortableDelay } from "./core/abortable-delay.js";

function fakeTimers() {
  const pending = new Map();
  let sequence = 0;
  return {
    pending,
    setTimeout(callback) {
      const id = ++sequence;
      pending.set(id, callback);
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    fire() {
      const [id, callback] = pending.entries().next().value;
      pending.delete(id);
      callback();
    },
  };
}

test("delay removes its abort listener after completion", async () => {
  const controller = new AbortController();
  const timers = fakeTimers();
  const result = abortableDelay(100, controller.signal, timers);
  assert.equal(getEventListeners(controller.signal, "abort").length, 1);
  timers.fire();
  await result;
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  assert.equal(timers.pending.size, 0);
});

test("aborting a delay clears the timer and listener", async () => {
  const controller = new AbortController();
  const timers = fakeTimers();
  const result = abortableDelay(100, controller.signal, timers);
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.equal(timers.pending.size, 0);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("an already aborted signal does not schedule a timer", async () => {
  const controller = new AbortController();
  const timers = fakeTimers();
  controller.abort();
  await assert.rejects(abortableDelay(100, controller.signal, timers), { name: "AbortError" });
  assert.equal(timers.pending.size, 0);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});
