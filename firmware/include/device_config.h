#pragma once

#include <Arduino.h>
#include <Preferences.h>

struct DeviceConfig {
  float motion_threshold_dps = 45.0F;
  float shake_threshold_dps = 180.0F;
  uint32_t revision = 0;
};

class DeviceConfigStore {
 public:
  bool begin();
  bool set(const char* key, float value, const char** error);
  void reset();
  const DeviceConfig& config() const { return config_; }

 private:
  void persist();

  Preferences preferences_;
  DeviceConfig config_;
};
