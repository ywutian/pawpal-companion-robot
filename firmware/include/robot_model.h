#pragma once

#include <stdint.h>

enum class RobotMode : uint8_t {
  kIdle,
  kCompanion,
  kTraining,
  kMonitoring,
  kAlert,
  kError,
};

enum class Expression : uint8_t {
  kNeutral,
  kHappy,
  kCurious,
  kEncouraging,
  kSleepy,
  kWarning,
  kError,
};

enum class EventType : uint8_t {
  kBootComplete,
  kTouchTap,
  kTouchLongPress,
  kMotionDetected,
  kShakeDetected,
  kTrainingSuccess,
  kAlertRaised,
  kAlertCleared,
  kSetMode,
  kPing,
  kGetConfig,
  kSetConfig,
  kResetConfig,
};

struct RobotEvent {
  EventType type = EventType::kBootComplete;
  uint32_t timestamp_ms = 0;
  float intensity = 0.0F;
  RobotMode requested_mode = RobotMode::kIdle;
  char command_id[25] = {};
  char config_key[25] = {};
  float config_value = 0.0F;
  bool requires_ack = false;
};

struct RobotState {
  RobotMode mode = RobotMode::kIdle;
  Expression expression = Expression::kNeutral;
  uint32_t entered_mode_at_ms = 0;
  uint32_t expression_until_ms = 0;
  uint32_t last_interaction_at_ms = 0;
  bool alert_latched = false;
  uint32_t revision = 0;
};

const char* modeName(RobotMode mode);
const char* expressionName(Expression expression);
bool parseMode(const char* value, RobotMode* mode);
