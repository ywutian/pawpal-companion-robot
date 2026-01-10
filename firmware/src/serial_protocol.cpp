#include "serial_protocol.h"

#include <ArduinoJson.h>
#include <string.h>

#include "hardware_config.h"

constexpr uint8_t SerialProtocol::kProtocolVersion;

void SerialProtocol::begin() {
  Serial.begin(hardware::kSerialBaud);
  buffer_.reserve(256);
  if (ack_preferences_.begin("pawpal-ack", false) &&
      ack_preferences_.getUInt("schema", 0) == 1 &&
      ack_preferences_.getBytesLength("cache") == sizeof(ack_cache_)) {
    ack_preferences_.getBytes("cache", ack_cache_, sizeof(ack_cache_));
    next_cache_index_ = ack_preferences_.getUChar("next", 0) % 8U;
  }
}

bool SerialProtocol::poll(uint32_t now_ms, RobotEvent* event) {
  while (Serial.available() > 0) {
    const char value = static_cast<char>(Serial.read());
    if (value == '\n') {
      if (frame_overflow_) {
        frame_overflow_ = false;
        buffer_ = "";
        ++parse_errors_;
        sendAck("", false, "frame_too_long");
        return false;
      }
      String line = buffer_;
      buffer_ = "";
      line.trim();
      if (line.length() > 0) return parseLine(line, now_ms, event);
    } else if (value != '\r') {
      if (buffer_.length() < 512 && !frame_overflow_) buffer_ += value;
      else frame_overflow_ = true;
    }
  }
  return false;
}

bool SerialProtocol::parseLine(const String& line, uint32_t now_ms,
                               RobotEvent* event) {
  if (event == nullptr) return false;
  JsonDocument document;
  DeserializationError error = deserializeJson(document, line);
  if (error) {
    ++parse_errors_;
    sendAck("", false, "invalid_json");
    return false;
  }

  command_id_ = document["id"] | "";
  const int protocol_version = document["v"] | kProtocolVersion;
  if (protocol_version != kProtocolVersion) {
    ++parse_errors_;
    sendAck(command_id_.c_str(), false, "unsupported_version");
    return false;
  }
  if (command_id_.length() == 0) {
    ++parse_errors_;
    sendAck("", false, "missing_id");
    return false;
  }
  if (command_id_.length() >= sizeof(event->command_id)) {
    ++parse_errors_;
    sendAck("", false, "id_too_long");
    return false;
  }
  if (replayCachedAck(command_id_.c_str())) return false;

  const char* type = document["type"] | "";
  event->timestamp_ms = now_ms;
  event->intensity = document["intensity"] | 0.0F;
  event->requires_ack = true;
  strncpy(event->command_id, command_id_.c_str(), sizeof(event->command_id) - 1);
  event->command_id[sizeof(event->command_id) - 1] = '\0';

  if (strcmp(type, "ping") == 0) {
    event->type = EventType::kPing;
  } else if (strcmp(type, "get_config") == 0) {
    event->type = EventType::kGetConfig;
  } else if (strcmp(type, "reset_config") == 0) {
    event->type = EventType::kResetConfig;
  } else if (strcmp(type, "set_config") == 0) {
    const char* key = document["key"] | "";
    if (strlen(key) == 0 || strlen(key) >= sizeof(event->config_key) ||
        !document["value"].is<float>()) {
      ++parse_errors_;
      sendAck(command_id_.c_str(), false, "invalid_config");
      return false;
    }
    strncpy(event->config_key, key, sizeof(event->config_key) - 1);
    event->config_key[sizeof(event->config_key) - 1] = '\0';
    event->config_value = document["value"].as<float>();
    event->type = EventType::kSetConfig;
  } else if (strcmp(type, "set_mode") == 0) {
    RobotMode mode;
    if (!parseMode(document["mode"] | "", &mode)) {
      ++parse_errors_;
      sendAck(command_id_.c_str(), false, "unknown_mode");
      return false;
    }
    event->type = EventType::kSetMode;
    event->requested_mode = mode;
  } else if (strcmp(type, "event") == 0) {
    const char* event_name = document["event"] | "";
    if (strcmp(event_name, "training_success") == 0) {
      event->type = EventType::kTrainingSuccess;
    } else if (strcmp(event_name, "alert_raised") == 0) {
      event->type = EventType::kAlertRaised;
    } else if (strcmp(event_name, "alert_cleared") == 0) {
      event->type = EventType::kAlertCleared;
    } else if (strcmp(event_name, "motion") == 0) {
      event->type = EventType::kMotionDetected;
    } else if (strcmp(event_name, "shake") == 0) {
      event->type = EventType::kShakeDetected;
    } else {
      ++parse_errors_;
      sendAck(command_id_.c_str(), false, "unknown_event");
      return false;
    }
  } else {
    ++parse_errors_;
    sendAck(command_id_.c_str(), false, "unknown_type");
    return false;
  }

  return true;
}

bool SerialProtocol::replayCachedAck(const char* id) {
  if (id == nullptr || id[0] == '\0') return false;
  for (const CachedAck& cached : ack_cache_) {
    if (!cached.occupied || strcmp(cached.id, id) != 0) continue;
    JsonDocument document;
    document["v"] = kProtocolVersion;
    document["type"] = "ack";
    document["id"] = cached.id;
    document["accepted"] = cached.accepted;
    document["duplicate"] = true;
    if (cached.error[0] != '\0') document["error"] = cached.error;
    serializeJson(document, Serial);
    Serial.println();
    ++duplicate_commands_;
    return true;
  }
  return false;
}

void SerialProtocol::cacheAck(const char* id, bool accepted, const char* error) {
  if (id == nullptr || id[0] == '\0') return;
  CachedAck& cached = ack_cache_[next_cache_index_];
  strncpy(cached.id, id, sizeof(cached.id) - 1);
  cached.id[sizeof(cached.id) - 1] = '\0';
  cached.error[0] = '\0';
  if (error != nullptr) {
    strncpy(cached.error, error, sizeof(cached.error) - 1);
    cached.error[sizeof(cached.error) - 1] = '\0';
  }
  cached.accepted = accepted;
  cached.occupied = true;
  next_cache_index_ = (next_cache_index_ + 1U) % 8U;
  ack_preferences_.putUInt("schema", 1);
  ack_preferences_.putBytes("cache", ack_cache_, sizeof(ack_cache_));
  ack_preferences_.putUChar("next", next_cache_index_);
}
