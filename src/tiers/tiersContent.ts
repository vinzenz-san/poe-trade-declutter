// Injects a "Min tier" dropdown next to supported stat-filter rows on
// pathofexile.com/trade.
//
// Verified DOM shape (2026-08, vue-multiselect based UI):
//   Stat row:      div.filter.full-span:not(.filter-property)
//                     .filter-title   -> stat text, e.g. "+# to maximum Life"
//                     input.minmax[placeholder="min"|"max"]
//   Category row:  div.filter.filter-property.full-span
//                     input.multiselect__input -> .placeholder holds the
//                     currently selected value's label (e.g. "Boots") when
//                     the input itself is empty/unfocused.
//
// tierTable (from tiersBackground.ts) is keyed by item class -> an array of
// { matchText, label, tiers } entries discovered dynamically from RePoE,
// not a fixed hand-curated list — see lib/statDefs.ts / tiersBackground.ts.
//
// Ported from the standalone poe-trade-tiers extension; initTiersContent is
// called once from the merged extension's content.ts entry point alongside
// Declutter's own DOM updates, so both features run in the same content
// script/isolated world. Keeps its own settings gear icon and floating
// panel separate from Declutter's — visually unifying the two into one
// settings surface is a follow-up design decision, not done here.

import browser from "webextension-polyfill";
import { ITEM_CLASSES, MOD_SOURCE_PREFIX_RE, PREFER_LOCAL_STAT_IDS, normalizeStatText } from "./lib/statDefs";
import type { GetTierTableMessage, Tier, TierTable, TierTableEntry } from "./lib/types";

const DEBUG = true;
function log(...args: unknown[]) {
  if (DEBUG) console.log("[PoE Trade Tiers]", ...args);
}

const SCAN_INTERVAL_MS = 800;
const PROCESSED_ATTR = "data-ptt-processed";

const STAT_ROW_SELECTOR = "div.filter.full-span:not(.filter-property)";
const CATEGORY_INPUT_SELECTOR = ".filter.filter-property.full-span input.multiselect__input";

let tierTable: TierTable | null = null;

// --- User settings (font size, panel width, feature toggles) ---
//
// Owned here (not in floatingPanel.ts) since applying a change also has to
// trigger this module's own side effects (unwrapping existing tier
// pickers, removing Browse Mods buttons) — but the UI controls themselves
// now live in Declutter's shared floating panel (see floatingPanel.ts),
// not a separate settings icon, so this exposes read/write access plus a
// readiness promise for that panel to build against.

const SETTINGS_STORAGE_KEY = "pttSettings";

export interface TiersSettings {
  fontSize: number;
  panelWidth: number;
  tierPickerEnabled: boolean;
  browseModsEnabled: boolean;
}

const DEFAULT_SETTINGS: TiersSettings = {
  fontSize: 12,
  panelWidth: 400,
  tierPickerEnabled: true,
  browseModsEnabled: true,
};
let settings: TiersSettings = { ...DEFAULT_SETTINGS };

let resolveSettingsReady: () => void;
export const tiersSettingsReady: Promise<void> = new Promise((resolve) => {
  resolveSettingsReady = resolve;
});

async function loadSettings() {
  const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
  settings = { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_STORAGE_KEY] as Partial<TiersSettings>) || {}) };
  applySettingsToCSS();
  resolveSettingsReady();
}

function saveSettings() {
  browser.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
}

function applySettingsToCSS() {
  document.documentElement.style.setProperty("--ptt-font-size", `${settings.fontSize}px`);
  document.documentElement.style.setProperty("--ptt-panel-width", `${settings.panelWidth}px`);
}

export function getTiersSettings(): Readonly<TiersSettings> {
  return settings;
}

