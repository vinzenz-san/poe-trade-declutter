const EYE_PATH =
  '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>';

const EYE_OFF_PATH =
  '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.8 21.8 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.8 21.8 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/>' +
  '<line x1="1" y1="1" x2="23" y2="23"/>';

function buildIcon(path: string, extraClass: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "12");
  svg.setAttribute("height", "12");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.classList.add(extraClass);
  svg.innerHTML = path;
  return svg;
}

// Both icons are created once and toggled via a CSS class, never via innerHTML swaps — an innerHTML
// replacement is a childList mutation, which would re-trigger the page-wide MutationObserver and
// race against our own pending storage write, undoing the just-applied optimistic UI change.
export function createIconToggle(className: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ptt-icon-toggle ${className}`;
  btn.append(buildIcon(EYE_PATH, "ptt-icon-eye"), buildIcon(EYE_OFF_PATH, "ptt-icon-eye-off"));
  return btn;
}

export function syncIconToggle(btn: HTMLButtonElement, inactive: boolean, title: string): void {
  btn.classList.toggle("ptt-active", inactive);
  btn.title = title;
}
