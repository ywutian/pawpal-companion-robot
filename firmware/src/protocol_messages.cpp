#include "serial_protocol.h"

#include <ArduinoJson.h>
#include <stdio.h>

#include "version.h"

void SerialProtocol::sendAck(const char* id, bool accepted, const char* error,
                             bool cache_result) {
  JsonDocument document;
  document["v"] = kProtocolVersion;
  document["type"] = "ack";
  document["id"] = id == nullptr ? "" : id;
  document["accepted"] = accepted;
  if (error != nullptr) document["error"] = error;
  serializeJson(document, Serial);
  Serial.println();
  if (cache_result) cacheAck(id, accepted, error);
}

void SerialProtocol::sendState(const RobotState& state) {
  JsonDocument document;
  document["v"] = kProtocolVersion;
  document["type"] = "state";
  document["mode"] = modeName(state.mode);
  document["expression"] = expressionName(state.expression);
  document["alert_latched"] = state.alert_latched;
  document["revision"] = state.revision;
  serializeJson(document, Serial);
  Serial.println();
}

void SerialProtocol::sendConfig(float motion_threshold_dps,
                                float shake_threshold_dps,
                                uint32_t revision, bool restart_required) {
  JsonDocument document;
  document["v"] = kProtocolVersion;
  document["type"] = "config";
  document["motion_threshold_dps"] = motion_threshold_dps;
  document["shake_threshold_dps"] = shake_threshold_dps;
  document["revision"] = revision;
  document["restart_required"] = restart_required;
  serializeJson(document, Serial);
  Serial.println();
}

void SerialProtocol::sendHealth(uint32_t uptime_ms, uint32_t free_heap,
                                uint32_t queue_dropped, bool mpu_available,
                                uint32_t mpu_read_errors, uint64_t device_id,
                                uint32_t boot_count,
                                uint32_t lifetime_queue_dropped,
                                uint32_t lifetime_protocol_errors,
                                uint32_t lifetime_mpu_read_errors) {
  JsonDocument document;
  char device_id_text[17];
  snprintf(device_id_text, sizeof(device_id_text), "%012llX",
           static_cast<unsigned long long>(device_id));
  document["v"] = kProtocolVersion;
  document["type"] = "health";
  document["device_id"] = device_id_text;
  document["firmware"] = pawpal::kFirmwareVersion;
  document["uptime_ms"] = uptime_ms;
  document["free_heap"] = free_heap;
  document["queue_dropped"] = queue_dropped;
  document["protocol_errors"] = parse_errors_;
  document["duplicate_commands"] = duplicate_commands_;
  document["mpu_available"] = mpu_available;
  document["mpu_read_errors"] = mpu_read_errors;
  document["boot_count"] = boot_count;
  document["lifetime_queue_dropped"] = lifetime_queue_dropped;
  document["lifetime_protocol_errors"] = lifetime_protocol_errors;
  document["lifetime_mpu_read_errors"] = lifetime_mpu_read_errors;
  serializeJson(document, Serial);
  Serial.println();
}
