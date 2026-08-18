# Store listing reference

Copy-paste source for the Chrome Web Store / Firefox AMO submission forms.

## Short description (Chrome: max 132 characters)

Hide unwanted trade filters and pick minimum stat tiers on the Path of Exile trade site's search page.

## Full description

**PoE Trade Declutter** lets you tidy up the official [Path of Exile trade site](https://www.pathofexile.com/trade/)'s search filters to match how you actually search, and adds a tier picker for stat filters.

- **Hide whole filter categories** you never use (e.g. Sanctum Filters, Heist Filters) — collapse them out of the way with one click, and bring them back just as easily.
- **Hide individual filters** within a category (e.g. "Base Percentile" under Miscellaneous) without losing the ones you do use.
- **Pick a minimum stat tier** directly from a stat filter's min/max boxes — no more looking up exact tier value ranges.
- **Browse every possible modifier** for the selected item category and add one straight into your search.
- **Everything is reversible** — a small "Hidden filters (N)" toggle per category, and a global "Reveal all hidden" button, let you review or restore anything you've hidden.
- **No account, no sign-in, no tracking.** Your preferences are stored locally in your browser and never leave your device. Tier data is fetched from [RePoE](https://github.com/brather1ng/RePoE), a public, community-maintained mirror of Path of Exile's own game data — no information about you is sent as part of that fetch.

This is an independent, unofficial project — not affiliated with or endorsed by Grinding Gear Games.

## Full description (plain text — paste as-is)

Chrome's description field doesn't render Markdown: pasting the section above literally shows the `**`/`[]()` characters and no clickable links. This is the same content converted to plain text.

```
PoE Trade Declutter lets you tidy up the official Path of Exile trade site's search filters to match how you actually search, and adds a tier picker for stat filters.

- Hide whole filter categories you never use (e.g. Sanctum Filters, Heist Filters) — collapse them out of the way with one click, and bring them back just as easily.
- Hide individual filters within a category (e.g. "Base Percentile" under Miscellaneous) without losing the ones you do use.
- Pick a minimum stat tier directly from a stat filter's min/max boxes — no more looking up exact tier value ranges.
- Browse every possible modifier for the selected item category and add one straight into your search.
- Everything is reversible — a small "Hidden filters (N)" toggle per category, and a global "Reveal all hidden" button, let you review or restore anything you've hidden.
- No account, no sign-in, no tracking. Your preferences are stored locally in your browser and never leave your device. Tier data is fetched from RePoE (github.com/brather1ng/RePoE), a public, community-maintained mirror of Path of Exile's own game data — no information about you is sent as part of that fetch.

This is an independent, unofficial project — not affiliated with or endorsed by Grinding Gear Games.
```

## Category

Productivity / Tools (Chrome) — "Spiele und Unterhaltung" / Games & Entertainment (Firefox AMO)

## License

MIT (matches the repo's `LICENSE` file) — not GPL.

## Permission justifications (for review forms)

**`storage`**
> Used to save the user's chosen hidden categories/filters and tier-picker settings locally (via `browser.storage.local`), and to cache the fetched RePoE tier data so it isn't re-downloaded on every page load. No user data is transmitted anywhere.

**Host permission: `https://www.pathofexile.com/trade*`**
> The extension's sole function is to add show/hide and tier-picker controls to the filter panel on the official Path of Exile trade site. It does not run on, read, or modify any other site.

**Host permission: `https://raw.githubusercontent.com/brather1ng/RePoE/*`**
> Fetches publicly-published Path of Exile stat/modifier data files from RePoE, a community-maintained data mirror, to build the tier-picker's stat tables. Scoped to this one repository only. This is a read-only download of public game data — no user data is sent as part of it.

**Single purpose (Chrome requires a one-line summary)**
> Lets users hide/reorganize filter categories and pick minimum stat tiers on the Path of Exile trade site's search page.

## Privacy policy URL

`https://vinzenz-dev.de/poe-trade-declutter/privacy.html`

## Screenshots needed

At minimum one screenshot showing:
1. The trade site filter panel with some categories/filters hidden and the "Hidden filters (N)" toggle visible.
2. A stat filter row with the tier-picker "T" button and Browse Base Mods button visible.
3. The floating settings panel open, showing both the "Filter Visibility" and "Stat Filter Tier Picker" boxes.

(1280×800 or 640×400 for Chrome; Firefox AMO accepts most reasonable sizes.)
