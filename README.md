# PawPal Companion Robot

[![PawPal CI](https://github.com/ywutian/pawpal-companion-robot/actions/workflows/ci.yml/badge.svg)](https://github.com/ywutian/pawpal-companion-robot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

PawPal is a small physical companion-robot reference project built around an ESP32-S3. It turns product concepts such as companionship, training, and monitoring into explicit modes, event rules, expressions, and screen output. A Raspberry Pi can be added as an optional supervisor for higher-level product logic.

The repository is released under the MIT License. It is designed to be readable,
repeatable without hardware, and explicit about which behavior is simulated.

## Current status

- ESP32-S3 firmware: implemented.
- Host-side behavior tests: implemented.
- Raspberry Pi serial supervisor and dry-run demo: implemented.
- Local product showcase: browser → actual Python supervisor → NDJSON → separate Node.js virtual ESP32 → ACK/state → browser.
- Product scenarios: synthetic companionship, training, and monitoring inputs run through Python rules; monitoring requires explicit owner confirmation.
- Saved results: SQLite records input timelines, device responses, and confirmations across page refresh and service restart.
- Engineering diagnostics: implemented with runtime counters, malformed-frame injection, rejected-ACK evidence, and deterministic virtual-device reboot recovery.
- Protocol v1 reliability: implemented with liveness ping, same-ID retries, in-memory command deduplication, watchdog coverage, queue-drop accounting, MPU recovery, and health telemetry.
- Persistent reliability: implemented with versioned NVS configuration, cross-reboot ACK deduplication, boot count, and cumulative fault counters.
- Physical wiring and on-device validation: not completed yet.
- Motors, navigation, camera, microphone, and mechanical design: outside the first milestone.

The current project is therefore a buildable software and wiring baseline, not yet a completed physical-robot claim.

## First-version capabilities

- Product modes: `idle`, `companion`, `training`, `monitoring`, `alert`, and `error`.
- Expressions: `neutral`, `happy`, `curious`, `encouraging`, `sleepy`, `warning`, and `error`.
- TTP223 touch input with tap and long-press handling.
- MPU6050 motion and shake events with filtering and cooldowns.
- 240×240 ST7789 face renderer with blinking and expression changes.
- Latched alert behavior that lower-priority events cannot overwrite.
- Newline-delimited JSON protocol over USB serial.
- Optional Raspberry Pi commands, acknowledgements, and scripted demo.

## Repository structure

```text
pawpal-companion-robot/
├── firmware/                 ESP32-S3 PlatformIO project
│   ├── include/              state model and hardware configuration
│   ├── src/                  behavior, display, sensors, protocol I/O, and messages
│   └── test/                 host-side behavior tests
├── supervisor/               optional Raspberry Pi Python package
│   ├── src/                  protocol, controller, CLI, and demo
│   └── tests/                protocol tests
├── simulator/                hardware-free browser display and controls
│   ├── core/                 protocol frames and virtual Pi/ESP32 models
│   ├── ui/                   DOM bindings, face renderer, and dashboard view
│   └── styles/               base, controls, showcase, and responsive layers
├── docs/                     architecture, wiring, security, and validation
├── CONTRIBUTING.md           development and contribution workflow
├── SECURITY.md               vulnerability reporting and security boundary
└── Makefile                  common local development and verification commands
```

## Hardware

Minimum first build:

- ESP32-S3 DevKitC-1
- ST7789 240×240 SPI display
- TTP223 capacitive touch module
- MPU6050 IMU module
- jumper wires and USB-C cable

Optional later:

- Raspberry Pi 4 or 5
- MAX98357A I2S amplifier and speaker
- 3D-printed enclosure

See [docs/bom.md](docs/bom.md) and [docs/wiring.md](docs/wiring.md) before buying or connecting hardware.

## Run without hardware

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e supervisor
pawpal-demo --dry-run --speed 0
```

This prints the complete companion → training → monitoring → alert workflow as serial JSON commands.

## Run the visual simulator

```bash
make serve
```

Then open `http://127.0.0.1:8080`. This starts the Python HTTP service and its Node.js device-model process. Node.js 20+ and Python 3.10+ are required; there are no third-party Python dependencies for this software mode. A static file server alone no longer runs the product.

Choose **Replay companionship**, **Replay training**, or **Replay monitoring**.
Inputs are clearly labeled synthetic fixtures, not live pet observations. Monitoring
uses three consecutive high-activity samples to raise an alert; click
**Confirm alert & resume** to complete that run. Expand **Saved runs** to inspect
the visual decision timeline, or download the complete report. **Reset demo** uses
a confirmation dialog and is disabled during an active run or latched alert; it
clears only this local demonstration's run history and returns the model to idle.

The actual Python `RobotController` sends protocol commands to a separate Node.js
virtual device. The browser renders the returned state, not a second local device.
SQLite at `.data/pawpal.sqlite3` saves the latest 100 runs and 1,000 trace entries.
It is outside the served directory and ignored by Git. This is one shared local
demo workspace, not a multi-user cloud service. The server only listens on loopback.

See [docs/software-showcase.md](docs/software-showcase.md) for the display scope, [docs/protocol-v1.md](docs/protocol-v1.md) for the reliability contract, and [docs/security-update-design.md](docs/security-update-design.md) for the production security boundary.

## Test

From the repository root, `make help` lists the shared developer commands:

```bash
make serve       # start the web demo at http://127.0.0.1:8080
make test        # JavaScript + Python + firmware host tests
make build       # compile ESP32-S3 firmware; does not flash a device
make qa          # start an isolated test service and check it in Chromium
make verify      # tests, firmware build, then browser QA
```

QA starts its own temporary database and dynamically allocated port, so it does
not change the runs in your demo. Use `make serve PORT=8081` if 8080 is busy.
Setting `QA_URL` explicitly tests and changes that target's demo state instead.
`make` automatically uses the root `.venv` for Python
and PlatformIO if present; `NODE`, `PYTHON`, and `PIO` can be overridden.
It runs PlatformIO checks sequentially to avoid shared build-directory conflicts.

Prerequisites: Node.js 20.19+, Python 3.10+, and PlatformIO. Browser QA additionally
requires a Node-resolvable `playwright` installation and its Chromium browser.
If Playwright is provided by a shared tool environment, expose its module
directory through `NODE_PATH`. The simulator itself has no npm runtime dependencies.
Install the pinned browser test dependency with `npm ci`, then
`npx playwright install chromium`. Screenshots are written to `.qa/simulator/`
and excluded from Git. CI runs browser QA against its own isolated service.

Install serial hardware support only when it is needed:

```bash
python -m pip install -e 'supervisor[hardware]'
```

Individual checks can also be run directly:

Python protocol tests:

```bash
cd supervisor
PYTHONPATH=src python -m unittest discover -s tests -v
```

Firmware behavior tests:

```bash
cd firmware
pio test -e native
```

Browser state-machine tests, using Node.js 20 or newer:

```bash
node --test simulator/*.test.mjs
```

The repository also contains `simulator/qa.mjs`, which exercises all three product
scenarios, explicit confirmation, saved runs after refresh, real report downloads,
offline recovery, keyboard start/stop, protocol rejection, and responsive layouts
at 320, 768, 1024, and 1440 px. Python integration tests use the real Node process
and SQLite to verify service restart, duplicate requests, child-process recovery,
and rollback when saving a confirmation fails. Tests do not flash hardware.
A shared fixture, `firmware/test/test_conformance/behavior_conformance.txt`, is
replayed by both the firmware host tests and the browser state-machine tests so
the C++ and JavaScript behavior implementations cannot silently drift apart.

## Build and flash the ESP32-S3

```bash
cd firmware
pio run
pio run --target upload
pio device monitor --baud 115200
```

Before flashing, check every pin in [`firmware/include/hardware_config.h`](firmware/include/hardware_config.h) against the actual development board and display module.

## Serial examples

Set training mode:

```json
{"v":1,"id":"demo-1","type":"set_mode","mode":"training"}
```

Report a successful training action:

```json
{"v":1,"id":"demo-2","type":"event","event":"training_success","intensity":1.0}
```

Raise and clear a monitoring alert:

```json
{"v":1,"id":"demo-3","type":"event","event":"alert_raised"}
{"v":1,"id":"demo-4","type":"event","event":"alert_cleared"}
```

## Safety

This milestone uses USB power and has no motors or high-current battery system. Disconnect power before changing wiring. Confirm display voltage and pin labels from the exact module datasheet rather than relying on color-coded wires.

## License

MIT. This repository is an original implementation informed by general embedded-system patterns. It does not copy source from the reference repositories used during research.

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change and
[SECURITY.md](SECURITY.md) for responsible vulnerability reporting. The
documentation index is at [docs/README.md](docs/README.md).
