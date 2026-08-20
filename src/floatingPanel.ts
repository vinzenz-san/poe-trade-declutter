import browser from "webextension-polyfill";
import { getBoxCollapsed, setBoxCollapsed, type BoxId } from "./boxCollapseState";
import { SHOW_INACTIVE_FIELDS_CLASS } from "./domFields";
import {
  addFavorite,
  getFavorites,
  overwriteFavoriteUrl,
  removeFavorite,
  renameFavorite,
  reorderFavorites,
} from "./favorites";
import { GROUPS_CONTAINER_CLASS, SHOW_HIDDEN_GROUPS_CLASS } from "./inlineControls";
import { getPanelHeight, setPanelHeight } from "./panelSize";
import { resetTunerSettings } from "./settings";
import {
  getTiersSettings,
  refreshTierTableNow,
  setTiersSetting,
  tiersSettingsReady,
  type TiersSettings,
} from "./tiers/tiersContent";
import type { Favorite } from "./types";

const ROOT_ID = "ptt-fab-root";
const RESET_ARM_TIMEOUT_MS = 3000;
const DELETE_ARM_TIMEOUT_MS = 3000;

function buildSliderRow(
  labelText: string,
  min: number,
  max: number,
  value: number,
  onInput: (val: number) => void,
  step = 1
): HTMLElement {
  const row = document.createElement("div");
  row.className = "ptt-settings-row";

  const label = document.createElement("label");
  label.className = "ptt-settings-label";
  label.textContent = labelText;
  row.appendChild(label);

  const controls = document.createElement("div");
  controls.className = "ptt-settings-slider-controls";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);
  slider.className = "ptt-settings-slider";

  const valueLabel = document.createElement("span");
  valueLabel.className = "ptt-settings-slider-value";
  valueLabel.textContent = String(value);

  slider.addEventListener("input", () => {
    const val = Number(slider.value);
    valueLabel.textContent = String(val);
    onInput(val);
  });
  slider.addEventListener("click", (e) => e.stopPropagation());

  controls.appendChild(slider);
  controls.appendChild(valueLabel);
  row.appendChild(controls);
  return row;
}

function buildToggleRow(labelText: string, checked: boolean, onChange: (val: boolean) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "ptt-settings-row";

  const label = document.createElement("label");
  label.className = "ptt-settings-label ptt-settings-toggle-label";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.addEventListener("change", (e) => {
    e.stopPropagation();
    onChange(checkbox.checked);
  });
  checkbox.addEventListener("click", (e) => e.stopPropagation());

  label.appendChild(checkbox);
  label.append(` ${labelText}`);
  row.appendChild(label);
  return row;
}

// Shared by every feature section (filter-visibility actions, Tier Picker
// settings, Favorites) so each reads as its own labeled box rather than the
// panel being one flat list of mismatched buttons. All three collapse
// independently, default collapsed, with the expand/collapse state persisted
// per-box in storage so it survives across browser sessions.
function buildBox(title: string, boxId: BoxId): HTMLElement {
  const box = document.createElement("div");
  box.className = "ptt-fab-box ptt-fab-box--collapsible ptt-collapsed";

  const heading = document.createElement("div");
  heading.className = "ptt-fab-box-title ptt-fab-box-title--toggle";
  heading.textContent = title;
  const chevron = document.createElement("span");
  chevron.className = "ptt-fab-box-chevron";
  chevron.textContent = "▸";
  heading.appendChild(chevron);
  heading.onclick = () => {
    const collapsed = box.classList.toggle("ptt-collapsed");
    void setBoxCollapsed(boxId, collapsed);
  };
  box.appendChild(heading);

  void getBoxCollapsed(boxId).then((collapsed) => {
    box.classList.toggle("ptt-collapsed", collapsed);
  });

  return box;
}

// Tiers' settings used to live behind their own separate gear icon in the
// bottom-right corner — merged into this panel so there's one settings
// surface for the whole extension. Built asynchronously once tiersContent's
// storage read resolves (tiersSettingsReady), since ensureFloatingPanel()
// itself runs before that async load finishes.
function buildTiersSection(): HTMLElement {
  const section = buildBox("Stat Filter Tier Picker", "tierPicker");

  function set<K extends keyof TiersSettings>(key: K, value: TiersSettings[K]): void {
    setTiersSetting(key, value);
  }

  const current = getTiersSettings();
  section.appendChild(buildSliderRow("Font size", 9, 16, current.fontSize, (val) => set("fontSize", val)));
  section.appendChild(
    buildSliderRow("Panel width", 260, 520, current.panelWidth, (val) => set("panelWidth", val), 5)
  );
  section.appendChild(
    buildToggleRow("Tier picker on stat rows", current.tierPickerEnabled, (val) => set("tierPickerEnabled", val))
  );
  section.appendChild(
    buildToggleRow("Browse Base Mods button", current.browseModsEnabled, (val) => set("browseModsEnabled", val))
  );
  section.appendChild(buildRefreshTierDataRow());

  return section;
}

