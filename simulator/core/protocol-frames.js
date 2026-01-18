export const PROTOCOL_VERSION = 1;

export const ERROR_CODES = Object.freeze({
  "Invalid event": "invalid_event",
  "No active alert": "no_active_alert",
  "Alert is latched": "alert_latched",
  "Unknown mode": "unknown_mode",
  "Motion ignored in this mode": "invalid_context",
  "Training is not active": "invalid_context",
  "Unknown event": "unknown_event",
});

export function stateFrame(state) {
  return {
    v: PROTOCOL_VERSION,
    type: "state",
    mode: state.mode,
    expression: state.expression,
    alert_latched: state.alertLatched,
    revision: state.revision,
  };
}

export function configFrame(persistence, restartRequired = false) {
  return {
    v: PROTOCOL_VERSION,
    type: "config",
    ...persistence.config,
    revision: persistence.configRevision,
    restart_required: restartRequired,
  };
}

export function encodeFrame(frame) {
  return `${JSON.stringify(frame)}\n`;
}
