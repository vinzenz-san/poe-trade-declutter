# Store listing reference

Copy-paste source for the Chrome Web Store / Firefox AMO submission forms.

## Short description (Chrome: max 132 characters)

Hide unwanted filter categories and individual filters on the Path of Exile trade site's search page.

## Full description

**PoE Trade Declutter** lets you tidy up the official [Path of Exile trade site](https://www.pathofexile.com/trade/)'s search filters to match how you actually search.

- **Hide whole filter categories** you never use (e.g. Sanctum Filters, Heist Filters) — collapse them out of the way with one click, and bring them back just as easily.
- **Hide individual filters** within a category (e.g. "Base Percentile" under Miscellaneous) without losing the ones you do use.
- **Everything is reversible** — a small "Hidden filters (N)" toggle per category, and a global "Expand all hidden" button, let you review or restore anything you've hidden.
- **No account, no sign-in, no tracking.** Your preferences are stored locally in your browser and never leave your device.

This is an independent, unofficial project — not affiliated with or endorsed by Grinding Gear Games.

## Category

Productivity / Tools (Chrome) — "Spiele und Unterhaltung" / Games & Entertainment (Firefox AMO)

## License

MIT (matches the repo's `LICENSE` file) — not GPL.

## Permission justifications (for review forms)

**`storage`**
> Used to save the user's chosen hidden categories/filters locally (via `browser.storage.local`) so their preferences persist between visits to the trade site. No data is transmitted anywhere.

**Host permission: `https://www.pathofexile.com/trade*`, `https://www.pathofexile.com/trade2*`**
> The extension's sole function is to add show/hide controls to the filter panel on the official Path of Exile trade site. It does not run on, read, or modify any other site.

**Single purpose (Chrome requires a one-line summary)**
> Lets users hide and reorganize filter categories on the Path of Exile trade site's search page.

## Privacy policy URL

Once GitHub Pages is enabled for this repo (Settings → Pages → Source: GitHub Actions): `https://vinzenz-dev.de/poe-trade-declutter/privacy.html`

## Screenshots needed

At minimum one screenshot showing:
1. The trade site filter panel with some categories/filters hidden and the "Hidden filters (N)" toggle visible.
2. The floating settings panel (gear icon → header/reveal-all/reset/support link) open.

(1280×800 or 640×400 for Chrome; Firefox AMO accepts most reasonable sizes.)
