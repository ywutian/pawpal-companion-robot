# Changelog

All notable public changes to PawPal are documented here. The project follows
[Semantic Versioning](https://semver.org/) from its first public release.

## [0.2.1] - 2026-08-29

### Fixed

- `ping` is now accepted while an alert is latched, so liveness checks keep
  working in exactly the state that most needs them. Previously the firmware
  rejected it with `alert_latched` while the virtual device accepted it.
- Ping acknowledgements are no longer journaled to NVS (or to the virtual
  device's persistence), removing flash writes at liveness-check rate and
  matching the documented human-rate journal rule. Pings are idempotent, so a
  retried ping executes again instead of replaying a cached ACK.

### Added

- A shared behavior-conformance fixture replayed by both the firmware host
  tests and the browser state-machine tests, pinning both implementations to
  identical mode, expression, revision, and rejection semantics.

## [0.2.0] - 2026-08-29

Initial public release.

### Product loop

- Added deterministic companionship, training, and monitoring scenarios.
- Added explicit owner confirmation for latched monitoring alerts.
- Added persistent SQLite run history, decision timelines, and JSON reports.
- Added a responsive browser showcase backed by the real Python supervisor and
  a separate Node.js virtual-device process.

### Firmware and protocol

- Added ESP32-S3 behavior, display, touch, IMU, and NDJSON protocol modules.
- Added versioned commands, bounded parsing, liveness checks, same-ID retries,
  acknowledgement deduplication, NVS configuration, and health telemetry.
- Added host behavior tests and a reproducible PlatformIO firmware build.

### Reliability and verification

- Added transactional persistence, idempotent HTTP requests, bounded history,
  save-failure rollback, child-process recovery, and browser offline recovery.
- Added JavaScript, Python, firmware-host, and multi-viewport browser tests.
- Added CI, security boundaries, wiring guidance, and a physical validation plan.
