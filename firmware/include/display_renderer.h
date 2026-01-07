#pragma once

#include <Adafruit_ST7789.h>

#include "robot_model.h"

class DisplayRenderer {
 public:
  DisplayRenderer();
  void begin();
  void render(const RobotState& state, uint32_t now_ms);

 private:
  void drawFace(Expression expression, uint32_t now_ms);
  void drawEye(int center_x, int center_y, int width, int height,
               uint16_t color, int pupil_offset_x, int pupil_offset_y);
  void drawStatus(const RobotState& state);

  Adafruit_ST7789 display_;
  uint32_t last_frame_at_ms_ = 0;
};

