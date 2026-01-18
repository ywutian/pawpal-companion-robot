export const MODES = Object.freeze([
  "idle",
  "companion",
  "training",
  "monitoring",
  "alert",
  "error",
]);

const BASE_EXPRESSION = Object.freeze({
  idle: "neutral",
  companion: "curious",
  training: "curious",
  monitoring: "sleepy",
  alert: "warning",
  error: "error",
});

const TEMPORARY_EXPRESSION_MS = Object.freeze({
  touch: 2500,
  long_press: 2500,
  motion: 1500,
  shake: 2000,
  training_success: 3000,
});

export function initialState(now = 0) {
  return {
    mode: "idle",
    expression: "neutral",
    alertLatched: false,
    expressionUntil: 0,
    revision: 0,
    lastEvent: "boot_complete",
    updatedAt: now,
  };
}

function changed(previous, next) {
  return (
    previous.mode !== next.mode ||
    previous.expression !== next.expression ||
    previous.alertLatched !== next.alertLatched ||
    previous.expressionUntil !== next.expressionUntil
  );
}

function finish(previous, next, event, now) {
  const didChange = changed(previous, next);
  return {
    ...next,
    revision: previous.revision + (didChange ? 1 : 0),
    lastEvent: event,
    updatedAt: now,
  };
}

function withMode(state, mode) {
  return {
    ...state,
    mode,
    expression: BASE_EXPRESSION[mode],
    expressionUntil: 0,
  };
}

function withTemporaryExpression(state, expression, duration, now) {
  return {
    ...state,
    expression,
    expressionUntil: now + duration,
  };
}

export function transition(state, action, now = Date.now()) {
  if (!action || typeof action.type !== "string") {
    return { state, accepted: false, reason: "Invalid event" };
  }

  if (action.type === "alert_raised") {
    const next = withMode({ ...state, alertLatched: true }, "alert");
    return { state: finish(state, next, action.type, now), accepted: true };
  }

  if (action.type === "alert_cleared") {
    if (!state.alertLatched) {
      return { state, accepted: false, reason: "No active alert" };
    }
    const next = withMode({ ...state, alertLatched: false }, "monitoring");
    return { state: finish(state, next, action.type, now), accepted: true };
  }

  if (state.alertLatched) {
    return { state, accepted: false, reason: "Alert is latched" };
  }

  let next = state;
  switch (action.type) {
    case "set_mode": {
      if (!MODES.includes(action.mode)) {
        return { state, accepted: false, reason: "Unknown mode" };
      }
      next = withMode(state, action.mode);
      break;
    }
    case "touch": {
      const companionState = state.mode === "idle" ? withMode(state, "companion") : state;
      next = withTemporaryExpression(
        companionState,
        "happy",
        TEMPORARY_EXPRESSION_MS.touch,
        now,
      );
      break;
    }
    case "long_press": {
      next = withTemporaryExpression(
        withMode(state, "companion"),
        "curious",
        TEMPORARY_EXPRESSION_MS.long_press,
        now,
      );
      break;
    }
    case "motion": {
      if (state.mode !== "idle" && state.mode !== "companion") {
        return { state, accepted: false, reason: "Motion ignored in this mode" };
      }
      next = withTemporaryExpression(
        state,
        "curious",
        TEMPORARY_EXPRESSION_MS.motion,
        now,
      );
      break;
    }
    case "shake": {
      next = withTemporaryExpression(
        state,
        "warning",
        TEMPORARY_EXPRESSION_MS.shake,
        now,
      );
      break;
    }
    case "training_success": {
      if (state.mode !== "training") {
        return { state, accepted: false, reason: "Training is not active" };
      }
      next = withTemporaryExpression(
        state,
        "encouraging",
        TEMPORARY_EXPRESSION_MS.training_success,
        now,
      );
      break;
    }
    default:
      return { state, accepted: false, reason: "Unknown event" };
  }

  return { state: finish(state, next, action.type, now), accepted: true };
}

export function tick(state, now = Date.now()) {
  if (state.expressionUntil === 0 || now < state.expressionUntil) return state;
  const next = {
    ...state,
    expression: BASE_EXPRESSION[state.mode],
    expressionUntil: 0,
  };
  return finish(state, next, "expression_timeout", now);
}

