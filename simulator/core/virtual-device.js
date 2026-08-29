import { initialState, tick, transition } from "../state-machine.js";
import {
  configFrame,
  encodeFrame,
  ERROR_CODES,
  PROTOCOL_VERSION,
  stateFrame,
} from "./protocol-frames.js";

const DEFAULT_CONFIG = Object.freeze({
  motion_threshold_dps: 45,
  shake_threshold_dps: 180,
});

function ack(id, accepted, error) {
  const frame = { v: PROTOCOL_VERSION, type: "ack", id, accepted };
  if (error) frame.error = error;
  return frame;
}

function defaultPersistence() {
  return {
    config: { ...DEFAULT_CONFIG },
    configRevision: 0,
    ackCache: [],
  };
}

export class VirtualEspDevice {
  constructor(now = Date.now(), persistence = null) {
    this.state = initialState(now);
    this.persistence = persistence ?? defaultPersistence();
    this.ackCache = new Map(this.persistence.ackCache);
    this.parseErrors = 0;
    this.duplicateCommands = 0;
  }

  boot() {
    return [encodeFrame(stateFrame(this.state))];
  }

  receive(commandLine, now = Date.now()) {
    const parsed = this.#parse(commandLine);
    if (parsed.frames) return parsed.frames;
    const command = parsed.command;

    const duplicate = this.ackCache.get(command.id);
    if (duplicate) {
      this.duplicateCommands += 1;
      return [encodeFrame({ ...duplicate, duplicate: true })];
    }

    if (["get_config", "set_config", "reset_config"].includes(command.type)) {
      return this.#handleConfig(command);
    }
    // Pings are never journaled: liveness-rate writes would wear real NVS.
    if (command.type === "ping") return [encodeFrame(ack(command.id, true))];
    return this.#handleBehavior(command, now);
  }

  sense(eventType, now = Date.now()) {
    const beforeRevision = this.state.revision;
    const result = transition(this.state, { type: eventType }, now);
    this.state = result.state;
    return {
      accepted: result.accepted,
      reason: result.reason,
      frames:
        this.state.revision === beforeRevision
          ? []
          : [encodeFrame(stateFrame(this.state))],
    };
  }

  advance(now = Date.now()) {
    const next = tick(this.state, now);
    if (next === this.state) return [];
    this.state = next;
    return [encodeFrame(stateFrame(this.state))];
  }

  #parse(commandLine) {
    const payload = commandLine.replaceAll("\r", "").replace(/\n$/, "");
    if (new TextEncoder().encode(payload).length > 512) {
      return { frames: this.#reject("", "frame_too_long", true) };
    }
    let command;
    try {
      command = JSON.parse(commandLine);
    } catch {
      return { frames: this.#reject("", "invalid_json", true) };
    }

    if (!command || typeof command !== "object" || Array.isArray(command)) {
      return { frames: this.#reject("", "missing_id", true) };
    }
    const id = typeof command.id === "string" ? command.id : "";
    if ((command.v ?? PROTOCOL_VERSION) !== PROTOCOL_VERSION) {
      return { frames: this.#reject(id, "unsupported_version", true) };
    }
    if (!id) return { frames: this.#reject("", "missing_id", true) };
    if (new TextEncoder().encode(id).length > 24 || id.includes("\u0000")) {
      return { frames: this.#reject("", "id_too_long", true) };
    }
    return { command: { ...command, id } };
  }

  #handleConfig(command) {
    if (command.type === "get_config") {
      return [this.#cachedAck(command.id, true), encodeFrame(configFrame(this.persistence))];
    }
    if (command.type === "reset_config") {
      this.persistence.config = { ...DEFAULT_CONFIG };
      this.persistence.configRevision += 1;
      return [
        this.#cachedAck(command.id, true),
        encodeFrame(configFrame(this.persistence, true)),
      ];
    }

    const valid = this.#validConfig(command.key, command.value);
    const ackFrame = this.#cachedAck(
      command.id,
      valid,
      valid ? undefined : "config_out_of_range",
    );
    if (!valid) return [ackFrame];
    this.persistence.config[command.key] = command.value;
    this.persistence.configRevision += 1;
    return [ackFrame, encodeFrame(configFrame(this.persistence, true))];
  }

  #handleBehavior(command, now) {
    let action;
    if (command.type === "set_mode") {
      action = { type: "set_mode", mode: command.mode };
    } else if (command.type === "event") {
      if (!["training_success", "alert_raised", "alert_cleared", "motion", "shake"].includes(command.event)) {
        return this.#reject(command.id, "unknown_event", true);
      }
      action = { type: command.event };
    } else {
      return this.#reject(command.id, "unknown_type", true);
    }

    const beforeRevision = this.state.revision;
    const result = transition(this.state, action, now);
    this.state = result.state;
    const error = result.accepted ? undefined : ERROR_CODES[result.reason] ?? "rejected";
    const frames = [this.#cachedAck(command.id, result.accepted, error)];
    if (this.state.revision !== beforeRevision) {
      frames.push(encodeFrame(stateFrame(this.state)));
    }
    return frames;
  }

  #validConfig(key, value) {
    if (!Number.isFinite(value)) return false;
    const { motion_threshold_dps: motion, shake_threshold_dps: shake } =
      this.persistence.config;
    if (key === "motion_threshold_dps") {
      return value >= 5 && value <= 150 && value < shake;
    }
    if (key === "shake_threshold_dps") {
      return value >= 60 && value <= 500 && value > motion;
    }
    return false;
  }

  #reject(id, error, countParseError = false) {
    if (countParseError) this.parseErrors += 1;
    return [encodeFrame(ack(id, false, error))];
  }

  #cachedAck(id, accepted, error) {
    const frame = ack(id, accepted, error);
    if (this.ackCache.size >= 8) {
      this.ackCache.delete(this.ackCache.keys().next().value);
    }
    this.ackCache.set(id, frame);
    this.persistence.ackCache = [...this.ackCache.entries()];
    return encodeFrame(frame);
  }
}
