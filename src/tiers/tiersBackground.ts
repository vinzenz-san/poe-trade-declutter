// Fetches RePoE's mods.json + stat_translations.json, discovers the full
// "regular, chaos-obtainable" prefix/suffix mod pool per item class (not a
// hand-curated subset), and distills it into a tier table + matching text
// derived from RePoE's own translations rather than guessed labels. Caches
// the distilled result (not the ~28MB of raw JSON) in storage.local,
// refreshed lazily whenever the content script asks for a stale-or-missing
// table (see getTierTable's MAX_AGE_MS check) — no `alarms` permission
// needed for this, since there's nothing useful to pre-warm in the
// background when no trade tab is even open to consume it.
//
// Ported from the standalone poe-trade-tiers extension; initTiersBackground
// is called once from the merged extension's background.ts entry point
// alongside Declutter's own background init, so both features share one
// bundled service worker / background script.

import browser from "webextension-polyfill";
import { EXCLUDE_MOD_KEY_RE, ITEM_CLASSES, normalizeStatText, type ItemClassDef } from "./lib/statDefs";
import type { GetTierTableMessage, TierTable, TierTableEntry } from "./lib/types";

const MODS_URL = "https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/mods.json";
const STAT_TRANSLATIONS_URL =
  "https://raw.githubusercontent.com/brather1ng/RePoE/master/RePoE/data/stat_translations.json";
const STORAGE_KEY = "tierTable";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

// Only stat_translations "index_handlers" we know how to apply safely. A
// stat using any other handler (e.g. "negate", "per_minute_to_per_second")
// is skipped rather than risk showing a wrongly-scaled number.
const KNOWN_HANDLER_DIVISORS: Record<string, number> = {
  divide_by_one_hundred: 100,
};

// --- RePoE raw data shapes (only the fields we actually read) ---

interface RePoESpawnWeight {
  tag: string;
  weight: number;
}

interface RePoEStat {
  id: string;
  min: number;
  max: number;
}

interface RePoEMod {
  domain: string;
  generation_type: string;
  is_essence_only: boolean;
  groups?: string[];
  stats?: RePoEStat[];
  spawn_weights: RePoESpawnWeight[];
  required_level: number;
}

interface RePoEStatTranslationVariant {
  string: string;
  format?: (string | null)[];
  index_handlers?: string[][];
}

interface RePoEStatTranslationEntry {
  ids: string[];
  English?: RePoEStatTranslationVariant[];
}

// An item carries multiple RePoE tags at once (e.g. a One Hand Sword is
// "sword" + "one_hand_weapon" + "weapon" simultaneously; boots are "boots"
// + "armour" + an attribute-affinity subtype like "str_armour"), and mods
// key off whichever tag is most convenient for them (attack speed uses the
// generic "weapon" tag rather than each specific weapon type).
//
// Tags must be checked in specific-to-generic PRIORITY order, not as an
// unordered "any positive wins" set: some mods have an explicit veto on a
// specific slot (e.g. armour tier 8+ of local_base_physical_damage_
// reduction_rating has `"boots": 0, "gloves": 0`) while still listing a
// positive weight for the broader `str_armour` tag those slots also carry
// — the specific-slot veto must win, or boots incorrectly inherit tiers
// that only body armour/helmet/shield can actually roll (confirmed live:
// real Armour caps at tier 7/150 on boots, RePoE's full str_armour line
// goes to tier 11/500). `ITEM_CLASSES[x].tags` is already ordered
// specific-first (exact slot/weapon-type tag, then broader subtype tags,
// then the most generic category tag), so: walk the tags in that order and
// use the FIRST one that has an explicit spawn_weight entry — don't keep
// looking past it even if a later, more generic tag would also match.
// Only fall back to "default" if none of the item's tags have any explicit
// entry at all.
function appliesToClass(mod: RePoEMod, tags: string[]): boolean {
  for (const tag of tags) {
    const w = mod.spawn_weights.find((x) => x.tag === tag);
    if (w) return w.weight > 0;
  }
  const def = mod.spawn_weights.find((x) => x.tag === "default");
  return def ? def.weight > 0 : false;
}

interface ResolvedVariant {
  matchText: string;
  divisor: number;
  label: string;
}

interface StatTextEntry {
  positive: ResolvedVariant | null;
  negative: ResolvedVariant | null;
}

