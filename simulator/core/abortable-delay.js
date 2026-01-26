export function abortableDelay(milliseconds, signal, timers = globalThis) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }

    const cancel = () => {
      timers.clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      reject(signal.reason);
    };
    const timeout = timers.setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}
