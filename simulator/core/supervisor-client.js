export class SupervisorClient {
  constructor({ onSnapshot, onConnection }) {
    this.onSnapshot = onSnapshot;
    this.onConnection = onConnection;
    this.version = -1;
    this.pending = false;
    this.online = false;
    this.queue = Promise.resolve();
  }

  async request(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(path, {
        method: body ? "POST" : "GET", cache: "no-store",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const snapshot = await response.json();
      if (!response.ok) {
        this.online = response.status < 500;
        throw new Error(snapshot.error ?? "Request failed");
      }
      this.online = true;
      if (snapshot.version >= this.version) {
        this.version = snapshot.version;
        this.onSnapshot(snapshot);
      }
      this.onConnection({ online: true, pending: this.pending, error: null });
      return snapshot;
    } catch (error) {
      if (error instanceof TypeError || error.name === "AbortError") this.online = false;
      this.onConnection({ online: this.online, pending: this.pending,
        error: this.online ? error.message : "Supervisor disconnected — reconnecting. Saved runs are retained." });
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  mutate(path, body = {}) {
    const run = async () => {
      this.pending = true;
      this.onConnection({ online: this.online, pending: true });
      try {
        return await this.request(path, { ...body, requestId: crypto.randomUUID() });
      } finally {
        this.pending = false;
        this.onConnection({ online: this.online, pending: false });
      }
    };
    const result = this.queue.then(run);
    this.queue = result.catch(() => {});
    return result;
  }

  async poll() {
    try { await this.request("/api/status"); } catch { /* Connection status is visible. */ }
    this.timer = setTimeout(() => this.poll(), 500);
  }
}