// statId -> { positive, negative } — each either
// { matchText, divisor, label } or null (no matching/supported variant).
//
// A single translation entry can jointly cover multiple stat ids with
// variants for different value COMBINATIONS across all of them, and these
// come in two genuinely different shapes:
//  - A "special case" branch that doesn't render our id's value at all
//    (format[idx] === "ignore") — e.g. local_physical_damage_+% paired
//    with a companion boolean, where one branch is the fixed string
//    "No Physical Damage". These must be skipped for our id.
//  - A truly joint display where MULTIPLE positions render together, e.g.
//    "Adds {0} to {1} Physical Damage" (added-damage min/max) — unlike the
//    "No Physical Damage" case, here our id's own value genuinely is shown,
//    but only paired with a sibling id's value we don't independently
//    have/apply anywhere. Showing this id "standalone" would silently only
//    ever fill in half a compound stat, so these are excluded too: a
//    variant is only accepted if it renders EXACTLY ONE position (ours).
//
// Some stats ONLY roll negative in practice (e.g. "reduced Attribute
// Requirements" is stored as a negative number with no positive
// counterpart) — for those, the *correct* display is the "negate" branch,
// so we can't blanket-exclude "negate" the way an earlier version of this
// did (it mis-labelled a -18 value as "increased Attribute Requirements").
// Instead we resolve both a positive-value and a negative-value variant per
// id, and buildTierTable below picks whichever matches the mod's actual
// rolled sign.
function buildStatTextIndex(statTranslations: RePoEStatTranslationEntry[]): Map<string, StatTextEntry> {
  const index = new Map<string, StatTextEntry>();

  function resolveVariant(
    variants: RePoEStatTranslationVariant[],
    idx: number,
    wantNegate: boolean
  ): ResolvedVariant | null {
    const variant = variants.find((v) => {
      const format = v.format?.[idx];
      const handlers = v.index_handlers?.[idx] || [];
      if (!format || format === "ignore") return false;
      if (handlers.includes("negate") !== wantNegate) return false;
      const renderedPositions = (v.format || []).filter((f) => f && f !== "ignore").length;
      return renderedPositions === 1;
    });
    if (!variant) return null;

    const handlers = (variant.index_handlers?.[idx] || []).filter((h) => h !== "negate");
    let divisor = 1;
    for (const h of handlers) {
      if (h in KNOWN_HANDLER_DIVISORS) {
        divisor *= KNOWN_HANDLER_DIVISORS[h]!;
      } else {
        return null; // unsupported handler — don't risk a wrongly-scaled number
      }
    }
    return { matchText: normalizeStatText(variant.string), divisor, label: variant.string };
  }

  for (const entry of statTranslations) {
    const variants = entry.English || [];
    entry.ids.forEach((id, idx) => {
      if (index.has(id)) return; // first entry containing this id wins
      index.set(id, {
        positive: resolveVariant(variants, idx, false),
        negative: resolveVariant(variants, idx, true),
      });
    });
  }

  return index;
}

interface Ladder {
  statId: string;
  matchText: string;
  label: string;
  rows: { min: number; max: number; requiredLevel: number }[];
  prefixCount: number;
  suffixCount: number;
  subtypes: Set<string>;
}

