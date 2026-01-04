#pragma once

#include "robot_model.h"

struct BehaviorOutcome {
  BehaviorOutcome(bool is_accepted = false, bool did_change = false,
                  const char* rejection_reason = nullptr)
      : accepted(is_accepted), changed(did_change), reason(rejection_reason) {}

  bool accepted;
  bool changed;
  const char* reason;
};

class BehaviorEngine {
 public:
  explicit BehaviorEngine(uint32_t now_ms = 0);

  bool handle(const RobotEvent& event);
  BehaviorOutcome handleWithOutcome(const RobotEvent& event);
  bool tick(uint32_t now_ms);
  const RobotState& state() const { return state_; }

 private:
  bool setMode(RobotMode mode, uint32_t now_ms);
  bool setExpression(Expression expression, uint32_t until_ms);
  Expression baseExpression(RobotMode mode) const;

  RobotState state_;
};
