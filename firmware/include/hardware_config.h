#pragma once

#include <stdint.h>

// ESP32-S3 DevKitC defaults. Change these values to match the actual board.
namespace hardware {

constexpr int kTftChipSelectPin = 10;
constexpr int kTftDataCommandPin = 9;
constexpr int kTftResetPin = 14;
constexpr int kTftMosiPin = 11;
constexpr int kTftClockPin = 12;

constexpr int kTouchPin = 4;
constexpr bool kTouchActiveHigh = true;

constexpr int kI2cSdaPin = 8;
constexpr int kI2cSclPin = 18;
constexpr uint8_t kMpu6050Address = 0x68;

constexpr int kDisplayWidth = 240;
constexpr int kDisplayHeight = 240;
constexpr uint32_t kSerialBaud = 115200;

}  // namespace hardware

