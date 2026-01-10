#pragma once

#include <Arduino.h>
#include <Preferences.h>

#include "robot_model.h"

class SerialProtocol {
 public:
  static constexpr uint8_t kProtocolVersion = 1;

  void begin();
  bool poll(uint32_t now_ms, RobotEvent* event);
  void sendAck(const char* id, bool accepted, const char* error = nullptr,
               bool cache_result = false);
  void sendState(const RobotState& state);
  void sendConfig(float motion_threshold_dps, float shake_threshold_dps,
                  uint32_t revision, bool restart_required);
  void sendHealth(uint32_t uptime_ms, uint32_t free_heap,
                  uint32_t queue_dropped, bool mpu_available,
                  uint32_t mpu_read_errors, uint64_t device_id,
                  uint32_t boot_count, uint32_t lifetime_queue_dropped,
                  uint32_t lifetime_protocol_errors,
                  uint32_t lifetime_mpu_read_errors);
  uint32_t parseErrors() const { return parse_errors_; }
  uint32_t duplicateCommands() const { return duplicate_commands_; }

 private:
  struct CachedAck {
    char id[25] = {};
    char error[25] = {};
    bool accepted = false;
    bool occupied = false;
  };

  bool parseLine(const String& line, uint32_t now_ms, RobotEvent* event);
  bool replayCachedAck(const char* id);
  void cacheAck(const char* id, bool accepted, const char* error);
  String buffer_;
  bool frame_overflow_ = false;
  String command_id_;
  CachedAck ack_cache_[8];
  uint8_t next_cache_index_ = 0;
  uint32_t parse_errors_ = 0;
  uint32_t duplicate_commands_ = 0;
  Preferences ack_preferences_;
};
