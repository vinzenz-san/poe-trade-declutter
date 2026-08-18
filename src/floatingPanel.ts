import browser from "webextension-polyfill";
import { SHOW_INACTIVE_FIELDS_CLASS } from "./domFields";
import { GROUPS_CONTAINER_CLASS, SHOW_HIDDEN_GROUPS_CLASS } from "./inlineControls";
import { resetTunerSettings } from "./settings";
import { getTiersSettings, setTiersSetting, tiersSettingsReady, type TiersSettings } from "./tiers/tiersContent";

const ROOT_ID = "ptt-fab-root";
const RESET_ARM_TIMEOUT_MS = 3000;

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
// settings) so each reads as its own labeled box rather than the panel
// being one flat list of mismatched buttons.
function buildBox(title: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "ptt-fab-box";

  const heading = document.createElement("div");
  heading.className = "ptt-fab-box-title";
  heading.textContent = title;
  box.appendChild(heading);

  return box;
}

// Tiers' settings used to live behind their own separate gear icon in the
// bottom-right corner — merged into this panel so there's one settings
// surface for the whole extension. Built asynchronously once tiersContent's
// storage read resolves (tiersSettingsReady), since ensureFloatingPanel()
// itself runs before that async load finishes.
function buildTiersSection(): HTMLElement {
  const section = buildBox("Stat Filter Tier Picker");

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

  return section;
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
  panel.className = "ptt-fab-panel ptt-collapsed";

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

  const actionsBox = buildBox("Filter Visibility");
  actionsBox.append(revealButton, resetButton);

  panel.append(header, actionsBox);
  root.append(button, panel);
  document.body.append(root);

  // Appended after the Tiers section (once its storage read resolves) so
  // the support/report links stay the very last thing in the panel
  // regardless of how many feature sections come before them.
  void tiersSettingsReady.then(() => {
    panel.appendChild(buildTiersSection());
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