export function setTiersSetting<K extends keyof TiersSettings>(key: K, value: TiersSettings[K]): void {
  settings = { ...settings, [key]: value };
  applySettingsToCSS();
  saveSettings();
  if (key === "tierPickerEnabled" && !value) removeAllTierPickers();
  if (key === "browseModsEnabled" && !value) removeAllBrowseButtons();
}

// Tier pickers wrap the real min/max input in a positioning span (see
// wrapInputWithPicker) — disabling the feature needs to actually unwrap
// them, not just stop injecting new ones, or existing pickers would linger.
function removeAllTierPickers() {
  document.querySelectorAll<HTMLElement>(".ptt-input-wrap").forEach((wrap) => {
    const input = wrap.querySelector("input.minmax");
    if (input && wrap.parentElement) {
      wrap.parentElement.insertBefore(input, wrap);
    }
    wrap.remove();
  });
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => el.removeAttribute(PROCESSED_ATTR));
}

function removeAllBrowseButtons() {
  document.querySelectorAll(".ptt-browse-wrapper").forEach((el) => el.remove());
}

// Build a normalized-label -> itemClassKey lookup once.
const CATEGORY_LOOKUP: Record<string, string> = {};
for (const [key, def] of Object.entries(ITEM_CLASSES)) {
  CATEGORY_LOOKUP[normalizeStatText(def.label)] = key;
}

function lookupEntry(itemClassKey: string, titleText: string): TierTableEntry | null {
  const entries = tierTable?.[itemClassKey];
  if (!entries) return null;
  const norm = normalizeStatText(titleText).replace(MOD_SOURCE_PREFIX_RE, "");
  // Trade sometimes labels a row "(Local)" — the added row's actual title
  // may or may not carry that suffix, so accept either form rather than
  // requiring an exact match (see PREFER_LOCAL_STAT_IDS in lib/statDefs.ts
  // for why this varies per stat and can't be inferred from the id alone).
  return entries.find((e) => norm === e.matchText || norm === `${e.matchText} local`) ?? null;
}

function getSelectedItemCategory(): string | null {
  for (const input of document.querySelectorAll<HTMLInputElement>(CATEGORY_INPUT_SELECTOR)) {
    const hit = CATEGORY_LOOKUP[normalizeStatText(input.placeholder)];
    if (hit) return hit;
  }
  return null;
}

function setNativeInputValue(input: HTMLInputElement, value: string | number) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, String(value));
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function closeAllTierMenus() {
  document.querySelectorAll(".ptt-tier-menu:not([hidden])").forEach((m) => {
    (m as HTMLElement).hidden = true;
  });
}
function closeAllBrowsePanels() {
  document.querySelectorAll(".ptt-browse-panel:not([hidden])").forEach((p) => {
    (p as HTMLElement).hidden = true;
  });
}

function buildTierPicker(entry: TierTableEntry, onPick: (tier: Tier) => void): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "ptt-tier-picker";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ptt-tier-btn";
  btn.textContent = "T";
  btn.title = "PoE Trade Tiers: pick a minimum tier";

  const menu = document.createElement("div");
  menu.className = "ptt-tier-menu";
  menu.hidden = true;

  for (const t of entry.tiers) {
    const item = document.createElement("div");
    item.className = "ptt-tier-item";
    item.textContent = `T${t.tier}  ${t.min}${t.min !== t.max ? `–${t.max}` : ""}  (lvl ${t.requiredLevel})`;
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick(t);
      menu.hidden = true;
    });
    menu.appendChild(item);
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = menu.hidden;
    closeAllTierMenus();
    menu.hidden = !wasHidden;
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  return wrapper;
}

// Wraps an input instead of inserting the picker as a flow sibling — the
// row is a fixed-width flex layout, so adding width after the input pushes
// things onto a new line. The wrapper keeps the same footprint as the bare
// input and the picker overlays its corner instead.
function wrapInputWithPicker(input: HTMLInputElement, entry: TierTableEntry, onPick: (tier: Tier) => void): HTMLElement {
  const picker = buildTierPicker(entry, onPick);
  const wrap = document.createElement("span");
  wrap.className = "ptt-input-wrap";
  input.parentElement!.insertBefore(wrap, input);
  wrap.appendChild(input);
  wrap.appendChild(picker);
  return wrap;
}

