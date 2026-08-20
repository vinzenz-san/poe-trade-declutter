import browser from "webextension-polyfill";

const STORAGE_KEY = "panelHeight";

export async function getPanelHeight(): Promise<number | undefined> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return stored[STORAGE_KEY] as number | undefined;
}

export async function setPanelHeight(height: number): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: height });
}
