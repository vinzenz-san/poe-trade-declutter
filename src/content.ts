import browser from "webextension-polyfill";
import { applyFieldTiering } from "./domFields";
import { ensureFloatingPanel } from "./floatingPanel";
import { applyGroupTiering } from "./inlineControls";
import { readTradeFilterSchema } from "./lscache";
import { readTunerSettings } from "./settings";

async function runDomUpdates(): Promise<void> {
  const tuner = await readTunerSettings();
  const schema = readTradeFilterSchema();
  applyFieldTiering(tuner.inactiveFields);
  applyGroupTiering(schema, tuner.inactiveGroups);
  ensureFloatingPanel();
}

function debounce(fn: () => void, delayMs: number): () => void {
  let handle: number | undefined;
  return () => {
    if (handle !== undefined) window.clearTimeout(handle);
    handle = window.setTimeout(fn, delayMs);
  };
}

function start(): void {
  const debouncedRun = debounce(() => void runDomUpdates(), 100);

  debouncedRun();
  new MutationObserver(debouncedRun).observe(document.body, { childList: true, subtree: true });
  browser.storage.onChanged.addListener(debouncedRun);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
