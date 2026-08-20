import browser from "webextension-polyfill";

const STORAGE_KEY = "boxCollapseState";

export type BoxId = "filterVisibility" | "tierPicker" | "favorites";

// All three settings-panel boxes default collapsed; storage only ever holds
// overrides a user has actually toggled.
export async function getBoxCollapsed(id: BoxId): Promise<boolean> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<Record<BoxId, boolean>> | undefined;
  return value?.[id] ?? true;
}

export async function setBoxCollapsed(id: BoxId, collapsed: boolean): Promise<void> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = (stored[STORAGE_KEY] as Partial<Record<BoxId, boolean>> | undefined) ?? {};
  value[id] = collapsed;
  await browser.storage.local.set({ [STORAGE_KEY]: value });
}
