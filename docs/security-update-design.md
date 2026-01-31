# Security and Update Design

This document separates implemented software behavior from target-device security configuration.

## Implemented now

- Protocol versioning and bounded command IDs.
- Explicit parser errors and runtime health telemetry.
- Unique ESP32 eFuse-derived device identifier in health messages.
- Firmware semantic version in source and health messages.
- Dependency versions recorded in PlatformIO and Python project files.
- Automated build and test workflow.

## Target-board work before a production release

1. Freeze the exact ESP32-S3 module, flash size, partition table, signing authority, and recovery interface.
2. Enable Secure Boot v2 using release keys held outside the repository.
3. Enable flash encryption in release mode and define RMA implications.
4. Use an A/B OTA partition table with signed images, boot confirmation, and automatic rollback.
5. Provision per-device credentials through a controlled factory step; do not use a fleet-wide secret in firmware.
6. Authenticate any network or maintenance interface. USB serial remains a trusted-service interface in the current architecture.
7. Produce an SBOM, firmware SHA-256, release manifest, support window, and key-rotation procedure for every release.
8. Retain a physical recovery path that cannot silently bypass production security policy.

## Why these controls are not enabled in the reference build

Secure Boot, flash encryption, and OTA partitioning change irreversible or hardware-specific state. Enabling them before the production module, partition map, factory key process, and recovery policy are frozen would create a misleading and potentially unrecoverable development configuration.
