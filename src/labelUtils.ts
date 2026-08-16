// Reads label text while ignoring our own injected controls (icon toggles, the inactive-filters
// button) and any hidden tooltip description lines the site embeds in the same element.
export function extractLabelText(el: Element): string | null {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(".ptt-icon-toggle, .ptt-inactive-toggle").forEach((n) => n.remove());

  const raw = clone.textContent;
  if (!raw) return null;

  const firstLine = raw
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  return firstLine ?? null;
}
