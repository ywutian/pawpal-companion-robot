import readline from "node:readline";
import { VirtualEspDevice } from "./core/virtual-device.js";

// Private stdio bridge: stdout is exclusively one JSON response per request.
let device = new VirtualEspDevice();
for await (const line of readline.createInterface({ input: process.stdin })) {
  try {
    const request = JSON.parse(line);
    const now = request.now ?? Date.now();
    let frames = [];
    let result = null;
    switch (request.op) {
      case "restore":
        device = new VirtualEspDevice(now, request.snapshot?.persistence);
        if (request.snapshot?.state) device.state = request.snapshot.state;
        frames = device.boot();
        break;
      case "command": frames = device.receive(request.line, now); break;
      case "sense":
        result = device.sense(request.event, now);
        frames = result.frames;
        break;
      case "tick": frames = device.advance(now); break;
      case "reboot":
        device = new VirtualEspDevice(now, device.persistence);
        frames = device.boot();
        break;
      default: throw new Error("unknown worker operation");
    }
    process.stdout.write(JSON.stringify({ frames, result,
      snapshot: { state: device.state, persistence: device.persistence } }) + "\n");
  } catch (error) {
    process.stdout.write(JSON.stringify({ error: error.message }) + "\n");
  }
}
