import { createIconToggle, syncIconToggle } from "./iconToggle";
import { extractLabelText } from "./labelUtils";
import { readTunerSettings, writeTunerSettings } from "./settings";
import type { FieldSchemaGroup, GroupId } from "./types";

const GROUP_CHECKBOX_CLASS = "ptt-group-inactive-toggle";
const INACTIVE_GROUP_CLASS = "ptt-inactive-group";
const SHOW_TOGGLE_CLASS = "ptt-groups-toggle";
export const SHOW_HIDDEN_GROUPS_CLASS = "ptt-show-hidden-groups";
export const GROUPS_CONTAINER_CLASS = "ptt-groups-container";

async function toggleGroupInactive(groupId: GroupId, inactive: boolean): Promise<void> {
  const settings = await readTunerSettings();
  const set = new Set(settings.inactiveGroups);
  if (inactive) set.add(groupId);
  else set.delete(groupId);
  await writeTunerSettings({ ...settings, inactiveGroups: Array.from(set) });
}

function getOrCreateShowHiddenToggle(container: HTMLElement): HTMLButtonElement {
  const existing = container.querySelector<HTMLButtonElement>(`:scope > .${SHOW_TOGGLE_CLASS}`);
  if (existing) return existing;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = SHOW_TOGGLE_CLASS;
  toggle.onclick = () => container.classList.toggle(SHOW_HIDDEN_GROUPS_CLASS);
  container.prepend(toggle);
  return toggle;
}

function updateHiddenGroupsLabel(container: HTMLElement): void {
  const count = container.querySelectorAll(`:scope > .filter-group.${INACTIVE_GROUP_CLASS}`).length;
  if (count === 0) {
    container.querySelector(`:scope > .${SHOW_TOGGLE_CLASS}`)?.remove();
    container.classList.remove(SHOW_HIDDEN_GROUPS_CLASS);
  } else {
    getOrCreateShowHiddenToggle(container).textContent = `Hidden categories (${count})`;
  }
}

export function applyGroupTiering(schema: FieldSchemaGroup[] | null, inactiveGroups: GroupId[]): void {
  if (!schema) return;

  const groupEls = Array.from(document.querySelectorAll<HTMLElement>(".filter-group"));
  const container = groupEls[0]?.parentElement;
  if (!(container instanceof HTMLElement)) return;
  container.classList.add(GROUPS_CONTAINER_CLASS);

  const inactiveSet = new Set(inactiveGroups);

  groupEls.forEach((groupEl) => {
    const titleEl = groupEl.querySelector<HTMLElement>(".filter-group-header .filter-title");
    const title = titleEl ? extractLabelText(titleEl) : null;
    const schemaGroup = schema.find((g) => g.title === title);
    if (!schemaGroup || !titleEl) return;

    const isInactive = inactiveSet.has(schemaGroup.id);
    groupEl.classList.toggle(INACTIVE_GROUP_CLASS, isInactive);

    let toggle = titleEl.querySelector<HTMLButtonElement>(`.${GROUP_CHECKBOX_CLASS}`);
    if (!toggle) {
      toggle = createIconToggle(GROUP_CHECKBOX_CLASS);
      titleEl.prepend(toggle);
    }
    syncIconToggle(toggle, isInactive, isInactive ? "Hidden — click to show" : "Click to hide this category");

    // Applies the visual change immediately (independent of the async storage round-trip and its
    // debounced re-render, which can be starved by unrelated page activity) so clicks never feel stuck.
    toggle.onclick = (e) => {
      e.stopPropagation();
      const nextInactive = !groupEl.classList.contains(INACTIVE_GROUP_CLASS);
      syncIconToggle(toggle!, nextInactive, nextInactive ? "Hidden — click to show" : "Click to hide this category");
      groupEl.classList.toggle(INACTIVE_GROUP_CLASS, nextInactive);
      updateHiddenGroupsLabel(container);
      void toggleGroupInactive(schemaGroup.id, nextInactive);
    };
  });

  updateHiddenGroupsLabel(container);
}