function tryInjectRow(row: HTMLElement, titleText: string) {
  if (row.hasAttribute(PROCESSED_ATTR)) return;

  const category = getSelectedItemCategory();
  if (!category) return; // only active once an item category is selected

  const entry = lookupEntry(category, titleText);
  if (!entry || entry.tiers.length === 0) return;

  const minInput = row.querySelector<HTMLInputElement>('input.minmax[placeholder="min"]');
  const maxInput = row.querySelector<HTMLInputElement>('input.minmax[placeholder="max"]');
  if (!minInput || !maxInput) return;

  row.setAttribute(PROCESSED_ATTR, "1");

  wrapInputWithPicker(minInput, entry, (tier) => setNativeInputValue(minInput, tier.min));
  wrapInputWithPicker(maxInput, entry, (tier) => setNativeInputValue(maxInput, tier.max));

  log("injected tier pickers for", entry.label, "on", category);
}

// --- Browse & add: pick a modifier from the full possible pool, and have
// it added to trade's own search via its real autocomplete. This is the
// experimental half — driving vue-multiselect via synthetic events without
// having been able to test it live. Every step logs, since this is the
// most likely thing to need a live-correction round.

function waitFor<T>(predicate: () => T | null, timeoutMs = 2000): Promise<T | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    function check() {
      let result: T | null;
      try {
        result = predicate();
      } catch {
        result = null;
      }
      if (result) return resolve(result);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(check);
    }
    check();
  });
}

// "+ Add Stat Filter" is a placeholder on an input.multiselect__input, not
// button text — it's the search box itself (same vue-multiselect pattern
// as the category picker), not a trigger that reveals one. Trade supports
// multiple stat groups (AND/NOT/IF/COUNT/WEIGHTED SUM), each with its own
// "+ Add Stat Filter" input, so this returns all of them, not just the
// first. Re-found each time rather than cached: after a stat is added,
// trade may swap in a fresh input for the next one rather than reusing the
// same element.
function findAddStatFilterInputs(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>("input.multiselect__input")].filter(
    (input) => input.placeholder?.trim() === "+ Add Stat Filter"
  );
}

// "~explicit " is trade's own search-syntax prefix for scoping matches to
// explicit-only mods — using it (rather than the bare stat text) should
// also make the autocomplete match more reliably, not just read better,
// since it rules out implicit/crafted mods with near-identical wording.
function explicitSearchText(entry: TierTableEntry): string {
  return "~explicit " + entry.label.replace(/\{\d+\}/g, "").replace(/^[^a-zA-Z]+/, "").trim();
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function dispatchKey(el: HTMLElement, key: string, keyCode: number) {
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key, code: key, keyCode, which: keyCode, bubbles: true, cancelable: true })
  );
}

