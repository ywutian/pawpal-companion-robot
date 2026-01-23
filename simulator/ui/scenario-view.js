const EVENT_LABELS = Object.freeze({
  touch: "Companion response",
  training_success: "Training success",
  alert_raised: "Alert raised",
});

function reading(entry, run) {
  const sample = entry.sample;
  if (run.name === "companion") {
    return { label: sample.touch ? "Touch detected" : "No touch", value: sample.touch ? 1 : 0 };
  }
  if (run.name === "training") {
    return { label: `${sample.pose} · ${Math.round(sample.confidence * 100)}%`, value: sample.confidence };
  }
  return { label: `Activity · ${Math.round(sample.activity * 100)}%`, value: sample.activity };
}

function timeline(run) {
  const list = document.createElement("ol");
  list.className = "decision-timeline";
  if (!run?.timeline.length) {
    const empty = document.createElement("li");
    empty.className = "timeline-empty";
    empty.textContent = "Input decisions will appear here during replay.";
    list.append(empty);
    return list;
  }
  for (const entry of run.timeline) {
    const item = document.createElement("li");
    item.className = `decision-step${entry.event ? " is-triggered" : ""}`;
    const index = document.createElement("span");
    index.className = "decision-index";
    index.textContent = String(entry.index).padStart(2, "0");
    const value = reading(entry, run);
    const readingBlock = document.createElement("div");
    readingBlock.className = "decision-reading";
    const label = document.createElement("strong");
    label.textContent = value.label;
    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = 1;
    meter.value = value.value;
    meter.setAttribute("aria-label", value.label);
    const result = document.createElement("span");
    result.className = "decision-result";
    result.textContent = entry.event
      ? EVENT_LABELS[entry.event] ?? entry.event
      : entry.streak > 0 ? `Qualifying streak ${entry.streak}/3` : "Observed";
    readingBlock.append(label, meter);
    item.append(index, readingBlock, result);
    list.append(item);
  }
  return list;
}

export function createScenarioView({ start, stop, confirm, clearHistory }) {
  const panel = document.querySelector("#scenario-panel");
  const current = panel.querySelector("#scenario-current");
  const progress = panel.querySelector("#scenario-progress");
  const rule = panel.querySelector("#scenario-rule");
  const input = panel.querySelector("#scenario-input");
  const currentTimeline = panel.querySelector("#scenario-timeline");
  const history = panel.querySelector("#run-history");
  const historyCount = panel.querySelector("#history-count");
  const confirmButton = panel.querySelector("#confirm-alert");
  const stopButton = panel.querySelector("#stop-scenario");
  const openClear = panel.querySelector("#open-clear-history");
  const dialog = document.querySelector("#clear-history-dialog");
  let activeId = null;
  let lastSignature = "";

  for (const button of panel.querySelectorAll("[data-scenario]")) {
    button.addEventListener("click", () => start(button.dataset.scenario));
  }
  stopButton.addEventListener("click", stop);
  confirmButton.addEventListener("click", () => confirm(activeId));
  openClear.addEventListener("click", () => {
    dialog.returnValue = "";
    dialog.showModal();
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "confirm") clearHistory();
  });

  return function render(snapshot, locked) {
    const active = snapshot?.activeRun;
    const displayRun = active ?? snapshot?.runs[0];
    activeId = active?.id;
    current.textContent = active
      ? `${active.name} · ${active.status.replaceAll("_", " ")}`
      : displayRun ? `Last result · ${displayRun.name} · ${displayRun.status.replaceAll("_", " ")}`
        : "Ready — choose a scenario";
    progress.max = active?.samples.length ?? displayRun?.samples.length ?? 1;
    progress.value = active?.cursor ?? displayRun?.cursor ?? 0;
    rule.textContent = active?.rule ?? displayRun?.rule ??
      "Replay synthetic input through Python rules, then inspect the device response and saved result.";
    const last = active?.timeline.at(-1);
    input.textContent = last
      ? `Sample ${last.index}/${active.samples.length} processed · ${last.event ? EVENT_LABELS[last.event] : "no event"}`
      : active ? "Waiting for the first input sample" : "Choose a scenario to begin";
    for (const button of panel.querySelectorAll("[data-scenario]")) {
      button.disabled = locked || Boolean(active) || Boolean(snapshot?.finalState.alert_latched);
    }
    stopButton.disabled = locked || active?.status !== "running" || snapshot?.finalState.alert_latched;
    confirmButton.disabled = locked || active?.status !== "awaiting_confirmation";
    openClear.disabled = locked || Boolean(active) || Boolean(snapshot?.finalState.alert_latched);

    const signature = JSON.stringify([active, snapshot?.runs]);
    if (signature === lastSignature) return;
    lastSignature = signature;
    const nextTimeline = timeline(displayRun);
    currentTimeline.replaceChildren(...nextTimeline.children);
    history.replaceChildren();
    const runs = snapshot?.runs ?? [];
    historyCount.textContent = runs.length
      ? `Showing latest ${Math.min(10, runs.length)} of ${runs.length} saved run${runs.length === 1 ? "" : "s"}`
      : "No saved runs";
    if (!runs.length) {
      const empty = document.createElement("li");
      empty.textContent = "No saved runs yet. Start a replay above.";
      history.append(empty);
    }
    for (const run of runs.slice(0, 10)) {
      const item = document.createElement("li");
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `${run.name} · ${run.status.replaceAll("_", " ")} · ${new Date(run.startedAt).toLocaleTimeString()}`;
      const outcome = document.createElement("p");
      outcome.textContent = run.outcome ?? "Input replay in progress";
      details.append(summary, outcome, timeline(run));
      item.append(details);
      history.append(item);
    }
  };
}
