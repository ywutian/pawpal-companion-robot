import { encodeFrame, PROTOCOL_VERSION, stateFrame } from "./protocol-frames.js";
import { VirtualEspDevice } from "./virtual-device.js";

export class VirtualPiSupervisor {
  constructor({ device = new VirtualEspDevice(), now = () => Date.now(), onMessage = () => {} } = {}) {
    this.device = device;
    this.now = now;
    this.onMessage = onMessage;
    this.sequence = 0;
    this.trace = [];
    this.startedAt = this.now();
    this.stats = {
      commandsSent: 0,
      acceptedAcks: 0,
      rejectedAcks: 0,
      sensorEvents: 0,
      receivedFrames: 0,
      reboots: 0,
    };
  }

  connect() {
    this.#receive(this.device.boot());
  }

  sendMode(mode) {
    return this.#send(this.#command("set_mode", { mode }));
  }

  sendEvent(event, intensity) {
    const fields = { event };
    if (typeof intensity === "number") fields.intensity = intensity;
    return this.#send(this.#command("event", fields));
  }

  ping() {
    return this.#send(this.#command("ping"));
  }

  getConfig() {
    return this.#send(this.#command("get_config"));
  }

  setConfig(key, value) {
    return this.#send(this.#command("set_config", { key, value }));
  }

  resetConfig() {
    return this.#send(this.#command("reset_config"));
  }

  sense(event) {
    this.stats.sensorEvents += 1;
    this.#record("SENSOR", "sensor → ESP32", { type: "sensor", event });
    const result = this.device.sense(event, this.now());
    this.#receive(result.frames);
    this.onMessage({ type: "sensor_result", event, ...result });
    return result;
  }

  advance() {
    this.#receive(this.device.advance(this.now()));
  }

  sendRaw(rawLine) {
    this.stats.commandsSent += 1;
    this.#record("TX", "Pi → ESP32", { raw: rawLine });
    return this.#exchange(rawLine);
  }

  reboot() {
    this.device = new VirtualEspDevice(this.now(), this.device.persistence);
    this.stats.reboots += 1;
    this.#record("SYSTEM", "ESP32", { event: "virtual_reboot" });
    this.#receive(this.device.boot());
  }

  metrics() {
    return {
      ...this.stats,
      uptimeMs: Math.max(0, this.now() - this.startedAt),
    };
  }

  exportRun() {
    return {
      project: "PawPal Companion Robot",
      environment: "software-only digital twin",
      scope: "online software demonstration; physical device not included",
      generatedAt: new Date(this.now()).toISOString(),
      finalState: stateFrame(this.device.state),
      metrics: this.metrics(),
      trace: this.trace,
    };
  }

  #command(type, fields = {}) {
    this.sequence += 1;
    return {
      v: PROTOCOL_VERSION,
      id: `pi-${String(this.sequence).padStart(3, "0")}`,
      type,
      ...fields,
    };
  }

  #send(command) {
    this.stats.commandsSent += 1;
    this.#record("TX", "Pi → ESP32", command);
    return this.#exchange(encodeFrame(command));
  }

  #exchange(commandLine) {
    const frames = this.device.receive(commandLine, this.now());
    this.#receive(frames);
    return frames.map((frame) => JSON.parse(frame));
  }

  #receive(frames) {
    for (const frameLine of frames) {
      const frame = JSON.parse(frameLine);
      this.stats.receivedFrames += 1;
      if (frame.type === "ack") {
        if (frame.accepted) this.stats.acceptedAcks += 1;
        else this.stats.rejectedAcks += 1;
      }
      this.#record("RX", "ESP32 → Pi", frame);
      this.onMessage(frame);
    }
  }

  #record(direction, route, frame) {
    const entry = {
      at: new Date(this.now()).toISOString(),
      direction,
      route,
      frame,
    };
    this.trace.push(entry);
    this.onMessage({ type: "trace", entry });
  }
}
