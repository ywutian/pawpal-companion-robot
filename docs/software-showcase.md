# Product Software Showcase

## Run it

From the repository root, run `make serve`, then open
`http://127.0.0.1:8080`. The page requires the Python API, not a plain static server.

## What actually runs

1. The browser sends an HTTP intent to the Python supervisor.
2. Python creates a versioned command and ID using the existing RobotController.
3. A separate Node.js process receives NDJSON and runs the virtual ESP32 model.
4. The model returns ACK and state frames.
5. Python saves device state, input timelines, run status, and confirmations in SQLite.
6. The browser renders the returned state and offers a downloadable JSON report.

All three product scenarios use deterministic **synthetic fixtures**. There is no
camera inference, microphone input, live pet recognition, or hardware connection
in this presentation. The ESP32 C++ firmware remains a separate build target.

## Three closed loops

| Scenario | Input and decision | Feedback and completion |
| --- | --- | --- |
| Companionship | A touch rising edge in the fixture | Happy expression; repeated held-touch samples do not retrigger; saved run |
| Training | Three consecutive sit samples with confidence ≥ 0.8 | Encouraging expression and saved input/decision timeline |
| Monitoring | Three consecutive activity scores ≥ 0.8; isolated spikes reset the streak | Latched alert, explicit owner confirmation, monitoring resumed, confirmation saved |

The thresholds are demonstration rules, not validated animal-health or behavior
models. A normal sample after an alert does not automatically clear it.

## Two-minute walkthrough

1. Click **Replay companionship** and expand its completed saved run.
2. Click **Replay training**; inspect the low-confidence sample and the three
   subsequent qualifying samples that trigger training success.
3. Click **Replay monitoring**. The first isolated spike is ignored. Three
   consecutive high samples raise the alert.
4. Refresh the page while the run awaits confirmation. The alert and run remain.
5. Click **Confirm alert & resume**. The state returns to monitoring; the run is
   marked acknowledged with a confirmation timestamp.
6. Download the run report. It contains the input samples, decisions, protocol
   frames, final state, and confirmation record.

The page presents each sample as a decision row with a reading meter, qualifying
streak, and named trigger. Only the latest ten runs are shown in the bounded panel;
the report retains the configured history. **Reset demo** requires confirmation,
cannot run during an active alert, and gives repeatable interview walkthroughs.

The original manual controls and **Run product demo** remain available when no
scenario is active. A replay can be stopped before it has raised an alert.
Once an alert is raised, confirmation is required; cancellation cannot hide it.

## Recovery and saved data

- Browser network loss disables controls and displays a reconnecting message.
- Reconnection reads server state; it does not create a new local device model.
- The service advances replay independently of an open page.
- Restarting the service restores device state, runs, and replay progress from SQLite.
- Device-process recovery is logged and restores its last known state.
- Failed database writes cannot produce a false successful confirmation.
- Latest 100 runs and 1,000 trace entries are retained in `.data/pawpal.sqlite3`.
  Download reports for longer-term copies.
- The service is a loopback-only, single-workspace demonstration, not a commercial
  deployment. Data is not uploaded anywhere.

## Verification

`make verify` runs unit/integration tests, builds the firmware, then launches an
isolated Python service with a temporary database for browser acceptance.
The browser run covers all three loops, refresh, report contents, offline recovery,
keyboard controls, and 320/768/1024/1440 px layouts without modifying your saved runs.
