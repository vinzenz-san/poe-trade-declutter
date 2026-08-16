# PoE Trade Declutter

Browser extension (Firefox &amp; Chrome) to declutter the [Path of Exile trade site](https://www.pathofexile.com/trade/)'s filter UI — hide whole filter categories or individual filters you never use, without losing them permanently.

## Features

- Hide/show individual filters within a category (small eye icon next to each filter's label).
- Hide/show entire filter categories (eye icon next to each category's title).
- Everything is reversible — a "Hidden filters (N)" toggle per category, and a global "Expand all hidden" button in the floating settings panel (small icon button in the top-right of the trade page).
- No account, no network requests, no analytics — preferences are stored locally via `browser.storage.local`. See [`docs/privacy.html`](docs/privacy.html).

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

**Load unpacked (Chrome)**: Chrome's MV3 background requires `service_worker`, which differs from Firefox's `scripts` key — the repo's `manifest.json` is Firefox-flavored, so for Chrome use `pnpm release` (below) and load the extracted `release/poe-trade-declutter-chrome-vX.Y.Z.zip` instead of this repo directly.

## Release

```bash
pnpm release
```

Builds and packages three zips into `release/`:
- `poe-trade-declutter-firefox-vX.Y.Z.zip` — Firefox-flavored manifest
- `poe-trade-declutter-chrome-vX.Y.Z.zip` — Chrome-flavored manifest (derived automatically, `background.service_worker` instead of `scripts`)
- `poe-trade-declutter-source-vX.Y.Z.zip` — source code bundle for AMO's review requirement

See [`docs/store-listing.md`](docs/store-listing.md) for store listing copy and permission justifications.
