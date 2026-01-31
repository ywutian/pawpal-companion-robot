# Open-source Companion Robot Benchmark

This review focused on implementation patterns that strengthen PawPal's design
without copying third-party source or expanding the browser demonstration into
unsupported hardware claims.

## Projects reviewed

### YETI

[merberg-ai/YETI](https://github.com/merberg-ai/YETI) combines an ESP32 companion face, motion reactions, configurable sleep behavior, a mobile WebUI, sensor diagnostics, event logs, system stats, and explicit refresh pacing.

Useful pattern: operational visibility belongs in the product interface, not only in a serial console.

### MyDeskRobo

[AngeloMontesano/MyDeskRobo](https://github.com/AngeloMontesano/MyDeskRobo) separates the ESP32-S3 face engine from a desktop agent and provides animated transitions, idle micro-expressions, motion reactions, runtime tuning, demo mode, and build validation.

Useful pattern: a companion robot benefits from a clear device/agent boundary and a repeatable demonstration mode.

### QBIT

[SeanChangX/QBIT](https://github.com/SeanChangX/QBIT) includes a device dashboard, animation tools, MQTT integration, browser flashing, and a multi-device simulator.

Useful pattern: simulation and conversion/inspection tools make an embedded project easier to test and present even when the device is not physically present.

License note: QBIT is CC BY-NC-SA 4.0. PawPal does not reuse its source, assets, or animation format.

### Robot Study Companion CYD

[RobotStudyCompanion/CYD](https://github.com/RobotStudyCompanion/CYD) exposes UART commands, persistent configuration, touch debugging, live uptime/free-heap statistics, compile-time diagnostic gates, and build-derived versioning.

Useful pattern: malformed input, runtime status, and recovery behavior are first-class embedded features rather than afterthoughts.

## Changes adopted in PawPal

- Added runtime diagnostics for uptime, command count, accepted/rejected ACKs, sensor events, and received frames.
- Added malformed NDJSON injection with a visible `invalid_json` negative acknowledgement.
- Added deterministic virtual ESP32 reboot and fresh-state synchronization.
- Kept the existing scripted product demo and device/supervisor separation.
- Preserved a downloadable bidirectional trace so a reviewer can inspect evidence after the demonstration.

## Ideas intentionally deferred

- Community animation uploads, MQTT device networks, weather, and games would
  broaden the project before the core companion-robot behavior is validated.
- BLE, Wi-Fi provisioning, persistent settings, and browser flashing are valuable only after a physical target and configuration lifecycle are fixed.
- Additional moods and idle micro-expressions can improve personality, but
  protocol diagnostics and recovery are more useful for the current milestone.
