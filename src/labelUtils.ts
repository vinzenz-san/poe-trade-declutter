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

// Trade's own client-side filter-schema cache (formerly `lscache-tradefilters`
// in localStorage) that used to supply stable ids has disappeared from the
// site — GGG no longer persists it anywhere reachable from the page. Deriving
// ids from the label text itself instead removes that dependency entirely;
// labels are already what we match against 1:1, so this is no less stable.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
