const EVENT_LIMIT = 30;
const PROTOCOL_LIMIT = 60;

function trimList(list, limit) {
  while (list.children.length > limit) list.lastElementChild.remove();
}

export function createDashboardView(elements) {
  function updateState(state) {
    elements.modeValue.textContent = state.mode;
    elements.expressionValue.textContent = state.expression;
    elements.alertValue.textContent = state.alertLatched ? "latched" : "clear";
    elements.revisionValue.textContent = String(state.revision);
    elements.priorityLabel.textContent = state.alertLatched
      ? "Alert priority"
      : "Normal priority";
    elements.priorityLabel.classList.toggle("is-alert", state.alertLatched);

    for (const button of elements.modeButtons) {
      const active = button.dataset.mode === state.mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = state.alertLatched;
    }

    for (const button of elements.eventButtons) {
      const event = button.dataset.event;
      if (event === "alert_cleared") button.disabled = !state.alertLatched;
      else button.disabled = event !== "alert_raised" && state.alertLatched;
    }
  }

  function updateDiagnostics(metrics) {
    elements.metricUptime.textContent = `${Math.floor(metrics.uptimeMs / 1000)}s`;
    elements.metricCommands.textContent = String(metrics.commandsSent);
    elements.metricAccepted.textContent = String(metrics.acceptedAcks);
    elements.metricRejected.textContent = String(metrics.rejectedAcks);
    elements.metricSensors.textContent = String(metrics.sensorEvents);
    elements.metricFrames.textContent = String(metrics.receivedFrames);
  }

  function addEvent(message, rejected = false) {
    const item = document.createElement("li");
    const time = document.createElement("time");
    const text = document.createElement("span");
    const now = new Date();
    time.dateTime = now.toISOString();
    time.textContent = now.toLocaleTimeString([], { hour12: false });
    text.textContent = message;
    text.classList.toggle("rejected", rejected);
    item.append(time, text);
    elements.eventList.prepend(item);
    trimList(elements.eventList, EVENT_LIMIT);
  }

  function addProtocol(entry) {
    const item = document.createElement("li");
    const direction = document.createElement("span");
    const route = document.createElement("span");
    const payload = document.createElement("code");
    item.className = `protocol-${entry.direction.toLowerCase()}`;
    direction.className = "protocol-direction";
    direction.textContent = entry.direction;
    route.textContent = entry.route;
    payload.textContent = JSON.stringify(entry.frame);
    item.append(direction, route, payload);
    elements.protocolList.prepend(item);
    trimList(elements.protocolList, PROTOCOL_LIMIT);
  }

  return { addEvent, addProtocol, updateDiagnostics, updateState };
}
