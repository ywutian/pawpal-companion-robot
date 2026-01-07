#include "display_renderer.h"

#include <Arduino.h>
#include <SPI.h>

#include "hardware_config.h"

namespace {

constexpr uint16_t kBackground = ST77XX_BLACK;
constexpr uint16_t kFaceColor = ST77XX_CYAN;
constexpr uint16_t kHappyColor = ST77XX_GREEN;
constexpr uint16_t kWarningColor = ST77XX_YELLOW;
constexpr uint16_t kErrorColor = ST77XX_RED;

}  // namespace

DisplayRenderer::DisplayRenderer()
    : display_(&SPI, hardware::kTftChipSelectPin,
               hardware::kTftDataCommandPin, hardware::kTftResetPin) {}

void DisplayRenderer::begin() {
  SPI.begin(hardware::kTftClockPin, -1, hardware::kTftMosiPin,
            hardware::kTftChipSelectPin);
  display_.init(hardware::kDisplayWidth, hardware::kDisplayHeight);
  display_.setRotation(0);
  display_.fillScreen(kBackground);
  display_.setTextWrap(false);
}

void DisplayRenderer::drawEye(int center_x, int center_y, int width, int height,
                              uint16_t color, int pupil_offset_x,
                              int pupil_offset_y) {
  display_.fillRoundRect(center_x - width / 2, center_y - height / 2,
                         width, height, height / 2, color);
  const int pupil_radius = max(4, min(width, height) / 6);
  display_.fillCircle(center_x + pupil_offset_x, center_y + pupil_offset_y,
                      pupil_radius, kBackground);
}

void DisplayRenderer::drawFace(Expression expression, uint32_t now_ms) {
  display_.fillRect(0, 25, hardware::kDisplayWidth, 170, kBackground);

  uint16_t color = kFaceColor;
  int eye_width = 54;
  int eye_height = 72;
  int pupil_x = 0;
  int pupil_y = 0;
  const bool blink = (now_ms % 4200U) > 4070U;

  switch (expression) {
    case Expression::kHappy:
    case Expression::kEncouraging:
      color = kHappyColor;
      eye_height = 58;
      pupil_y = -4;
      break;
    case Expression::kCurious:
      eye_width = 60;
      pupil_x = static_cast<int>((now_ms / 700U) % 3U) * 4 - 4;
      break;
    case Expression::kSleepy:
      eye_height = 24;
      pupil_y = 5;
      break;
    case Expression::kWarning:
      color = kWarningColor;
      eye_height = 42;
      pupil_y = -3;
      break;
    case Expression::kError:
      color = kErrorColor;
      eye_height = 36;
      break;
    case Expression::kNeutral:
      break;
  }

  if (blink && expression != Expression::kWarning &&
      expression != Expression::kError) {
    eye_height = 6;
  }

  drawEye(72, 105, eye_width, eye_height, color, pupil_x, pupil_y);
  drawEye(168, 105, eye_width, eye_height, color, pupil_x, pupil_y);

  if (expression == Expression::kHappy ||
      expression == Expression::kEncouraging) {
    display_.drawRoundRect(90, 157, 60, 25, 12, color);
    display_.fillRect(90, 157, 60, 12, kBackground);
  } else if (expression == Expression::kWarning ||
             expression == Expression::kError) {
    display_.drawLine(95, 174, 145, 158, color);
  } else {
    display_.drawLine(100, 166, 140, 166, color);
  }
}

void DisplayRenderer::drawStatus(const RobotState& state) {
  display_.fillRect(0, 198, hardware::kDisplayWidth, 42, kBackground);
  display_.setTextColor(ST77XX_WHITE, kBackground);
  display_.setTextSize(2);
  display_.setCursor(8, 202);
  display_.print(modeName(state.mode));
  display_.setTextSize(1);
  display_.setCursor(8, 226);
  display_.print(expressionName(state.expression));
  display_.setCursor(190, 226);
  display_.print("r");
  display_.print(state.revision);
}

void DisplayRenderer::render(const RobotState& state, uint32_t now_ms) {
  if (now_ms - last_frame_at_ms_ < 33U) return;
  last_frame_at_ms_ = now_ms;
  drawFace(state.expression, now_ms);
  drawStatus(state);
}

