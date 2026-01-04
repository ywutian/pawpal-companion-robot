#include <unity.h>

#include "behavior_engine.h"

namespace {

RobotEvent makeEvent(EventType type, uint32_t timestamp_ms) {
  RobotEvent event;
  event.type = type;
  event.timestamp_ms = timestamp_ms;
  return event;
}

void test_touch_enters_companion_and_expires_to_base_expression() {
  BehaviorEngine engine;
  TEST_ASSERT_TRUE(engine.handle(makeEvent(EventType::kTouchTap, 100)));
  TEST_ASSERT_EQUAL_STRING("companion", modeName(engine.state().mode));
  TEST_ASSERT_EQUAL_STRING("happy", expressionName(engine.state().expression));
  TEST_ASSERT_FALSE(engine.tick(2000));
  TEST_ASSERT_TRUE(engine.tick(2700));
  TEST_ASSERT_EQUAL_STRING("curious", expressionName(engine.state().expression));
}

void test_training_success_only_changes_training_mode() {
  BehaviorEngine engine;
  TEST_ASSERT_FALSE(engine.handle(makeEvent(EventType::kTrainingSuccess, 10)));
  RobotEvent set_mode = makeEvent(EventType::kSetMode, 20);
  set_mode.requested_mode = RobotMode::kTraining;
  TEST_ASSERT_TRUE(engine.handle(set_mode));
  TEST_ASSERT_TRUE(engine.handle(makeEvent(EventType::kTrainingSuccess, 30)));
  TEST_ASSERT_EQUAL_STRING("encouraging", expressionName(engine.state().expression));
}

void test_alert_latches_and_rejects_lower_priority_mode() {
  BehaviorEngine engine;
  TEST_ASSERT_TRUE(engine.handle(makeEvent(EventType::kAlertRaised, 100)));
  RobotEvent set_mode = makeEvent(EventType::kSetMode, 200);
  set_mode.requested_mode = RobotMode::kCompanion;
  TEST_ASSERT_FALSE(engine.handle(set_mode));
  TEST_ASSERT_EQUAL_STRING("alert", modeName(engine.state().mode));
  TEST_ASSERT_TRUE(engine.handle(makeEvent(EventType::kAlertCleared, 300)));
  TEST_ASSERT_EQUAL_STRING("monitoring", modeName(engine.state().mode));
}

void test_alert_rejection_reports_protocol_reason() {
  BehaviorEngine engine;
  TEST_ASSERT_TRUE(engine.handleWithOutcome(
      makeEvent(EventType::kAlertRaised, 100)).accepted);
  RobotEvent set_mode = makeEvent(EventType::kSetMode, 200);
  set_mode.requested_mode = RobotMode::kCompanion;
  const BehaviorOutcome outcome = engine.handleWithOutcome(set_mode);
  TEST_ASSERT_FALSE(outcome.accepted);
  TEST_ASSERT_FALSE(outcome.changed);
  TEST_ASSERT_EQUAL_STRING("alert_latched", outcome.reason);
}

void test_same_mode_is_accepted_without_revision_change() {
  BehaviorEngine engine;
  RobotEvent set_mode = makeEvent(EventType::kSetMode, 100);
  set_mode.requested_mode = RobotMode::kIdle;
  const BehaviorOutcome outcome = engine.handleWithOutcome(set_mode);
  TEST_ASSERT_TRUE(outcome.accepted);
  TEST_ASSERT_FALSE(outcome.changed);
  TEST_ASSERT_EQUAL_UINT32(0, engine.state().revision);
}

void test_ping_is_accepted_without_state_change() {
  BehaviorEngine engine;
  const BehaviorOutcome outcome = engine.handleWithOutcome(
      makeEvent(EventType::kPing, 100));
  TEST_ASSERT_TRUE(outcome.accepted);
  TEST_ASSERT_FALSE(outcome.changed);
  TEST_ASSERT_EQUAL_UINT32(0, engine.state().revision);
}

}  // namespace

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_touch_enters_companion_and_expires_to_base_expression);
  RUN_TEST(test_training_success_only_changes_training_mode);
  RUN_TEST(test_alert_latches_and_rejects_lower_priority_mode);
  RUN_TEST(test_alert_rejection_reports_protocol_reason);
  RUN_TEST(test_same_mode_is_accepted_without_revision_change);
  RUN_TEST(test_ping_is_accepted_without_state_change);
  return UNITY_END();
}
