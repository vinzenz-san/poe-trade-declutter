# PoE Trade Tuner

Browser extension to customize the [Path of Exile trade site](https://www.pathofexile.com/trade/) filter UI.

## Status

Scaffold only. Feature 1 (lock which filter categories stay open by default) is wired up but has no settings UI yet — `lockGroupVisibility` / `lockedHiddenGroups` must currently be set via `browser.storage.local` manually for testing.

## Confirmed trade-site internals (see project notes)

- `localStorage['lscache-tradesettings'].hiddenGroups` — plain object, group id (`type_filters`, `weapon_filters`, `armour_filters`, `socket_filters`, `req_filters`, `map_filters`, `heist_filters`, `sanctum_filters`, `ultimatum_filters`, `misc_filters`, `trade_filters`, `status_filters`) → boolean (`true` = collapsed). No TTL — durable.
- `localStorage['lscache-tradefilters']` — full canonical filter schema: array of `{ id, title, filters: [{ id, text, option? }] }`. No per-field visibility/order override exists here — field-level curation (Feature 2) has no native hook and will need a DOM-layer.
- `window.app.$store.state.persistent.stats` — Vuex state for stat/mod filters, mutated via `app.$store.commit("setStatFilter"/"removeStatFilter", { group, index, value: { disabled, id, value } })`.
- `window.app._data.static_.knownStatsFlat` (aka `app.static_.knownStatsFlat`) — full stat ID → label catalog, needed for future mod-tier lookup feature.

## Dev

```bash
pnpm install
pnpm build       # one-off build to dist/content.js
pnpm dev         # watch mode
pnpm typecheck
```

Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select this folder (requires `dist/` to exist, run `pnpm build` first).