// Types into trade's own "+ Add Stat Filter" search box (the one for the
// stat group the Browse Mods button was opened from), then navigates
// vue-multiselect's own keyboard selection (ArrowDown to the matching
// option, Enter to select it) — synthetic clicks on the rendered option
// didn't register with its internal selection handler, but Enter (as a
// user manually pressing it) does, so drive it the same way.
async function addStatByEntry(entry: TierTableEntry, searchInput: HTMLInputElement | null): Promise<boolean> {
  if (!searchInput || !document.contains(searchInput)) {
    log('browse: the "+ Add Stat Filter" input for this group is gone');
    return false;
  }

  const searchText = explicitSearchText(entry);
  log("browse: typing search text", JSON.stringify(searchText));

  searchInput.focus();
  setNativeInputValue(searchInput, searchText);

  // Scoped to this specific widget's dropdown, not the whole document —
  // an unscoped document-wide `.multiselect__option` query was matching a
  // completely different, always-DOM-present (just hidden) dropdown
  // elsewhere on the page (the Item Base Type selector, ~3000+ entries),
  // not our own stat search's results at all.
  const widget = searchInput.closest<HTMLElement>(".multiselect") || searchInput.parentElement!;
  const options = await waitFor(() => {
    const opts = widget.querySelectorAll<HTMLElement>(".multiselect__option");
    return opts.length > 0 ? [...opts] : null;
  }, 1500);
  if (!options) {
    log("browse: no autocomplete options appeared for", JSON.stringify(searchText));
    return false;
  }

  // Match against entry.label, not searchText — the "~explicit " syntax is
  // search-input-only and won't appear in the autocomplete option's text.
  // Options themselves come prefixed with a mod-source word ("explicit
  // +# to Armour"), same as row titles elsewhere — strip it the same way.
  //
  // Trade sometimes lists a plain row and a "(Local)"-suffixed row for the
  // same underlying stat, and which one is "the" filter varies per stat
  // (confirmed live: Armour wants Local, Attack Speed wants plain) — see
  // PREFER_LOCAL_STAT_IDS. Try the preferred phrasing first, fall back to
  // the other if it's not present.
  const baseTarget = normalizeStatText(entry.label);
  const localTarget = `${baseTarget} local`;
  const candidates = PREFER_LOCAL_STAT_IDS.has(entry.statId) ? [localTarget, baseTarget] : [baseTarget];

  const stripped = (o: HTMLElement) => normalizeStatText(o.textContent).replace(MOD_SOURCE_PREFIX_RE, "");
  const normTarget = candidates.find((cand) => options.some((o) => stripped(o) === cand));
  if (!normTarget) {
    log(
      "browse: no option exactly matched",
      JSON.stringify(candidates),
      "— options were:",
      options.map((o) => o.textContent?.trim())
    );
    return false;
  }
  const matches = (o: HTMLElement) => stripped(o) === normTarget;
  log("browse: target option is", JSON.stringify(options.find(matches)?.textContent));

  // Rather than count ArrowDown presses against a snapshot (unreliable —
  // with hundreds of loosely-matching candidates, e.g. "to Armour" also
  // substring-matching many unrelated mods, the dropdown can still be
  // re-rendering/resettling by the time the presses land, so a fixed count
  // drifts off target), press ArrowDown once at a time and re-check the
  // DOM's own highlighted option after each press, stopping once it's
  // actually our target — self-correcting against the live list instead
  // of trusting a stale index.
  const HIGHLIGHT_SELECTOR = ".multiselect__option--highlight";
  const maxAttempts = Math.min(options.length, 100);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const highlighted = widget.querySelector<HTMLElement>(HIGHLIGHT_SELECTOR);
    if (highlighted && matches(highlighted)) {
      log("browse: highlighted option confirmed matching, pressing Enter");
      dispatchKey(searchInput, "Enter", 13);
      return true;
    }
    dispatchKey(searchInput, "ArrowDown", 40);
    await nextFrame();
  }

  log(`browse: gave up trying to highlight the target option after ${maxAttempts} attempts`);
  return false;
}

