# Changelog

## 0.3.0 — 2026-08-20

Added a third settings-panel section, Favorites: save the current trade search as a named bookmark, then rename, overwrite with the current search, delete, or drag to reorder saved entries (newest first by default). All three panel sections (Filter Visibility, Stat Filter Tier Picker, Favorites) are now independently collapsible, default collapsed, with each section's expand/collapse state persisted across sessions. The panel itself can now be resized vertically via a drag handle, and its height is likewise remembered across sessions/tabs. Long lists (the panel body, Favorites) use a shared thin dark scrollbar instead of the browser's default. Release tooling: `release/` zips are now named `vX.X.X-<target>.zip` so they sort by version, older release zips are no longer deleted on each release build, and a new `pnpm dev:chrome` / `dev:firefox` step stages a ready-to-load-unpacked folder at `dist-unpacked/<target>` so testing a change no longer requires unzipping a release build.

## 0.2.2 — 2026-08-18

Chrome Web Store is live — landing page's Chrome badge now links to the real listing instead of being greyed out, and the site copy/footer mention Chrome availability and the tier picker feature. Browse Base Mods list no longer shows the internal `~explicit ` search-syntax prefix in its display text (still typed into trade's own search box under the hood, just not shown to the user — it read as noise, not something they need to know or type themselves).

## 0.2.1 — 2026-08-18

Tier Picker's settings (font size, panel width, tier picker/Browse Base Mods toggles) moved out of their own separate bottom-right gear icon into the shared floating panel, next to the existing filter-hiding controls — one settings surface instead of two. Both feature groups now sit in their own labeled box ("Filter Visibility" / "Stat Filter Tier Picker") with a consistent PoE-trade-style look: gold-outlined buttons that fill solid gold on hover, square checkboxes matching the site's own (empty outline / solid cream fill with a black inset ring), gold slider accents, and one shared color/font-size scale across both feature sets instead of the mismatched fonts and blue-tinted native controls left over from the merge. Browse Base Mods now shows a visible "Select an item category first" warning on the button itself instead of only logging to the console. Added a "Report an issue" link (same pattern as StartGrid's settings panel) below the existing support link. Reveal/Reset button defaults: font size 12, panel width 400, with the width slider stepping in increments of 5. "Expand all hidden" renamed to "Reveal all hidden" to match the existing internal naming.

## 0.2.0 — 2026-08-18

Merged in poe-trade-tiers as a second feature: a "T" tier-picker button next to stat filters' min/max boxes that fills in a tier's value range, plus a "Browse Base Mods" button that lists every possible modifier for the selected item category (tier data sourced from RePoE, see README credits). Runs alongside the existing filter-hiding feature in the same extension — separate settings gear icon in the bottom-right corner for now, not yet unified with the floating panel above. `/trade2` support dropped (poe-trade-tiers didn't have it and it wasn't a priority for this merge), so the extension now targets `pathofexile.com/trade` only.

## 0.1.0 — 2026-08-16

Initial release. Lets you hide whole filter categories or individual filters on the Path of Exile trade site, each with a small eye icon right next to it, and bring anything back with a one-click "Hidden filters" toggle or the global "Expand all hidden" button in the floating settings panel. Everything is stored locally in your browser — no account, no tracking, nothing sent anywhere. Available for Firefox now, Chrome Web Store listing pending.
