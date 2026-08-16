import browser from "webextension-polyfill";
import { SHOW_INACTIVE_FIELDS_CLASS } from "./domFields";
import { GROUPS_CONTAINER_CLASS, SHOW_HIDDEN_GROUPS_CLASS } from "./inlineControls";
import { resetTunerSettings } from "./settings";

const ROOT_ID = "ptt-fab-root";
const RESET_ARM_TIMEOUT_MS = 3000;

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
  revealButton.className = "ptt-reveal-button";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "ptt-reset-button";
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

  panel.append(header, revealButton, resetButton, supportLink);
  root.append(button, panel);
  document.body.append(root);

  function updateRevealButtonLabel(): void {
    revealButton.textContent = anyRevealed() ? "Collapse all hidden" : "Expand all hidden";
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
