#pragma once

#include <Arduino.h>
#include <Wire.h>

#include "robot_model.h"

class InputManager {
 public:
  void begin();
  void configure(float motion_threshold_dps, float shake_threshold_dps);
  bool pollTouch(uint32_t now_ms, RobotEvent* event);
  bool pollMotion(uint32_t now_ms, RobotEvent* event);
  bool mpuAvailable() const { return mpu_available_; }
  uint32_t mpuReadErrors() const { return mpu_read_errors_; }

 private:
  bool initializeMpu();
  bool readMpu(float* accel_magnitude_g, float* gyro_magnitude_dps);

  bool touch_pressed_ = false;
  uint32_t touch_started_at_ms_ = 0;
  uint32_t last_touch_event_at_ms_ = 0;
  uint32_t last_motion_sample_at_ms_ = 0;
  uint32_t last_motion_event_at_ms_ = 0;
  uint32_t last_shake_event_at_ms_ = 0;
  float filtered_gyro_dps_ = 0.0F;
  bool mpu_available_ = false;
  uint8_t consecutive_mpu_errors_ = 0;
  uint32_t mpu_read_errors_ = 0;
  uint32_t last_mpu_reinit_at_ms_ = 0;
  float motion_threshold_dps_ = 45.0F;
  float shake_threshold_dps_ = 180.0F;
};