// RePoE's mods/stat-translations data is normally re-fetched at most once a
// week (see tiersBackground.ts's MAX_AGE_MS) or on install — this button is
// the escape hatch for "I know RePoE just changed and don't want to wait,"
// bypassing that staleness check via forceRefresh.
function buildRefreshTierDataRow(): HTMLElement {
  const row = document.createElement("div");
  row.className = "ptt-settings-row";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ptt-btn";
  button.textContent = "Refresh tier data now";

  button.onclick = () => {
    button.disabled = true;
    button.textContent = "Refreshing…";
    void refreshTierTableNow()
      .then(() => {
        button.textContent = "Refreshed ✓";
      })
      .catch((err) => {
        console.error("[PoE Trade Tiers] manual refresh failed", err);
        button.textContent = "Refresh failed";
      })
      .finally(() => {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = "Refresh tier data now";
        }, 2000);
      });
  };

  row.appendChild(button);
  return row;
}

// Favorites are saved trade-search URLs. There's no "current search" state
// tracked elsewhere in the extension (the trade site keeps it in its own
// URL), so "save current search" just snapshots window.location.href as-is
// — whatever page the user is on when they click it.
function buildFavoritesSection(): HTMLElement {
  const box = buildBox("Favorites", "favorites");

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "ptt-btn";
  saveButton.textContent = "Save current search";

  const saveNameInput = document.createElement("input");
  saveNameInput.type = "text";
  saveNameInput.className = "ptt-favorite-save-input";
  saveNameInput.placeholder = "Name this search…";
  saveNameInput.hidden = true;

  const list = document.createElement("div");
  list.className = "ptt-favorites-list ptt-scroll-thin";

  let dragFromId: string | null = null;

  function renderList(favorites: Favorite[]): void {
    list.replaceChildren();
    if (favorites.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ptt-favorites-empty";
      empty.textContent = "No saved searches yet.";
      list.appendChild(empty);
      return;
    }
    for (const favorite of favorites) {
      list.appendChild(buildFavoriteRow(favorite));
    }
  }

  function buildFavoriteRow(favorite: Favorite): HTMLElement {
    const row = document.createElement("div");
    row.className = "ptt-favorite-row";
    row.draggable = true;

    row.addEventListener("dragstart", (e) => {
      dragFromId = favorite.id;
      row.classList.add("ptt-favorite-row--dragging");
      e.dataTransfer?.setData("text/plain", favorite.id);
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("ptt-favorite-row--dragging");
      dragFromId = null;
    });
    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      row.classList.add("ptt-favorite-row--drop-target");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("ptt-favorite-row--drop-target");
    });
    row.addEventListener("drop", (e) => {
      e.preventDefault();
      row.classList.remove("ptt-favorite-row--drop-target");
      if (!dragFromId || dragFromId === favorite.id) return;
      const ids = Array.from(list.querySelectorAll<HTMLElement>(".ptt-favorite-row")).map(
        (el) => el.dataset.favoriteId as string
      );
      const fromIndex = ids.indexOf(dragFromId);
      const toIndex = ids.indexOf(favorite.id);
      if (fromIndex === -1 || toIndex === -1) return;
      const moved = ids.splice(fromIndex, 1)[0];
      if (!moved) return;
      ids.splice(toIndex, 0, moved);
      void reorderFavorites(ids).then(renderList);
    });
    row.dataset.favoriteId = favorite.id;

    const dragHandle = document.createElement("span");
    dragHandle.className = "ptt-favorite-drag-handle";
    dragHandle.textContent = "⠿";
    dragHandle.title = "Drag to reorder";

    const nameLink = document.createElement("a");
    nameLink.className = "ptt-favorite-name";
    nameLink.href = favorite.url;
    nameLink.textContent = favorite.name;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "ptt-favorite-name-input";
    nameInput.value = favorite.name;
    nameInput.hidden = true;

    function commitRename(): void {
      nameInput.hidden = true;
      nameLink.hidden = false;
      const newName = nameInput.value.trim();
      if (newName && newName !== favorite.name) {
        void renameFavorite(favorite.id, newName).then(renderList);
      }
    }

    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.blur();
      if (e.key === "Escape") {
        nameInput.value = favorite.name;
        nameInput.blur();
      }
    });
    nameInput.addEventListener("blur", commitRename);
    nameInput.addEventListener("click", (e) => e.stopPropagation());

    const actions = document.createElement("div");
    actions.className = "ptt-favorite-actions";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "ptt-favorite-icon-btn";
    renameButton.title = "Rename";
    renameButton.textContent = "✎";
    renameButton.onclick = () => {
      nameLink.hidden = true;
      nameInput.hidden = false;
      nameInput.focus();
      nameInput.select();
    };

    const overwriteButton = document.createElement("button");
    overwriteButton.type = "button";
    overwriteButton.className = "ptt-favorite-icon-btn";
    overwriteButton.title = "Overwrite with current search";
    overwriteButton.textContent = "⟳";
    overwriteButton.onclick = () => {
      void overwriteFavoriteUrl(favorite.id, window.location.href).then(renderList);
    };

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ptt-favorite-icon-btn ptt-favorite-icon-btn--danger";
    deleteButton.title = "Delete";
    deleteButton.textContent = "✕";
    let deleteArmed = false;
    let deleteArmTimer: number | undefined;
    deleteButton.onclick = () => {
      if (!deleteArmed) {
        deleteArmed = true;
        deleteButton.textContent = "✓?";
        deleteArmTimer = window.setTimeout(() => {
          deleteArmed = false;
          deleteButton.textContent = "✕";
        }, DELETE_ARM_TIMEOUT_MS);
        return;
      }
      window.clearTimeout(deleteArmTimer);
      void removeFavorite(favorite.id).then(renderList);
    };

    actions.append(renameButton, overwriteButton, deleteButton);
    row.append(dragHandle, nameLink, nameInput, actions);
    return row;
  }

  const savedUrlAtOpen = { current: "" };

  function commitSave(): void {
    const name = saveNameInput.value.trim();
    saveNameInput.hidden = true;
    saveButton.hidden = false;
    if (!name) return;
    void addFavorite(name, savedUrlAtOpen.current).then(renderList);
  }

  saveNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveNameInput.blur();
    if (e.key === "Escape") {
      saveNameInput.value = "";
      saveNameInput.blur();
    }
  });
  saveNameInput.addEventListener("blur", commitSave);
  saveNameInput.addEventListener("click", (e) => e.stopPropagation());

  saveButton.onclick = () => {
    savedUrlAtOpen.current = window.location.href;
    saveNameInput.value = document.title || "Saved search";
    saveButton.hidden = true;
    saveNameInput.hidden = false;
    saveNameInput.focus();
    saveNameInput.select();
  };

  box.append(saveButton, saveNameInput, list);
  void getFavorites().then(renderList);

  return box;
}

