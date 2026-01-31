# Design rationale

This document records the reasoning behind the first PawPal architecture. It is
not a claim that every physical integration gate has passed.

## Product state and presentation state are separate

A product mode can last for minutes or hours, while an expression may last only
seconds. Keeping `RobotMode` separate from `Expression` lets a training-success
reaction finish without losing the underlying training workflow.

## Safety-relevant alerts are latched

After a monitoring alert is raised, ordinary companionship and training events
cannot replace it. Explicit confirmation is required before the robot returns to
monitoring. This rule is enforced in the device behavior model rather than only
in the browser.

## Sensor signals become semantic events

Raw touch and IMU readings are noisy and hardware-specific. The input layer
debounces, filters, applies cooldowns, and emits bounded events such as `motion`,
`shake`, and `long_press`. The behavior engine does not depend on raw register
values.

## The ESP32 owns real-time state

The ESP32 remains authoritative for the current mode, alert priority, and display.
An optional Raspberry Pi sends semantic intent and receives acknowledgements; it
does not draw pixels directly. The robot therefore retains deterministic local
behavior if the supervisor disconnects.

## The demonstration uses the same protocol boundary

The browser talks to a Python supervisor, which exchanges NDJSON frames with a
separate virtual-device process. This keeps the software demonstration honest:
the UI cannot silently bypass command validation, acknowledgements, or device
state transitions.

## Physical evidence is a separate gate

Firmware builds and host-side tests validate software behavior, not wiring or
electrical integration. The required physical checks and evidence are listed in
[validation-plan.md](validation-plan.md).
