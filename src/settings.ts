import browser from "webextension-polyfill";
import type { TunerSettings } from "./types";

const STORAGE_KEY = "tunerSettings";

const DEFAULT_SETTINGS: TunerSettings = {
  inactiveGroups: [],
  inactiveFields: {},
};

export async function readTunerSettings(): Promise<TunerSettings> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as TunerSettings | undefined;
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function writeTunerSettings(settings: TunerSettings): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: settings });
}

export async function resetTunerSettings(): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
}
