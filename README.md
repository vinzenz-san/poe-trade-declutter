# PoE Trade Declutter

Browser extension (Firefox &amp; Chrome) to declutter the [Path of Exile trade site](https://www.pathofexile.com/trade/)'s filter UI — hide whole filter categories or individual filters you never use, and pick minimum stat tiers directly from a filter's min/max boxes.

## Features

**Filter visibility**
- Hide/show individual filters within a category (small eye icon next to each filter's label).
- Hide/show entire filter categories (eye icon next to each category's title).
- Everything is reversible — a "Hidden filters (N)" toggle per category, and a global "Reveal all hidden" button in the floating settings panel (small icon button in the top-right of the trade page).
<table>
<tr>
<td><img width="762" height="666" alt="screenshot_1" src="https://github.com/user-attachments/assets/61743ab2-6d1c-462b-a5d4-7ff482948e49" /></td>
<td><img width="271" height="734" alt="screenshot_5" src="https://github.com/user-attachments/assets/268903ad-b898-4e9a-ad3e-63fe3c42a592" /></td>
</tr>
</table>

**Stat filter tier picker** (merged in from the former standalone poe-trade-tiers extension)
- A "T" button next to a stat filter's min/max![Uploading screenshot_5.png…]()
 boxes lets you pick a minimum tier and fills in its value range — no more looking up exact numbers per tier.
- "Browse Base Mods" lists every possible modifier for the selected item category and adds one straight into your search.
- Tier data is discovered dynamically from [RePoE](https://github.com/brather1ng/RePoE) (see Credits below), not a hand-curated list, so coverage isn't limited to a handful of common stats.
<img width="614" height="238" alt="Screenshot_3" src="https://github.com/user-attachments/assets/67688113-a862-4ea4-919e-e3e40aaf7706" />

**Favorites**
- Save the current trade search as a named bookmark, one click.
- Rename, overwrite with the current search, delete, or drag to reorder saved searches.

No account, no analytics, no data sent about you or your searches — preferences, saved searches, and the cached tier data are all stored locally via `browser.storage.local`. The only outgoing network request is a one-way fetch of RePoE's public data files to build the tier tables. See [`docs/privacy.html`](docs/privacy.html).

## Credits

Tier data comes from [RePoE](https://github.com/brather1ng/RePoE), a community-maintained, MIT-licensed structured export of Path of Exile's game files (using [PyPoE](https://github.com/OmegaK2/PyPoE) for parsing). The underlying game data itself belongs to Grinding Gear Games — RePoE's code is MIT-licensed, but the generated `data` files it publishes are not; they're GGG's own content in a reformatted shape.

## Confirmed trade-site internals

- `localStorage['lscache-tradesettings'].hiddenGroups` — plain object, group id → boolean (`true` = collapsed). No TTL — durable. (Not currently used by the extension; PoE's own session persistence for category expand/collapse state is sufficient.)
- `localStorage['lscache-tradefilters']` — full canonical filter schema: array of `{ id, title, filters: [{ id, text, option? }] }`. This is the live source of truth the extension reads to match DOM rows/groups against stable IDs — no category or field list is hardcoded, so new ones PoE adds should work without a code change.
- `window.app.$store.state.persistent.stats` — Vuex state for stat/mod filters (the "Add Stat Filter" search box), mutated via `app.$store.commit("setStatFilter"/"removeStatFilter", { group, index, value: { disabled, id, value } })`. Not yet used by the extension.
- `window.app._data.static_.knownStatsFlat` (aka `app.static_.knownStatsFlat`) — full stat ID → label catalog.

## Dev

```bash
pnpm install
pnpm build       # one-off build to dist/
pnpm dev         # watch mode
pnpm typecheck
```

**Load unpacked (Firefox)**: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → select `manifest.json` directly.

**Load unpacked (Chrome)**: Chrome's MV3 background requires `service_worker`, which differs from Firefox's `scripts` key — the repo's `manifest.json` is Firefox-flavored, so Chrome can't load this repo directly. Instead:

```bash
pnpm dev:chrome     # or: pnpm dev:firefox
```

This builds and stages a self-contained, Chrome-flavored (or Firefox-flavored) extension folder at `dist-unpacked/chrome` (or `dist-unpacked/firefox`) — point "Load unpacked" at that folder and re-run the script after each change.

## Release

```bash
pnpm release
```

Builds and packages three zips into `release/` (old-version zips are kept, not deleted, so they accumulate across releases):
- `vX.Y.Z-firefox.zip` — Firefox-flavored manifest
- `vX.Y.Z-chrome.zip` — Chrome-flavored manifest (derived automatically, `background.service_worker` instead of `scripts`)
- `vX.Y.Z-source.zip` — source code bundle for AMO's review requirement

See [`docs/store-listing.md`](docs/store-listing.md) for store listing copy and permission justifications.