function buildTierTable(mods: Record<string, RePoEMod>, statTranslations: RePoEStatTranslationEntry[]): TierTable {
  const table: TierTable = {};
  const modKeys = Object.keys(mods);
  const statTextIndex = buildStatTextIndex(statTranslations);

  for (const [itemClassKey, itemClass] of Object.entries(ITEM_CLASSES) as [string, ItemClassDef][]) {
    // Keyed by stat id (not mod group): some stats have separate prefix and
    // suffix mod groups that roll different ranges but display as the same
    // text (e.g. "increased Rarity of Items found" — verified as two
    // distinct groups, 6-10/11-14 suffix vs 8-12/13-18 prefix) — the trade
    // site shows these as a single stat/row, so their tiers must merge into
    // one combined ladder rather than staying split and silently shadowing
    // each other.
    const ladders = new Map<string, Ladder>();

    for (const key of modKeys) {
      const mod = mods[key];
      if (!mod) continue;
      if (mod.domain !== "item") continue;
      if (mod.generation_type !== "prefix" && mod.generation_type !== "suffix") continue;
      if (mod.is_essence_only) continue;
      if (EXCLUDE_MOD_KEY_RE.test(key)) continue;
      if ((mod.groups || []).length !== 1) continue;
      // Single-stat mods only. Two-stat "hybrid" mods (e.g. "+# to Armour,
      // +# to maximum Energy Shield") were briefly supported by processing
      // each component independently, but that let hybrid-only value
      // ranges bleed into the same ladder as pure single-attribute bases
      // (e.g. "+# to Armour" merging a str-only base's 11-tier ladder with
      // a str/int hybrid base's separate, smaller-value 8-tier ladder into
      // one misleading 31-entry blend) — and trade has no way to search
      // for the hybrid pair as one unit anyway, so there's nothing useful
      // to add them for.
      if ((mod.stats || []).length !== 1) continue;
      if (!appliesToClass(mod, itemClass.tags)) continue;

      const stat = mod.stats![0]!;
      const signs = statTextIndex.get(stat.id);
      if (!signs) continue; // no translation entry at all for this id

      // Pick the variant matching this mod's actual rolled sign. A
      // "negate" variant displays the value flipped positive (e.g. a
      // stored -18 becomes a displayed "18" under "reduced X"), which
      // also flips which raw bound is the tier's min vs max.
      const isNegative = stat.min < 0 && stat.max < 0;
      const textInfo = isNegative ? signs.negative : signs.positive;
      if (!textInfo) continue; // no supported variant for this sign

      if (!ladders.has(stat.id)) {
        ladders.set(stat.id, {
          statId: stat.id,
          matchText: textInfo.matchText,
          label: textInfo.label,
          rows: [],
          prefixCount: 0,
          suffixCount: 0,
          subtypes: new Set(),
        });
      }
      const [rawLow, rawHigh] = isNegative ? [-stat.max, -stat.min] : [stat.min, stat.max];
      const ladder = ladders.get(stat.id)!;
      ladder.rows.push({
        min: rawLow / textInfo.divisor,
        max: rawHigh / textInfo.divisor,
        requiredLevel: mod.required_level,
      });
      // A stat can (rarely) roll as both a prefix and a suffix — e.g.
      // "increased Rarity of Items found" has separate prefix and suffix
      // mod groups. Classify by whichever contributes more tiers; ties
      // go to prefix.
      if (mod.generation_type === "prefix") ladder.prefixCount++;
      else ladder.suffixCount++;

      // Which base-attribute-affinity subtypes does THIS specific mod
      // apply to? Re-runs the same priority-based eligibility check as
      // appliesToClass, but scoped to one subtype at a time (as if the
      // item only carried that one flavor's tags) — this is what lets the
      // Browse Mods panel filter down to "just my actual base" rather than
      // the union across every possible flavor. Only meaningful for
      // classes that have base variation at all (armour pieces); weapons/
      // jewellery have no baseSubtypes and stay unfiltered.
      for (const sub of itemClass.baseSubtypes || []) {
        const scopedTags = [itemClass.tags[0]!, ...sub.tags, "armour"];
        if (appliesToClass(mod, scopedTags)) ladder.subtypes.add(sub.label);
      }
    }

    const entries: TierTableEntry[] = [];
    for (const { statId, matchText, label, rows, prefixCount, suffixCount, subtypes } of ladders.values()) {
      // Tier 1 = highest value (best), matching in-game tier naming.
      rows.sort((a, b) => b.min - a.min);
      entries.push({
        statId,
        matchText,
        label,
        affixType: suffixCount > prefixCount ? "suffix" : "prefix",
        subtypes: itemClass.baseSubtypes ? [...subtypes] : null,
        tiers: rows.map((r, i) => ({ tier: i + 1, ...r })),
      });
    }

    table[itemClassKey] = entries;
  }

  return table;
}

async function refreshTierTable(): Promise<TierTable> {
  const [modsRes, translationsRes] = await Promise.all([fetch(MODS_URL), fetch(STAT_TRANSLATIONS_URL)]);
  if (!modsRes.ok) throw new Error(`RePoE mods fetch failed: ${modsRes.status}`);
  if (!translationsRes.ok) throw new Error(`RePoE stat_translations fetch failed: ${translationsRes.status}`);

  const [mods, statTranslations] = await Promise.all([
    modsRes.json() as Promise<Record<string, RePoEMod>>,
    translationsRes.json() as Promise<RePoEStatTranslationEntry[]>,
  ]);
  const tierTable = buildTierTable(mods, statTranslations);

  await browser.storage.local.set({
    [STORAGE_KEY]: tierTable,
    [`${STORAGE_KEY}_updatedAt`]: Date.now(),
  });
  console.log(
    "[PoE Trade Tiers] tier table refreshed",
    Object.fromEntries(Object.entries(tierTable).map(([k, v]) => [k, v.length]))
  );
  return tierTable;
}

async function getTierTable({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<TierTable> {
  const stored = await browser.storage.local.get([STORAGE_KEY, `${STORAGE_KEY}_updatedAt`]);
  const isStale =
    !stored[STORAGE_KEY] ||
    !stored[`${STORAGE_KEY}_updatedAt`] ||
    Date.now() - (stored[`${STORAGE_KEY}_updatedAt`] as number) > MAX_AGE_MS;

  if (forceRefresh || isStale) {
    try {
      return await refreshTierTable();
    } catch (err) {
      console.error("[PoE Trade Tiers] refresh failed, using stale/empty cache", err);
      return (stored[STORAGE_KEY] as TierTable) || {};
    }
  }
  return stored[STORAGE_KEY] as TierTable;
}

export function initTiersBackground(): void {
  browser.runtime.onInstalled.addListener(() => {
    refreshTierTable().catch((err) => console.error("[PoE Trade Tiers] initial fetch failed", err));
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const msg = message as GetTierTableMessage | undefined;
    if (msg?.type === "GET_TIER_TABLE") {
      return getTierTable({ forceRefresh: !!msg.forceRefresh });
    }
    return undefined;
  });
}