function anyRevealed(): boolean {
  return (
    document.querySelector(`.${GROUPS_CONTAINER_CLASS}.${SHOW_HIDDEN_GROUPS_CLASS}`) !== null ||
    document.querySelector(`.filter-group-body.${SHOW_INACTIVE_FIELDS_CLASS}`) !== null
  );
}

function setAllRevealed(revealed: boolean): void {
  document
    .querySelectorAll(`.${GROUPS_CONTAINER_CLASS}`)
    .forEach((el) => el.classList.toggle(SHOW_HIDDEN_GROUPS_CLASS, revealed));
  document
    .querySelectorAll(".filter-group-body")
    .forEach((el) => el.classList.toggle(SHOW_INACTIVE_FIELDS_CLASS, revealed));
}

export function ensureFloatingPanel(): void {
  if (document.getElementById(ROOT_ID)) return;

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "ptt-fab-container";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ptt-fab-button";
  button.title = "PoE Trade Declutter";
  const buttonIcon = document.createElement("img");
  buttonIcon.src = browser.runtime.getURL("icons/icon-32.png");
  buttonIcon.alt = "";
  button.append(buttonIcon);

  const panel = document.createElement("div");
  panel.className = "ptt-fab-panel ptt-collapsed ptt-scroll-thin";

  void getPanelHeight().then((height) => {
    if (height) panel.style.height = `${height}px`;
  });

  // The CSS `resize: vertical` handle changes the panel's height via drag,
  // which ResizeObserver reports like any other size change — this is the
  // only reliable cross-browser way to detect it (no native "resizeend"
  // event exists). Debounced so we don't hit storage on every pixel of drag.
  let resizeSaveTimer: number | undefined;
  const resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const height = Math.round(entry.contentRect.height);
    // Collapsing sets display:none, which also fires a (0-height) resize
    // entry — skip it so we don't clobber the saved drag height.
    if (height <= 0 || panel.classList.contains("ptt-collapsed")) return;
    window.clearTimeout(resizeSaveTimer);
    resizeSaveTimer = window.setTimeout(() => {
      void setPanelHeight(height);
    }, 300);
  });
  resizeObserver.observe(panel);

  const manifest = browser.runtime.getManifest();
  const header = document.createElement("div");
  header.className = "ptt-fab-header";
  const headerBadge = document.createElement("span");
  headerBadge.className = "ptt-fab-header-badge";
  const headerIcon = document.createElement("img");
  headerIcon.src = browser.runtime.getURL("icons/icon-32.png");
  headerIcon.alt = "";
  headerBadge.append(headerIcon);
  const headerName = document.createElement("span");
  headerName.className = "ptt-fab-header-name";
  headerName.textContent = manifest.name;
  const headerVersion = document.createElement("span");
  headerVersion.className = "ptt-fab-header-version";
  headerVersion.textContent = `v${manifest.version}`;
  header.append(headerBadge, headerName, headerVersion);

  const revealButton = document.createElement("button");
  revealButton.type = "button";
  revealButton.className = "ptt-btn";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "ptt-btn ptt-btn--danger";
  resetButton.textContent = "Reset all to default";

  let resetArmed = false;
  let resetArmTimer: number | undefined;
  resetButton.onclick = () => {
    if (!resetArmed) {
      resetArmed = true;
      resetButton.textContent = "Confirm reset?";
      resetArmTimer = window.setTimeout(() => {
        resetArmed = false;
        resetButton.textContent = "Reset all to default";
      }, RESET_ARM_TIMEOUT_MS);
      return;
    }
    window.clearTimeout(resetArmTimer);
    resetArmed = false;
    resetButton.textContent = "Reset all to default";
    void resetTunerSettings();
  };

  const supportLink = document.createElement("a");
  supportLink.className = "ptt-support-link";
  supportLink.href = "https://buymeacoffee.com/vinzenz.san";
  supportLink.target = "_blank";
  supportLink.rel = "noopener noreferrer";
  supportLink.textContent = "☕ Support this project";

  const reportIssueLink = document.createElement("a");
  reportIssueLink.className = "ptt-support-link";
  reportIssueLink.href = "https://github.com/vinzenz-san/poe-trade-declutter/issues";
  reportIssueLink.target = "_blank";
  reportIssueLink.rel = "noopener noreferrer";
  reportIssueLink.textContent = "🐙 Report an issue";

  const actionsBox = buildBox("Filter Visibility", "filterVisibility");
  actionsBox.append(revealButton, resetButton);

  panel.append(header, actionsBox);
  root.append(button, panel);
  document.body.append(root);

  // Appended after the Tiers section (once its storage read resolves) so
  // the support/report links stay the very last thing in the panel
  // regardless of how many feature sections come before them.
  void tiersSettingsReady.then(() => {
    panel.appendChild(buildTiersSection());
    panel.appendChild(buildFavoritesSection());
    panel.appendChild(supportLink);
    panel.appendChild(reportIssueLink);
  });

  function updateRevealButtonLabel(): void {
    revealButton.textContent = anyRevealed() ? "Collapse all hidden" : "Reveal all hidden";
  }

  revealButton.onclick = () => {
    setAllRevealed(!anyRevealed());
    updateRevealButtonLabel();
  };

  button.onclick = () => {
    panel.classList.toggle("ptt-collapsed");
    if (!panel.classList.contains("ptt-collapsed")) updateRevealButtonLabel();
  };

  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) panel.classList.add("ptt-collapsed");
  });

  browser.storage.onChanged.addListener(() => {
    if (!panel.classList.contains("ptt-collapsed")) updateRevealButtonLabel();
  });

  updateRevealButtonLabel();
}
