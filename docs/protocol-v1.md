# PawPal Serial Protocol v1

PawPal uses newline-delimited UTF-8 JSON at 115200 baud. Every command carries `v:1` and a caller-generated command `id` no longer than 24 characters.

## Reliability contract

- A caller retries a timed-out command with the same command ID.
- The ESP32 retains the eight most recent command results in RAM and NVS.
- A repeated ID does not execute the behavior again. The ESP32 replays the cached ACK with `duplicate:true`.
- The cache is restored after reboot, so immediate command retries remain idempotent across reset and power loss.
- An accepted ACK means the behavior engine accepted the command, not merely that JSON parsing succeeded.
- State telemetry is independent of ACK delivery and is retained by the supervisor while it waits for a matching ACK.

## Commands

Set mode:

```json
{"v":1,"id":"cmd-001","type":"set_mode","mode":"training"}
```

Product event:

```json
{"v":1,"id":"cmd-002","type":"event","event":"training_success","intensity":1.0}
```

Liveness check:

```json
{"v":1,"id":"ping-001","type":"ping"}
```

Read persistent configuration:

```json
{"v":1,"id":"cfg-001","type":"get_config"}
```

Update a validated threshold for the next boot:

```json
{"v":1,"id":"cfg-002","type":"set_config","key":"motion_threshold_dps","value":55.0}
```

`motion_threshold_dps` accepts 5–150 and must remain below `shake_threshold_dps`. `shake_threshold_dps` accepts 60–500 and must remain above the motion threshold. Configuration replies indicate `restart_required:true` after a change.

## Device messages

Accepted ACK:

```json
{"v":1,"type":"ack","id":"cmd-001","accepted":true}
```

Duplicate ACK:

```json
{"v":1,"type":"ack","id":"cmd-001","accepted":true,"duplicate":true}
```

Rejected ACK:

```json
{"v":1,"type":"ack","id":"cmd-003","accepted":false,"error":"alert_latched"}
```

State telemetry:

```json
{"v":1,"type":"state","mode":"monitoring","expression":"sleepy","alert_latched":false,"revision":7}
```

Health telemetry includes `device_id`, `firmware`, `uptime_ms`, `free_heap`, `queue_dropped`, `protocol_errors`, `duplicate_commands`, `mpu_available`, `mpu_read_errors`, `boot_count`, and lifetime fault counters.

## Error codes

- `invalid_json`
- `unsupported_version`
- `missing_id`
- `id_too_long`
- `unknown_type`
- `unknown_mode`
- `unknown_event`
- `invalid_context`
- `alert_latched`
- `no_active_alert`
- `invalid_config`
- `unknown_config`
- `config_out_of_range`

## Bounded behavior

The firmware input buffer is limited to 512 bytes and command IDs are limited to 24 characters. Only human-rate semantic commands are written to the eight-entry NVS ACK journal; sensor telemetry is never journaled. Protocol v1 does not provide cryptographic integrity, authentication, encryption, or flow-control negotiation.
