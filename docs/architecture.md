# Architecture

## Design goal

Separate product meaning from hardware output. A high-level mode such as `training` should not be implemented as a direct call to draw one bitmap. The mode remains active while short-lived expressions come and go.

```text
Touch / MPU6050 / Raspberry Pi
              │
              ▼
         RobotEvent queue
              │
              ▼
        BehaviorEngine
      mode + priority rules
              │
              ▼
          RobotState
       mode + expression
              │
              ▼
       ST7789 renderer
```

## Mode and expression are different

`RobotMode` represents what the product is doing:

- `idle`
- `companion`
- `training`
- `monitoring`
- `alert`
- `error`

`Expression` represents what the user sees at that moment:

- `neutral`
- `happy`
- `curious`
- `encouraging`
- `sleepy`
- `warning`
- `error`

For example, `training_success` temporarily changes the expression to `encouraging` without leaving `training` mode. After three seconds, the behavior engine restores the training mode's base expression.

## Priority rule

An alert is latched. After `alert_raised`, touch, motion, training, and ordinary mode commands cannot replace the alert screen. Only `alert_cleared` releases the latch and returns the robot to monitoring mode.

This rule prevents a low-priority companionship event from hiding a monitoring warning.

## ESP32 responsibilities

- Read the touch sensor and IMU.
- Debounce and rate-limit physical events.
- Maintain the authoritative real-time product mode.
- Enforce alert priority locally.
- Render the face without depending on the Raspberry Pi.
- Accept bounded commands and publish acknowledgements and current state.

## Raspberry Pi responsibilities

- Run higher-level product workflows.
- Integrate future camera, audio, local inference, or network services.
- Send semantic events rather than display pixels.
- Observe acknowledgement and state messages.

The ESP32 continues operating in a safe local state if the Raspberry Pi is disconnected.

## Browser module boundaries

- `app.js` binds controls and renders Python service snapshots; it does not own device rules.
- `state-machine.js` owns browser-side behavior transitions.
- `core/` owns the HTTP client, protocol frames, virtual device, legacy virtual supervisor, and abortable timer.
- `ui/` owns DOM lookups, dashboard rendering, and canvas rendering; it does not send protocol commands.
- `product-demo.js` awaits each HTTP action before advancing the manual demonstration.
- `virtual-link.js` keeps the original public imports available as re-exports.
- `styles/` separates base tokens, workspace, controls, showcase, and final responsive overrides.

Each demo run owns its cancellation controller. Only the current run can reset the
button, so a cancelled run cannot overwrite a rapid restart. Completed or cancelled
delays remove their abort listeners. The browser model is a separate implementation
of the firmware behavior contract, not C++ firmware executing inside the browser.

In firmware, `serial_protocol.cpp` handles input parsing and the ACK journal;
`protocol_messages.cpp` implements outgoing ACK/state/config/health serialization.
Both implement the `SerialProtocol` interface declared in `include/serial_protocol.h`.

## Product demonstration runtime

```text
Browser controls / synthetic input fixtures
                  ↓
Python HTTP service + ScenarioRunner rules
                  ↓
Python RobotController → NDJSON process transport
                  ↓
Node.js VirtualEspDevice → ACK + state
                  ↓
SQLite transaction → browser snapshot / downloadable report
                  ↑
Owner confirmation → alert cleared + confirmation record
```

The device model reuses the tested JavaScript behavior rules in a separate process;
it is not C++ running in the browser. The two implementations are held together by
`firmware/test/test_conformance/behavior_conformance.txt`, a fixture replayed by both
the firmware host tests and the browser tests, so a rule that changes in one engine
and not the other fails CI rather than silently making the showcase lie about the
hardware. The Python service owns the active scenario,
replay cursor, and decisions. Background advancement continues if the page closes.
Only explicit confirmation releases a scenario's monitoring alert. Manual controls
cannot overwrite an active run. Completed history is bounded to 100 runs; trace
history is bounded to 1,000 entries.

State, run records, and request IDs are committed together in SQLite. On save
failure, the software device and run state return to the last committed snapshot;
the HTTP operation reports failure. Duplicate HTTP request IDs cannot start another
run, and duplicate confirmation cannot clear an alert twice. A dead device process
is restored from its last known state. Refreshing the browser does not reset data.
Client snapshots use a persistent version counter to ignore stale HTTP responses.

## Serial protocol

Messages are newline-delimited UTF-8 JSON at 115200 baud.

Command:

```json
{"v":1,"id":"abc123","type":"set_mode","mode":"monitoring"}
```

Acknowledgement:

```json
{"v":1,"type":"ack","id":"abc123","accepted":true}
```

State update:

```json
{"v":1,"type":"state","mode":"monitoring","expression":"sleepy","alert_latched":false,"revision":7}
```

Protocol v1 deduplicates the eight most recent command IDs and replays their cached acknowledgements. The Raspberry Pi retries with the same ID. The bounded ACK journal is mirrored to NVS, so retries remain idempotent after a reset or power cycle.

Validated motion and shake thresholds are stored under a versioned NVS configuration schema and applied on the next boot. Boot count and cumulative queue, protocol, and MPU fault counters are persisted separately from the operational state.
