#include "device_config.h"

#include <string.h>

namespace {

constexpr uint32_t kConfigSchema = 1;

}  // namespace

bool DeviceConfigStore::begin() {
  if (!preferences_.begin("pawpal-config", false)) return false;
  if (preferences_.getUInt("schema", 0) != kConfigSchema) {
    reset();
    return true;
  }
  config_.motion_threshold_dps = preferences_.getFloat("motion", 45.0F);
  config_.shake_threshold_dps = preferences_.getFloat("shake", 180.0F);
  config_.revision = preferences_.getUInt("revision", 0);
  return true;
}

bool DeviceConfigStore::set(const char* key, float value, const char** error) {
  if (key == nullptr) {
    if (error != nullptr) *error = "unknown_config";
    return false;
  }
  if (strcmp(key, "motion_threshold_dps") == 0) {
    if (value < 5.0F || value > 150.0F || value >= config_.shake_threshold_dps) {
      if (error != nullptr) *error = "config_out_of_range";
      return false;
    }
    config_.motion_threshold_dps = value;
  } else if (strcmp(key, "shake_threshold_dps") == 0) {
    if (value < 60.0F || value > 500.0F || value <= config_.motion_threshold_dps) {
      if (error != nullptr) *error = "config_out_of_range";
      return false;
    }
    config_.shake_threshold_dps = value;
  } else {
    if (error != nullptr) *error = "unknown_config";
    return false;
  }
  ++config_.revision;
  persist();
  return true;
}

void DeviceConfigStore::reset() {
  config_ = DeviceConfig();
  ++config_.revision;
  persist();
}

void DeviceConfigStore::persist() {
  preferences_.putUInt("schema", kConfigSchema);
  preferences_.putFloat("motion", config_.motion_threshold_dps);
  preferences_.putFloat("shake", config_.shake_threshold_dps);
  preferences_.putUInt("revision", config_.revision);
}
