import { createProductDemo } from "./product-demo.js";
import { SupervisorClient } from "./core/supervisor-client.js";
import { createDashboardView } from "./ui/dashboard-view.js";
import { getElements } from "./ui/elements.js";
import { createFaceRenderer } from "./ui/face-renderer.js";
import { createScenarioView } from "./ui/scenario-view.js";

const elements = getElements();
const dashboard = createDashboardView(elements);
const drawFace = createFaceRenderer(elements.canvas);
const connection = document.querySelector("#connection-message");
const errorMessage = document.querySelector("#service-error");
const engineeringDetails = document.querySelector("#engineering-details");
let snapshot = null;
let state = { mode: "idle", expression: "neutral", alertLatched: false, revision: 0 };
let online = false;
let pending = false;
let traceSeq = 0;
let demoRunning = false;

if (matchMedia("(max-width: 48rem)").matches) engineeringDetails.open = false;

function safely(action) {
  return async () => {
    try { await action(); }
    catch (error) { errorMessage.textContent = error.message; }
  };
}

const renderScenarios = createScenarioView({
  start: (name) => safely(() => client.mutate("/api/scenario", { name }))(),
  stop: safely(() => client.mutate("/api/stop")),
  confirm: (runId) => safely(() => client.mutate("/api/confirm", { runId }))(),
  clearHistory: safely(() => client.mutate("/api/reset-history")),
});

function controls() {
  const locked = !online || pending;
  dashboard.updateState(state);
  const scenarioActive = Boolean(snapshot?.activeRun);
  for (const button of [...elements.modeButtons, ...elements.eventButtons]) {
    button.disabled ||= locked || scenarioActive || demoRunning;
  }
  for (const button of [elements.injectInvalidButton, elements.rebootDeviceButton,
    elements.testPersistenceButton]) button.disabled = locked || scenarioActive || demoRunning;
  elements.runDemoButton.disabled = !online || scenarioActive || (pending && !demoRunning);
  elements.pingDeviceButton.disabled = locked;
  elements.downloadReportButton.disabled = !online;
  renderScenarios(snapshot, locked || demoRunning);
}

function render(next) {
  snapshot = next;
  state = { ...next.finalState, alertLatched: next.finalState.alert_latched };
  dashboard.updateDiagnostics(next.metrics);
  for (const entry of next.trace) {
    if (entry.seq <= traceSeq) continue;
    traceSeq = entry.seq;
    dashboard.addProtocol(entry);
    const frame = entry.frame;
    if (frame.type === "ack") {
      dashboard.addEvent(frame.accepted ? `${frame.id} accepted by ESP32`
        : `${frame.id} rejected: ${frame.error}`, !frame.accepted);
    } else if (entry.direction === "SYSTEM" || entry.direction === "OWNER") {
      dashboard.addEvent(frame.event);
    }
  }
  controls();
}

const client = new SupervisorClient({
  onSnapshot: render,
  onConnection: (status) => {
    online = status.online;
    pending = status.pending;
    connection.textContent = online ? "Python supervisor connected" : "Supervisor disconnected";
    connection.parentElement.dataset.online = String(online);
    if (status.error !== undefined) errorMessage.textContent = status.error ?? "";
    controls();
  },
});

async function dispatch(action) {
  const result = await client.mutate("/api/action", { action });
  const ack = result.trace.findLast((entry) => entry.frame.type === "ack")?.frame;
  return ack?.accepted ?? true;
}

for (const button of elements.modeButtons) {
  button.addEventListener("click", safely(() => dispatch({ type: "set_mode", mode: button.dataset.mode })));
}
for (const button of elements.eventButtons) {
  button.addEventListener("click", safely(() => dispatch({ type: button.dataset.event })));
}
const runDemo = createProductDemo(elements.runDemoButton, dispatch);
let demoGeneration = 0;
elements.runDemoButton.addEventListener("click", safely(async () => {
  const generation = ++demoGeneration;
  demoRunning = !demoRunning;
  controls();
  try { await runDemo(); }
  finally { if (generation === demoGeneration) demoRunning = false; controls(); }
}));
elements.clearLogButton.addEventListener("click", () => elements.eventList.replaceChildren());
elements.pingDeviceButton.addEventListener("click", safely(async () => {
  await dispatch({ type: "ping" });
  dashboard.addEvent("Protocol v1 heartbeat acknowledged");
}));
elements.injectInvalidButton.addEventListener("click", safely(() => dispatch({ type: "raw", raw: "{malformed-frame" })));
elements.rebootDeviceButton.addEventListener("click", safely(async () => {
  await dispatch({ type: "reboot" });
  dashboard.addEvent("virtual ESP32 rebooted and state synchronized");
}));
elements.testPersistenceButton.addEventListener("click", safely(() => dispatch({ type: "test_persistence" })));
elements.downloadReportButton.addEventListener("click", safely(async () => {
  const report = await client.request("/api/report");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
  link.download = `pawpal-run-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}));

function animate(now) {
  drawFace(state, now);
  requestAnimationFrame(animate);
}
controls();
client.poll();
requestAnimationFrame(animate);