function buildBrowsePanel(category: string, searchInput: HTMLInputElement): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "ptt-browse-panel";
  panel.addEventListener("click", (e) => e.stopPropagation());

  const search = document.createElement("input");
  search.type = "text";
  search.placeholder = "Filter modifiers…";
  search.className = "ptt-browse-search";
  panel.appendChild(search);

  // Base-type filter row — only for item classes with real base variation
  // (armour pieces). Narrows the shown mods to just the selected
  // attribute-affinity flavor, since a plain "Boots" category search
  // doesn't disclose which one the user's actual base is.
  let selectedSubtype: string | null = null;
  const baseSubtypes = ITEM_CLASSES[category]?.baseSubtypes;
  if (baseSubtypes?.length) {
    const subtypeRow = document.createElement("div");
    subtypeRow.className = "ptt-browse-subtypes";

    const buttons: HTMLButtonElement[] = [];
    function setSelected(label: string | null) {
      selectedSubtype = label;
      for (const btn of buttons) {
        btn.classList.toggle("ptt-browse-subtype-btn--active", btn.dataset.label === (label ?? "__all__"));
      }
      render(search.value);
    }

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "ptt-browse-subtype-btn";
    allBtn.dataset.label = "__all__";
    allBtn.textContent = "All";
    allBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setSelected(null);
    });
    buttons.push(allBtn);
    subtypeRow.appendChild(allBtn);

    for (const sub of baseSubtypes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ptt-browse-subtype-btn";
      btn.dataset.label = sub.label;
      btn.textContent = sub.label;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(sub.label);
      });
      buttons.push(btn);
      subtypeRow.appendChild(btn);
    }

    // Mark "All" active without calling setSelected (which calls render(),
    // and `list` below isn't assigned yet at this point in the function —
    // the real initial render happens via the render("") call at the end).
    allBtn.classList.add("ptt-browse-subtype-btn--active");
    panel.appendChild(subtypeRow);
  }

  const list = document.createElement("div");
  list.className = "ptt-browse-list";
  panel.appendChild(list);

  function appendEntry(entry: TierTableEntry) {
    const item = document.createElement("div");
    item.className = "ptt-browse-item";
    const localSuffix = PREFER_LOCAL_STAT_IDS.has(entry.statId) ? " (Local)" : "";
    // "~explicit " is trade's own search-syntax prefix (see explicitSearchText,
    // which still uses it when actually typing into the search box) — dropped
    // here since it's just noise for a human reading the list, not something
    // the user needs to see or type themselves.
    const displayLabel = entry.label.replace(/\{\d+\}/g, "#") + localSuffix;
    const tierWord = entry.tiers.length === 1 ? "tier" : "tiers";
    item.textContent = `${displayLabel} (${entry.tiers.length} ${tierWord})`;
    item.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeAllBrowsePanels();
      const ok = await addStatByEntry(entry, searchInput);
      if (!ok) {
        console.error("[PoE Trade Tiers] Browse Mods: failed to add stat", entry.label);
      }
    });
    list.appendChild(item);
  }

  function appendSectionHeader(text: string) {
    const header = document.createElement("div");
    header.className = "ptt-browse-section";
    header.textContent = text;
    list.appendChild(header);
  }

  function render(filterText: string) {
    list.innerHTML = "";
    let entries = tierTable?.[category] || [];
    if (selectedSubtype) {
      // entry.subtypes is null for stats that apply universally regardless
      // of base flavor (e.g. Life) — those stay visible under any subtype
      // filter, not just ones that explicitly list it.
      entries = entries.filter((e) => e.subtypes === null || e.subtypes.includes(selectedSubtype!));
    }
    const norm = filterText.trim().toLowerCase();
    const filtered = norm ? entries.filter((e) => e.label.toLowerCase().includes(norm)) : entries;

    const byLabel = (a: TierTableEntry, b: TierTableEntry) => a.label.localeCompare(b.label);
    const prefixes = filtered.filter((e) => e.affixType === "prefix").sort(byLabel);
    const suffixes = filtered.filter((e) => e.affixType === "suffix").sort(byLabel);

    if (prefixes.length > 0) {
      appendSectionHeader("Prefixes");
      prefixes.forEach(appendEntry);
    }
    if (suffixes.length > 0) {
      appendSectionHeader("Suffixes");
      suffixes.forEach(appendEntry);
    }

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ptt-browse-empty";
      empty.textContent = "No matching modifiers";
      list.appendChild(empty);
    }
  }

  search.addEventListener("input", () => render(search.value));
  render("");

  const note = document.createElement("div");
  note.className = "ptt-browse-note";
  note.textContent =
    'Hybrid mods (e.g. "+# to Armour, +# to Energy Shield") aren\'t shown — ' +
    "trade has no way to search for the pair as one unit, only their individual stats.";
  panel.appendChild(note);

  return panel;
}

