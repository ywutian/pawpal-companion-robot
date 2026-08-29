#include <unity.h>

#include <stdio.h>
#include <string.h>

#include "behavior_engine.h"

// Replays the shared fixture that simulator/behavior-conformance.test.mjs
// also replays, so the C++ and JS behavior implementations cannot drift.

namespace {

FILE* openFixture() {
  const char* candidates[] = {
      "test/test_conformance/behavior_conformance.txt",
      "firmware/test/test_conformance/behavior_conformance.txt",
      "../test/test_conformance/behavior_conformance.txt",
  };
  for (const char* path : candidates) {
    FILE* file = fopen(path, "r");
    if (file != nullptr) return file;
  }
  return nullptr;
}

bool makeEvent(const char* op, const char* arg, uint32_t at, RobotEvent* event) {
  event->timestamp_ms = at;
  if (strcmp(op, "mode") == 0) {
    event->type = EventType::kSetMode;
    return parseMode(arg, &event->requested_mode);
  }
  if (strcmp(arg, "touch") == 0) event->type = EventType::kTouchTap;
  else if (strcmp(arg, "long_press") == 0) event->type = EventType::kTouchLongPress;
  else if (strcmp(arg, "motion") == 0) event->type = EventType::kMotionDetected;
  else if (strcmp(arg, "shake") == 0) event->type = EventType::kShakeDetected;
  else if (strcmp(arg, "training_success") == 0) event->type = EventType::kTrainingSuccess;
  else if (strcmp(arg, "alert_raised") == 0) event->type = EventType::kAlertRaised;
  else if (strcmp(arg, "alert_cleared") == 0) event->type = EventType::kAlertCleared;
  else return false;
  return true;
}

void test_fixture_replays_identically_to_the_simulator() {
  FILE* file = openFixture();
  TEST_ASSERT_NOT_NULL_MESSAGE(file, "behavior_conformance.txt not found");

  BehaviorEngine engine;
  char line[200];
  int steps = 0;
  while (fgets(line, sizeof(line), file) != nullptr) {
    uint32_t at = 0;
    uint32_t expected_revision = 0;
    char op[16], arg[32], expect[40], mode[16], expression[16];
    if (line[0] == '#' ||
        sscanf(line, "%u %15s %31s %39s %15s %15s %u", &at, op, arg, expect,
               mode, expression, &expected_revision) != 7) {
      continue;
    }
    ++steps;

    bool accepted = true;
    const char* reason = nullptr;
    if (strcmp(op, "tick") == 0) {
      engine.tick(at);
    } else {
      RobotEvent event;
      TEST_ASSERT_TRUE_MESSAGE(makeEvent(op, arg, at, &event), line);
      const BehaviorOutcome outcome = engine.handleWithOutcome(event);
      accepted = outcome.accepted;
      reason = outcome.reason;
    }

    if (strncmp(expect, "reject:", 7) == 0) {
      TEST_ASSERT_FALSE_MESSAGE(accepted, line);
      TEST_ASSERT_NOT_NULL_MESSAGE(reason, line);
      TEST_ASSERT_EQUAL_STRING_MESSAGE(expect + 7, reason, line);
    } else {
      TEST_ASSERT_TRUE_MESSAGE(accepted, line);
    }
    TEST_ASSERT_EQUAL_STRING_MESSAGE(mode, modeName(engine.state().mode), line);
    TEST_ASSERT_EQUAL_STRING_MESSAGE(
        expression, expressionName(engine.state().expression), line);
    TEST_ASSERT_EQUAL_UINT32_MESSAGE(expected_revision, engine.state().revision,
                                     line);
  }
  fclose(file);
  TEST_ASSERT_GREATER_OR_EQUAL_MESSAGE(20, steps, "fixture unexpectedly short");
}

}  // namespace

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_fixture_replays_identically_to_the_simulator);
  return UNITY_END();
}
