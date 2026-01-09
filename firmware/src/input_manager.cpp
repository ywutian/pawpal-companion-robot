#include "input_manager.h"

#include <math.h>

#include "hardware_config.h"

namespace {

constexpr uint32_t kTouchDebounceMs = 60;
constexpr uint32_t kLongPressMs = 800;
constexpr uint32_t kMotionSampleMs = 50;
constexpr uint32_t kMotionCooldownMs = 1200;
constexpr uint32_t kShakeCooldownMs = 2500;
constexpr uint32_t kMpuReinitMs = 5000;
constexpr uint8_t kMpuErrorsBeforeOffline = 5;

int16_t readSigned16(const uint8_t high, const uint8_t low) {
  return static_cast<int16_t>((static_cast<uint16_t>(high) << 8U) | low);
}

}  // namespace

void InputManager::configure(float motion_threshold_dps,
                             float shake_threshold_dps) {
  motion_threshold_dps_ = motion_threshold_dps;
  shake_threshold_dps_ = shake_threshold_dps;
}

void InputManager::begin() {
  pinMode(hardware::kTouchPin, INPUT);
  Wire.begin(hardware::kI2cSdaPin, hardware::kI2cSclPin);
  initializeMpu();
}

bool InputManager::initializeMpu() {
  Wire.beginTransmission(hardware::kMpu6050Address);
  Wire.write(0x6B);
  Wire.write(0x00);
  mpu_available_ = Wire.endTransmission() == 0;
  if (mpu_available_) consecutive_mpu_errors_ = 0;
  return mpu_available_;
}

bool InputManager::pollTouch(uint32_t now_ms, RobotEvent* event) {
  if (event == nullptr) return false;
  bool pressed = digitalRead(hardware::kTouchPin) ==
                 (hardware::kTouchActiveHigh ? HIGH : LOW);

  if (pressed && !touch_pressed_ && now_ms - last_touch_event_at_ms_ > kTouchDebounceMs) {
    touch_pressed_ = true;
    touch_started_at_ms_ = now_ms;
  } else if (!pressed && touch_pressed_) {
    touch_pressed_ = false;
    const uint32_t duration = now_ms - touch_started_at_ms_;
    last_touch_event_at_ms_ = now_ms;
    event->timestamp_ms = now_ms;
    event->intensity = static_cast<float>(duration);
    event->type = duration >= kLongPressMs ? EventType::kTouchLongPress
                                          : EventType::kTouchTap;
    return true;
  }
  return false;
}

bool InputManager::readMpu(float* accel_magnitude_g, float* gyro_magnitude_dps) {
  if (!mpu_available_ || accel_magnitude_g == nullptr || gyro_magnitude_dps == nullptr) {
    return false;
  }

  Wire.beginTransmission(hardware::kMpu6050Address);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) {
    ++mpu_read_errors_;
    if (++consecutive_mpu_errors_ >= kMpuErrorsBeforeOffline) mpu_available_ = false;
    return false;
  }
  if (Wire.requestFrom(hardware::kMpu6050Address, static_cast<uint8_t>(14)) != 14) {
    ++mpu_read_errors_;
    if (++consecutive_mpu_errors_ >= kMpuErrorsBeforeOffline) mpu_available_ = false;
    return false;
  }

  uint8_t bytes[14];
  for (uint8_t& byte : bytes) byte = Wire.read();
  const float ax = readSigned16(bytes[0], bytes[1]) / 16384.0F;
  const float ay = readSigned16(bytes[2], bytes[3]) / 16384.0F;
  const float az = readSigned16(bytes[4], bytes[5]) / 16384.0F;
  const float gx = readSigned16(bytes[8], bytes[9]) / 131.0F;
  const float gy = readSigned16(bytes[10], bytes[11]) / 131.0F;
  const float gz = readSigned16(bytes[12], bytes[13]) / 131.0F;
  *accel_magnitude_g = sqrtf(ax * ax + ay * ay + az * az);
  *gyro_magnitude_dps = sqrtf(gx * gx + gy * gy + gz * gz);
  consecutive_mpu_errors_ = 0;
  return true;
}

bool InputManager::pollMotion(uint32_t now_ms, RobotEvent* event) {
  if (event == nullptr || now_ms - last_motion_sample_at_ms_ < kMotionSampleMs) {
    return false;
  }
  last_motion_sample_at_ms_ = now_ms;

  if (!mpu_available_ && now_ms - last_mpu_reinit_at_ms_ >= kMpuReinitMs) {
    last_mpu_reinit_at_ms_ = now_ms;
    initializeMpu();
  }

  float accel_g = 0.0F;
  float gyro_dps = 0.0F;
  if (!readMpu(&accel_g, &gyro_dps)) return false;
  filtered_gyro_dps_ = 0.75F * filtered_gyro_dps_ + 0.25F * gyro_dps;

  event->timestamp_ms = now_ms;
  event->intensity = filtered_gyro_dps_;
  if (filtered_gyro_dps_ >= shake_threshold_dps_ &&
      now_ms - last_shake_event_at_ms_ >= kShakeCooldownMs) {
    last_shake_event_at_ms_ = now_ms;
    event->type = EventType::kShakeDetected;
    return true;
  }

  const bool displaced = fabsf(accel_g - 1.0F) > 0.18F;
  if ((filtered_gyro_dps_ >= motion_threshold_dps_ || displaced) &&
      now_ms - last_motion_event_at_ms_ >= kMotionCooldownMs) {
    last_motion_event_at_ms_ = now_ms;
    event->type = EventType::kMotionDetected;
    return true;
  }
  return false;
}
