import { createIconToggle, syncIconToggle } from "./iconToggle";
import { extractLabelText, slugify } from "./labelUtils";
import { readTunerSettings, writeTunerSettings } from "./settings";
import type { GroupId } from "./types";

const INACTIVE_FIELD_CLASS = "ptt-inactive-field";
export const SHOW_INACTIVE_FIELDS_CLASS = "ptt-show-inactive";
const TOGGLE_CLASS = "ptt-inactive-toggle";
const FIELD_CHECKBOX_CLASS = "ptt-field-toggle";

function getFieldRows(body: Element): HTMLElement[] {
  return Array.from(body.children).filter(
    (el): el is HTMLElement => el.classList.contains("filter") && !el.classList.contains(TOGGLE_CLASS)
  );
}

function getRowLabel(row: Element): string | null {
  const titleEl = row.querySelector(".filter-title");
  return titleEl ? extractLabelText(titleEl) : null;
}

function getOrCreateGroupToggle(groupEl: Element, body: HTMLElement): HTMLButtonElement {
  const titleEl = groupEl.querySelector<HTMLElement>(".filter-group-header .filter-title");
  const existing = titleEl?.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
  if (existing) return existing;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = TOGGLE_CLASS;
  toggle.onclick = (e) => {
    e.stopPropagation();
    body.classList.toggle(SHOW_INACTIVE_FIELDS_CLASS);
  };
  titleEl?.append(toggle);
  return toggle;
}

function updateGroupToggleLabel(groupEl: Element, body: HTMLElement): void {
  const count = getFieldRows(body).filter((r) => r.classList.contains(INACTIVE_FIELD_CLASS)).length;
  if (count === 0) {
    groupEl.querySelector(`.filter-group-header .${TOGGLE_CLASS}`)?.remove();
    body.classList.remove(SHOW_INACTIVE_FIELDS_CLASS);
  } else {
    getOrCreateGroupToggle(groupEl, body).textContent = `Hidden filters (${count})`;
  }
}

async function toggleFieldInactive(groupId: GroupId, fieldId: string, inactive: boolean): Promise<void> {
  const settings = await readTunerSettings();
  const current = new Set(settings.inactiveFields[groupId] ?? []);
  if (inactive) current.add(fieldId);
  else current.delete(fieldId);
  await writeTunerSettings({
    ...settings,
    inactiveFields: { ...settings.inactiveFields, [groupId]: Array.from(current) },
  });
}

function ensureFieldCheckbox(
  row: HTMLElement,
  groupEl: Element,
  body: HTMLElement,
  groupId: GroupId,
  fieldId: string,
  inactive: boolean
): void {
  const titleEl = row.querySelector<HTMLElement>(".filter-title");
  if (!titleEl) return;

  let toggle = titleEl.querySelector<HTMLButtonElement>(`.${FIELD_CHECKBOX_CLASS}`);
  if (!toggle) {
    toggle = createIconToggle(FIELD_CHECKBOX_CLASS);
    titleEl.prepend(toggle);
  }
  syncIconToggle(toggle, inactive, inactive ? "Hidden — click to show" : "Click to hide");

  // Applies the visual change immediately (independent of the async storage round-trip and its
  // debounced re-render, which can be starved by unrelated page activity) so clicks never feel stuck.
  toggle.onclick = (e) => {
    e.stopPropagation();
    const nextInactive = !row.classList.contains(INACTIVE_FIELD_CLASS);
    syncIconToggle(toggle!, nextInactive, nextInactive ? "Hidden — click to show" : "Click to hide");
    row.classList.toggle(INACTIVE_FIELD_CLASS, nextInactive);
    updateGroupToggleLabel(groupEl, body);
    void toggleFieldInactive(groupId, fieldId, nextInactive);
  };
}

export function applyFieldTiering(inactiveFields: Partial<Record<GroupId, string[]>>): void {
  document.querySelectorAll(".filter-group").forEach((groupEl) => {
    const titleEl = groupEl.querySelector(".filter-group-header .filter-title");
    const title = titleEl ? extractLabelText(titleEl) : null;
    if (!title) return;
    const groupId = slugify(title);

    const body = groupEl.querySelector<HTMLElement>(".filter-group-body");
    if (!body) return;

    const inactiveIds = new Set(inactiveFields[groupId] ?? []);

    getFieldRows(body).forEach((row) => {
      const label = getRowLabel(row);
      if (!label) return;
      const fieldId = slugify(label);

      const isInactive = inactiveIds.has(fieldId);
      ensureFieldCheckbox(row, groupEl, body, groupId, fieldId, isInactive);
      row.classList.toggle(INACTIVE_FIELD_CLASS, isInactive);
    });

    updateGroupToggleLabel(groupEl, body);
  });
}
