import { createRequire } from "node:module";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { startTestServer } from "./qa/server.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const server = process.argv[2] ? null : await startTestServer();
const url = process.argv[2] ?? server.url;
const output = path.resolve(".qa/simulator");
await fs.mkdir(output, { recursive: true });
let browser;
const errors = [];
const waitText = (page, selector, text) => page.waitForFunction(
  ({ selector, text }) => document.querySelector(selector)?.textContent.includes(text),
  { selector, text }, { timeout: 15000 },
);
async function api(page, route, fields) {
  const response = await page.request.post(url + route, {
    data: { requestId: crypto.randomUUID(), ...fields },
  });
  assert.equal(response.status(), 200, await response.text());
  return response.json();
}
async function openEngineeringBench(page) {
  const details = page.locator("#engineering-details");
  if (!(await details.evaluate((element) => element.open))) {
    await page.locator("#engineering-details > summary").click();
  }
}

try {
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 768, 1024, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(url);
    await waitText(page, "#connection-message", "Python supervisor connected");
    // Product scenarios are first in the keyboard reading order.
    await page.keyboard.press("Tab");
    assert.equal(await page.locator('[data-scenario="companion"]').evaluate(
      (button) => button === document.activeElement), true);
    await openEngineeringBench(page);

    // The engineering disclosure still exposes the complete manual bench.
    const demo = page.locator("#run-demo");
    for (let count = 0; count < 110; count += 1) {
      if (await demo.evaluate((button) => button === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    assert.equal(await demo.evaluate((button) => button === document.activeElement), true);
    await page.keyboard.press("Enter");
    await waitText(page, "#run-demo", "Stop demo");
    await waitText(page, "#mode-value", "companion");
    await page.keyboard.press("Enter");
    await waitText(page, "#run-demo", "Run product demo");
    const sensors = await page.locator("#metric-sensors").textContent();
    await page.waitForTimeout(1000); // cancellation must outlive the first scheduled step
    assert.equal(await page.locator("#metric-sensors").textContent(), sensors);

    await page.getByRole("button", { name: "Training", exact: true }).click();
    await waitText(page, "#mode-value", "training");
    await page.getByRole("button", { name: "Training success", exact: true }).click();
    await waitText(page, "#expression-value", "encouraging");
    await page.getByRole("button", { name: "Raise alert", exact: true }).click();
    await waitText(page, "#alert-value", "latched");
    assert.equal(await page.getByRole("button", { name: "Touch", exact: true }).isDisabled(), true);
    const rejected = await api(page, "/api/action", { action: { type: "set_mode", mode: "companion" } });
    assert.equal(rejected.trace.at(-1).frame.error, "alert_latched");
    await waitText(page, "#event-list", "rejected: alert_latched");
    await page.getByRole("button", { name: "Clear alert", exact: true }).click();
    await waitText(page, "#mode-value", "monitoring");

    await page.getByRole("button", { name: "Inject malformed frame" }).click();
    await waitText(page, "#event-list", "invalid_json");
    await page.getByRole("button", { name: "Ping device" }).click();
    await waitText(page, "#event-list", "heartbeat acknowledged");
    await page.getByRole("button", { name: "Test NVS persistence" }).click();
    await waitText(page, "#event-list", "NVS persistence verified");
    await page.getByRole("button", { name: "Reboot virtual ESP32" }).click();
    await waitText(page, "#mode-value", "idle");

    for (const name of ["companion", "training", "monitoring"]) {
      await page.locator(`[data-scenario="${name}"]`).click();
      await waitText(page, "#scenario-current", name);
      if (name === "monitoring") {
        await waitText(page, "#scenario-current", "awaiting confirmation");
        await page.reload();
        await waitText(page, "#scenario-current", "awaiting confirmation");
        await waitText(page, "#alert-value", "latched");
        await page.getByRole("button", { name: "Confirm alert & resume" }).click();
        await waitText(page, "#run-history", "acknowledged");
        await waitText(page, "#scenario-current", "Last result");
      } else {
        await waitText(page, "#scenario-current", "Last result");
        await waitText(page, "#run-history", `${name} · completed`);
      }
    }
    await page.reload();
    await waitText(page, "#connection-message", "Python supervisor connected");
    await waitText(page, "#run-history", "acknowledged");
    await openEngineeringBench(page);
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download run report" }).click();
    const report = JSON.parse(await fs.readFile(await (await downloaded).path(), "utf8"));
    assert.equal(report.finalState.mode, "monitoring");
    assert.equal(report.runs[0].status, "acknowledged");
    assert.equal(report.runs[0].timeline.filter((row) => row.event === "alert_raised").length, 1);
    assert.ok(report.runs[0].confirmedAt);
    assert.ok(report.trace.some((row) => row.frame.error === "invalid_json"));
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth), false);
    if (width < 480) {
      assert.equal(await page.locator(".button-row .button").evaluateAll(
        (buttons) => buttons.some((button) => button.getBoundingClientRect().height > 80)), false);
    }
    assert.equal(await page.locator("button").evaluateAll((buttons) =>
      buttons.some((button) => !button.textContent.trim() && !button.getAttribute("aria-label"))), false);
    if (width <= 768) {
      await page.locator("#engineering-details").evaluate((details) => { details.open = false; });
    }
    await page.screenshot({ path: path.join(output, `simulator-${width}.png`), fullPage: true });
    // Network loss must be visible; restoration reloads server state, not a fresh local model.
    await context.setOffline(true);
    await waitText(page, "#connection-message", "disconnected");
    assert.equal(await demo.isDisabled(), true);
    await context.setOffline(false);
    await waitText(page, "#connection-message", "Python supervisor connected");
    await waitText(page, "#run-history", "acknowledged");
    if (width === 1440) {
      await page.getByRole("button", { name: "Reset demo" }).click();
      await page.getByRole("button", { name: "Keep runs" }).click();
      await waitText(page, "#run-history", "acknowledged");
      await page.getByRole("button", { name: "Reset demo" }).click();
      await page.getByRole("button", { name: "Clear saved runs" }).click();
      await waitText(page, "#history-count", "No saved runs");
      await page.reload();
      await waitText(page, "#history-count", "No saved runs");
    }
    await context.close();
  }
  const unexpected = errors.filter((error) => !error.includes("ERR_INTERNET_DISCONNECTED"));
  assert.deepEqual(unexpected, []);
  console.log("Full product-loop QA passed: Python bridge, 3 replays, confirmation, refresh, report, offline recovery; 320/768/1024/1440 px.");
} finally {
  await browser?.close();
  await server?.close();
}
