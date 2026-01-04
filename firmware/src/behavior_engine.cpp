#include "behavior_engine.h"

#include <string.h>

namespace {

constexpr uint32_t kTouchExpressionMs = 2500;
constexpr uint32_t kMotionExpressionMs = 1500;
constexpr uint32_t kShakeExpressionMs = 2000;
constexpr uint32_t kTrainingRewardMs = 3000;

}  // namespace

const char* modeName(RobotMode mode) {
  switch (mode) {
    case RobotMode::kIdle: return "idle";
    case RobotMode::kCompanion: return "companion";
    case RobotMode::kTraining: return "training";
    case RobotMode::kMonitoring: return "monitoring";
    case RobotMode::kAlert: return "alert";
    case RobotMode::kError: return "error";
  }
  return "unknown";
}

const char* expressionName(Expression expression) {
  switch (expression) {
    case Expression::kNeutral: return "neutral";
    case Expression::kHappy: return "happy";
    case Expression::kCurious: return "curious";
    case Expression::kEncouraging: return "encouraging";
    case Expression::kSleepy: return "sleepy";
    case Expression::kWarning: return "warning";
    case Expression::kError: return "error";
  }
  return "unknown";
}

bool parseMode(const char* value, RobotMode* mode) {
  if (value == nullptr || mode == nullptr) return false;
  if (strcmp(value, "idle") == 0) *mode = RobotMode::kIdle;
  else if (strcmp(value, "companion") == 0) *mode = RobotMode::kCompanion;
  else if (strcmp(value, "training") == 0) *mode = RobotMode::kTraining;
  else if (strcmp(value, "monitoring") == 0) *mode = RobotMode::kMonitoring;
  else if (strcmp(value, "alert") == 0) *mode = RobotMode::kAlert;
  else if (strcmp(value, "error") == 0) *mode = RobotMode::kError;
  else return false;
  return true;
}

BehaviorEngine::BehaviorEngine(uint32_t now_ms) {
  state_.entered_mode_at_ms = now_ms;
  state_.last_interaction_at_ms = now_ms;
}

bool BehaviorEngine::setMode(RobotMode mode, uint32_t now_ms) {
  if (state_.alert_latched && mode != RobotMode::kAlert && mode != RobotMode::kError) {
    return false;
  }
  bool changed = state_.mode != mode;
  state_.mode = mode;
  if (changed) state_.entered_mode_at_ms = now_ms;
  state_.expression_until_ms = 0;
  changed = setExpression(baseExpression(mode), 0) || changed;
  return changed;
}

bool BehaviorEngine::setExpression(Expression expression, uint32_t until_ms) {
  const bool changed = state_.expression != expression ||
                       state_.expression_until_ms != until_ms;
  state_.expression = expression;
  state_.expression_until_ms = until_ms;
  return changed;
}

Expression BehaviorEngine::baseExpression(RobotMode mode) const {
  switch (mode) {
    case RobotMode::kIdle: return Expression::kNeutral;
    case RobotMode::kCompanion: return Expression::kCurious;
    case RobotMode::kTraining: return Expression::kCurious;
    case RobotMode::kMonitoring: return Expression::kSleepy;
    case RobotMode::kAlert: return Expression::kWarning;
    case RobotMode::kError: return Expression::kError;
  }
  return Expression::kNeutral;
}

BehaviorOutcome BehaviorEngine::handleWithOutcome(const RobotEvent& event) {
  bool changed = false;

  if (event.type == EventType::kAlertRaised) {
    state_.alert_latched = true;
    changed = setMode(RobotMode::kAlert, event.timestamp_ms);
    changed = setExpression(Expression::kWarning, 0) || changed;
  } else if (event.type == EventType::kAlertCleared) {
    if (!state_.alert_latched) return BehaviorOutcome(false, false, "no_active_alert");
    state_.alert_latched = false;
    changed = setMode(RobotMode::kMonitoring, event.timestamp_ms);
  } else if (state_.alert_latched) {
    return BehaviorOutcome(false, false, "alert_latched");
  } else {
    switch (event.type) {
      case EventType::kBootComplete:
        changed = setMode(RobotMode::kIdle, event.timestamp_ms);
        break;
      case EventType::kTouchTap:
        state_.last_interaction_at_ms = event.timestamp_ms;
        if (state_.mode == RobotMode::kIdle) {
          changed = setMode(RobotMode::kCompanion, event.timestamp_ms);
        }
        changed = setExpression(Expression::kHappy,
                                event.timestamp_ms + kTouchExpressionMs) || changed;
        break;
      case EventType::kTouchLongPress:
        state_.last_interaction_at_ms = event.timestamp_ms;
        changed = setMode(RobotMode::kCompanion, event.timestamp_ms);
        changed = setExpression(Expression::kCurious,
                                event.timestamp_ms + kTouchExpressionMs) || changed;
        break;
      case EventType::kMotionDetected:
        if (state_.mode != RobotMode::kIdle && state_.mode != RobotMode::kCompanion) {
          return BehaviorOutcome(false, false, "invalid_context");
        }
        changed = setExpression(Expression::kCurious,
                                event.timestamp_ms + kMotionExpressionMs);
        break;
      case EventType::kShakeDetected:
        changed = setExpression(Expression::kWarning,
                                event.timestamp_ms + kShakeExpressionMs);
        break;
      case EventType::kTrainingSuccess:
        if (state_.mode != RobotMode::kTraining) {
          return BehaviorOutcome(false, false, "invalid_context");
        }
        changed = setExpression(Expression::kEncouraging,
                                event.timestamp_ms + kTrainingRewardMs);
        break;
      case EventType::kSetMode:
        changed = setMode(event.requested_mode, event.timestamp_ms);
        break;
      case EventType::kPing:
        break;
      case EventType::kGetConfig:
      case EventType::kSetConfig:
      case EventType::kResetConfig:
        return BehaviorOutcome(false, false, "invalid_route");
      case EventType::kAlertRaised:
      case EventType::kAlertCleared:
        break;
    }
  }

  if (changed) ++state_.revision;
  return BehaviorOutcome(true, changed, nullptr);
}

bool BehaviorEngine::handle(const RobotEvent& event) {
  return handleWithOutcome(event).changed;
}

bool BehaviorEngine::tick(uint32_t now_ms) {
  if (state_.expression_until_ms == 0 || now_ms < state_.expression_until_ms) {
    return false;
  }
  const bool changed = setExpression(baseExpression(state_.mode), 0);
  if (changed) ++state_.revision;
  return changed;
}
