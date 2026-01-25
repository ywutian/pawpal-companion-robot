import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function startTestServer() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pawpal-qa-"));
  const localPython = path.join(root, ".venv/bin/python");
  const python = process.env.PAWPAL_PYTHON ??
    (await fs.access(localPython).then(() => localPython, () => "python3"));
  const child = spawn(python, ["-m", "pawpal_supervisor.web_server", "--port", "0",
    "--db", path.join(directory, "state.sqlite3")], {
    cwd: root, env: { ...process.env, PYTHONPATH: path.join(root, "supervisor/src"),
      PAWPAL_NODE: process.env.PAWPAL_NODE ?? process.execPath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let errors = "";
  child.stderr.on("data", (chunk) => { errors += chunk; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill("SIGINT"); reject(new Error("Server startup timed out")); }, 10000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", () => { clearTimeout(timer); reject(new Error(errors || "Server exited")); });
    child.stdout.on("data", (chunk) => {
      const match = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  return { url, async close() {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGINT");
      await exited;
    }
    await fs.rm(directory, { recursive: true });
  } };
}
