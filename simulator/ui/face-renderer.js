const COLORS = Object.freeze({
  background: "#050706",
  default: "#6dd7c3",
  positive: "#6dd7a0",
  warning: "#f0b94d",
  error: "#ff7369",
  text: "#d8ded9",
  muted: "#89938d",
});

function expressionColor(expression) {
  if (["happy", "encouraging"].includes(expression)) return COLORS.positive;
  if (expression === "warning") return COLORS.warning;
  if (expression === "error") return COLORS.error;
  return COLORS.default;
}

export function createFaceRenderer(canvas) {
  const context = canvas.getContext("2d");

  function roundedRect(x, y, width, height, radius) {
    context.beginPath();
    context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2));
    context.fill();
  }

  function drawEye(centerX, centerY, width, height, color, pupilX, pupilY) {
    context.fillStyle = color;
    roundedRect(centerX - width / 2, centerY - height / 2, width, height, height / 2);
    context.fillStyle = COLORS.background;
    context.beginPath();
    context.arc(
      centerX + pupilX,
      centerY + pupilY,
      Math.max(4, Math.min(width, height) / 6),
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  function eyeGeometry(expression, now) {
    const geometry = { width: 54, height: 72, pupilX: 0, pupilY: 0 };
    if (["happy", "encouraging"].includes(expression)) {
      geometry.height = 58;
      geometry.pupilY = -4;
    } else if (expression === "curious") {
      geometry.width = 60;
      geometry.pupilX = (Math.floor(now / 700) % 3) * 4 - 4;
    } else if (expression === "sleepy") {
      geometry.height = 24;
      geometry.pupilY = 5;
    } else if (expression === "warning") {
      geometry.height = 42;
      geometry.pupilY = -3;
    } else if (expression === "error") {
      geometry.height = 36;
    }
    const canBlink = !["warning", "error"].includes(expression);
    if (canBlink && now % 4200 > 4070) geometry.height = 6;
    return geometry;
  }

  function drawMouth(expression, color) {
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    if (["happy", "encouraging"].includes(expression)) {
      context.arc(120, 150, 30, 0.2, Math.PI - 0.2);
    } else if (["warning", "error"].includes(expression)) {
      context.moveTo(95, 174);
      context.lineTo(145, 158);
    } else {
      context.moveTo(100, 166);
      context.lineTo(140, 166);
    }
    context.stroke();
  }

  return function drawFace(state, now) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const color = expressionColor(state.expression);
    const eye = eyeGeometry(state.expression, now);
    drawEye(72, 105, eye.width, eye.height, color, eye.pupilX, eye.pupilY);
    drawEye(168, 105, eye.width, eye.height, color, eye.pupilX, eye.pupilY);
    drawMouth(state.expression, color);

    context.fillStyle = COLORS.text;
    context.font = "12px ui-monospace, monospace";
    context.fillText(state.mode, 10, 215);
    context.fillStyle = COLORS.muted;
    context.font = "10px ui-monospace, monospace";
    context.fillText(state.expression, 10, 231);
    context.textAlign = "right";
    context.fillText(`r${state.revision}`, 230, 231);
    context.textAlign = "left";

    canvas.setAttribute(
      "aria-label",
      `Robot face showing ${state.expression} while in ${state.mode} mode`,
    );
  };
}
