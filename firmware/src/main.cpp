#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <esp_task_wdt.h>
#include <Preferences.h>

#include "behavior_engine.h"
#include "device_config.h"
#include "display_renderer.h"
#include "input_manager.h"
#include "serial_protocol.h"

namespace {

BehaviorEngine behavior;
DisplayRenderer renderer;
InputManager inputs;
SerialProtocol protocol;
DeviceConfigStore config_store;
Preferences diagnostics_preferences;
QueueHandle_t event_queue = nullptr;
uint32_t last_state_publish_at_ms = 0;
uint32_t last_health_publish_at_ms = 0;
volatile uint32_t queue_dropped = 0;
uint32_t last_diagnostics_persist_at_ms = 0;
uint32_t boot_count = 0;
uint32_t lifetime_queue_base = 0;
uint32_t lifetime_protocol_base = 0;
uint32_t lifetime_mpu_base = 0;

void postEvent(const RobotEvent& event) {
  if (event_queue != nullptr && xQueueSend(event_queue, &event, 0) != pdTRUE) {
    ++queue_dropped;
  }
}

void inputTask(void*) {
  esp_task_wdt_add(nullptr);
  for (;;) {
    const uint32_t now_ms = millis();
    RobotEvent event;
    if (inputs.pollTouch(now_ms, &event)) postEvent(event);
    if (inputs.pollMotion(now_ms, &event)) postEvent(event);
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

}  // namespace

void setup() {
  esp_task_wdt_init(8, true);
  esp_task_wdt_add(nullptr);
  protocol.begin();
  config_store.begin();
  diagnostics_preferences.begin("pawpal-diag", false);
  boot_count = diagnostics_preferences.getUInt("boots", 0) + 1U;
  diagnostics_preferences.putUInt("boots", boot_count);
  lifetime_queue_base = diagnostics_preferences.getUInt("queue", 0);
  lifetime_protocol_base = diagnostics_preferences.getUInt("protocol", 0);
  lifetime_mpu_base = diagnostics_preferences.getUInt("mpu", 0);
  renderer.begin();
  inputs.configure(config_store.config().motion_threshold_dps,
                   config_store.config().shake_threshold_dps);
  inputs.begin();
  event_queue = xQueueCreate(12, sizeof(RobotEvent));
  xTaskCreatePinnedToCore(inputTask, "input", 4096, nullptr, 2, nullptr, 0);

  RobotEvent boot;
  boot.type = EventType::kBootComplete;
  boot.timestamp_ms = millis();
  postEvent(boot);
}

void loop() {
  const uint32_t now_ms = millis();
  RobotEvent event;

  if (protocol.poll(now_ms, &event)) postEvent(event);

  bool changed = false;
  while (xQueueReceive(event_queue, &event, 0) == pdTRUE) {
    if (event.type == EventType::kGetConfig ||
        event.type == EventType::kSetConfig ||
        event.type == EventType::kResetConfig) {
      bool accepted = true;
      const char* error = nullptr;
      bool restart_required = false;
      if (event.type == EventType::kSetConfig) {
        accepted = config_store.set(event.config_key, event.config_value, &error);
        restart_required = accepted;
      } else if (event.type == EventType::kResetConfig) {
        config_store.reset();
        restart_required = true;
      }
      if (event.requires_ack) {
        protocol.sendAck(event.command_id, accepted, error, true);
      }
      protocol.sendConfig(config_store.config().motion_threshold_dps,
                          config_store.config().shake_threshold_dps,
                          config_store.config().revision, restart_required);
      continue;
    }
    const BehaviorOutcome outcome = behavior.handleWithOutcome(event);
    if (event.requires_ack) {
      protocol.sendAck(event.command_id, outcome.accepted,
                       outcome.accepted ? nullptr : outcome.reason, true);
    }
    changed = outcome.changed || changed;
  }
  changed = behavior.tick(now_ms) || changed;

  renderer.render(behavior.state(), now_ms);
  if (changed || now_ms - last_state_publish_at_ms >= 5000U) {
    protocol.sendState(behavior.state());
    last_state_publish_at_ms = now_ms;
  }
  if (now_ms - last_health_publish_at_ms >= 10000U) {
    protocol.sendHealth(now_ms, ESP.getFreeHeap(), queue_dropped,
                        inputs.mpuAvailable(), inputs.mpuReadErrors(),
                        ESP.getEfuseMac(), boot_count,
                        lifetime_queue_base + queue_dropped,
                        lifetime_protocol_base + protocol.parseErrors(),
                        lifetime_mpu_base + inputs.mpuReadErrors());
    last_health_publish_at_ms = now_ms;
  }
  if (now_ms - last_diagnostics_persist_at_ms >= 30000U) {
    diagnostics_preferences.putUInt("queue", lifetime_queue_base + queue_dropped);
    diagnostics_preferences.putUInt("protocol",
                                    lifetime_protocol_base + protocol.parseErrors());
    diagnostics_preferences.putUInt("mpu",
                                    lifetime_mpu_base + inputs.mpuReadErrors());
    last_diagnostics_persist_at_ms = now_ms;
  }
  esp_task_wdt_reset();
  delay(2);
}
