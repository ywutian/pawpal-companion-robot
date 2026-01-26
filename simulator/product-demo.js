import { abortableDelay } from "./core/abortable-delay.js";

const STEPS = Object.freeze([
  [{ type: "set_mode", mode: "companion" }, "companion mode", 800],
  [{ type: "touch" }, "touch", 1400],
  [{ type: "set_mode", mode: "training" }, "training mode", 900],
  [{ type: "training_success" }, "training success", 1700],
  [{ type: "set_mode", mode: "monitoring" }, "monitoring mode", 1100],
  [{ type: "alert_raised" }, "monitoring alert", 1200],
  [{ type: "touch" }, "touch during alert", 900],
  [{ type: "set_mode", mode: "companion" }, "companion command during alert", 900],
  [{ type: "alert_cleared" }, "alert clear", 700],
]);

export function createProductDemo(button, dispatch, { delay = abortableDelay } = {}) {
  let activeController = null;

  return async function runDemo() {
    if (activeController) {
      activeController.abort();
      activeController = null;
      button.textContent = "Run product demo";
      return;
    }

    const controller = new AbortController();
    activeController = controller;
    button.textContent = "Stop demo";
    const { signal } = controller;
    try {
      for (const [action, label, duration] of STEPS) {
        signal.throwIfAborted();
        await dispatch(action, label);
        signal.throwIfAborted();
        await delay(duration, signal);
      }
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    } finally {
      // An older cancelled run must not reset a newly started run.
      if (activeController === controller) {
        activeController = null;
        button.textContent = "Run product demo";
      }
    }
  };
}
