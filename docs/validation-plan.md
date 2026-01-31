# Physical validation plan

Do not describe the project as a completed physical robot until the applicable gates below have evidence.

## Gate 1: Display and firmware

- [ ] Photograph the exact ESP32-S3 and display model labels.
- [ ] Record the final pin map.
- [ ] Build and flash without warnings that affect operation.
- [ ] Show all seven expressions on the physical screen.
- [ ] Run continuously for 30 minutes without reset or display corruption.

Evidence:

- wiring photo
- serial log
- short expression-cycle video
- build output

## Gate 2: Touch and IMU

- [ ] Ten single taps produce ten companion reactions.
- [ ] Ten long presses are distinguished from taps.
- [ ] Normal desk vibration does not repeatedly trigger shake warnings.
- [ ] Five intentional shakes produce five warnings with cooldown behavior.
- [ ] Record false-positive and missed-event counts.

## Gate 3: Product modes

- [ ] Companion mode responds to touch.
- [ ] Training success shows encouragement and returns to training.
- [ ] Monitoring mode enters and remains stable.
- [ ] Alert blocks touch and training events.
- [ ] Alert clear returns to monitoring.
- [ ] Power cycling returns to a documented safe state.

## Gate 4: Raspberry Pi integration

- [ ] Pi sends all supported commands over USB serial.
- [ ] ESP32 acknowledges each valid command.
- [ ] Invalid JSON, unknown mode, and unknown event return errors.
- [ ] Disconnect and reconnect behavior is documented.
- [ ] Run a 100-command sequence and retain the log.

## Gate 5: Release evidence

- [ ] Publish a clean repository without credentials or local paths.
- [ ] Add a system diagram and bill of materials.
- [ ] Record a two-minute uncut demonstration.
- [ ] State honestly which parts are complete and which remain planned.
- [ ] Publish measured results only after the corresponding evidence is retained.