// Browser console warnings (see log()) aren't visible to a normal user —
// briefly swap the triggering button's own label instead, so "you need to
// select a category first" is seen without opening devtools.
const FLASH_WARNING_MS = 1800;
function flashButtonWarning(btn: HTMLButtonElement, message: string): void {
  if (btn.dataset.pttFlashing) return; // already showing a warning, don't restart the timer
  const original = btn.textContent;
  btn.dataset.pttFlashing = "1";
  btn.textContent = message;
  btn.classList.add("ptt-browse-btn--warning");
  window.setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("ptt-browse-btn--warning");
    delete btn.dataset.pttFlashing;
  }, FLASH_WARNING_MS);
}

// Trade supports multiple stat groups (AND/NOT/IF/COUNT/WEIGHTED SUM),
// each with its own "+ Add Stat Filter" input — inject a button next to
// every one of them, not just the first, and bind each button to its own
// input so picking a modifier adds it to the right group.
function injectBrowseButton() {
  for (const searchInput of findAddStatFilterInputs()) {
    // Insert after the whole multiselect widget, not inside it — putting
    // foreign DOM inside a Vue-managed subtree risks it getting wiped on
    // the next re-render.
    const multiselect = searchInput.closest<HTMLElement>(".multiselect") || searchInput.parentElement;
    const container = multiselect?.parentElement;
    if (!container) continue;

    // Scoped per multiselect (not a single global flag) — checked fresh
    // each tick, since a re-render could wipe a previously-injected button
    // out from under one specific group without affecting the others.
    if ((multiselect!.nextElementSibling as HTMLElement | null)?.classList.contains("ptt-browse-wrapper")) continue;

    const wrapper = document.createElement("span");
    wrapper.className = "ptt-browse-wrapper";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ptt-browse-btn";
    btn.textContent = "Browse Base Mods";
    btn.title = "PoE Trade Tiers: browse every possible modifier for the selected item category";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const category = getSelectedItemCategory();
      if (!category) {
        log("browse: select an item category first");
        flashButtonWarning(btn, "Select an item category first");
        return;
      }
      closeAllBrowsePanels();
      wrapper.querySelector(".ptt-browse-panel")?.remove();
      const panel = buildBrowsePanel(category, searchInput);
      wrapper.appendChild(panel);
      panel.querySelector<HTMLElement>(".ptt-browse-search")?.focus();
    });

    wrapper.appendChild(btn);
    container.insertBefore(wrapper, multiselect!.nextSibling);
    log("injected Browse Base Mods button");
  }
}

function scan() {
  if (!tierTable) return;

  if (settings.browseModsEnabled) injectBrowseButton();

  if (settings.tierPickerEnabled) {
    for (const row of document.querySelectorAll<HTMLElement>(STAT_ROW_SELECTOR)) {
      const titleEl = row.querySelector(".filter-title");
      if (!titleEl) continue;
      tryInjectRow(row, titleEl.textContent || "");
    }
  }
}

export function initTiersContent(): void {
  document.addEventListener("click", () => {
    closeAllTierMenus();
    closeAllBrowsePanels();
  });

  void (async () => {
    await loadSettings();
    try {
      const message: GetTierTableMessage = { type: "GET_TIER_TABLE" };
      tierTable = (await browser.runtime.sendMessage(message)) as TierTable;
      log("tier table loaded", tierTable);
    } catch (err) {
      console.error("[PoE Trade Tiers] failed to load tier table", err);
      return;
    }
    setInterval(scan, SCAN_INTERVAL_MS);
  })();
}
