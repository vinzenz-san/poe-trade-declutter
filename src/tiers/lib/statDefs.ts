// Shared config between tiersBackground.ts (builds the tier table from
// RePoE data) and tiersContent.ts (matches trade-site stat rows against
// it).
//
// Which specific stats exist per item class is no longer hand-curated here
// — tiersBackground.ts discovers the full "regular, chaos-obtainable" mod
// pool per class directly from RePoE (domain === "item", prefix/suffix
// only, not essence-only/influence/Crucible/Royale, single-stat) and gets
// the matching display text from RePoE's stat_translations.json instead of
// a hand-typed guess. This file only keeps what both scripts still need:
// which RePoE tags identify each item class, and the shared text-matching
// helpers.

export interface BaseSubtype {
  label: string;
  tags: string[];
}

export interface ItemClassDef {
  label: string;
  tags: string[];
  baseSubtypes?: BaseSubtype[];
}

// Armour pieces come in several base-attribute-affinity subtypes (a "Boots"
// search doesn't tell us which), and each subtype's own tag gates its own
// slice of the mod pool (e.g. flat Energy Shield only rolls on int-affinity
// bases). Rather than only show the lowest-common-denominator mods (as
// earlier versions did for mana/attributes), list every subtype tag so the
// full pool that's possible on *some* boots base shows up — the user picks
// what applies to their actual base. Tag sets pulled from RePoE's
// base_items.json per item class, not guessed.
const ARMOUR_SUBTYPE_TAGS = [
  "str_armour",
  "dex_armour",
  "int_armour",
  "str_dex_armour",
  "str_int_armour",
  "dex_int_armour",
];
// Ward-base boots/gloves/helmet are a separate tag from the six standard
// attribute-affinity ones (confirmed via base_items.json — body armour and
// shields don't have a ward_armour variant at all, only these three do).
const BOOTS_GLOVES_HELMET_SUBTYPE_TAGS = [...ARMOUR_SUBTYPE_TAGS, "ward_armour"];
const BODY_ARMOUR_SUBTYPE_TAGS = [...ARMOUR_SUBTYPE_TAGS, "str_dex_int_armour"];
const SHIELD_SUBTYPE_TAGS = [
  ...ARMOUR_SUBTYPE_TAGS,
  "str_shield",
  "dex_shield",
  "int_shield",
  "str_dex_shield",
  "str_int_shield",
  "dex_int_shield",
];

// Buttons for the Browse Mods panel's base-type filter — lets the user
// narrow the shown mods to just their actual base's attribute affinity,
// since a plain "Boots" category search doesn't disclose it. `tags` is a
// list (not a single tag) because shields carry two parallel tag families
// for the same affinity (e.g. both "str_armour" and "str_shield") — either
// counting is what "STR" should mean for a shield.
const STANDARD_BASE_SUBTYPES: BaseSubtype[] = [
  { label: "STR", tags: ["str_armour"] },
  { label: "DEX", tags: ["dex_armour"] },
  { label: "INT", tags: ["int_armour"] },
  { label: "STR/DEX", tags: ["str_dex_armour"] },
  { label: "STR/INT", tags: ["str_int_armour"] },
  { label: "DEX/INT", tags: ["dex_int_armour"] },
];
const BOOTS_GLOVES_HELMET_BASE_SUBTYPES: BaseSubtype[] = [
  ...STANDARD_BASE_SUBTYPES,
  { label: "Ward", tags: ["ward_armour"] },
];
const BODY_ARMOUR_BASE_SUBTYPES: BaseSubtype[] = [
  ...STANDARD_BASE_SUBTYPES,
  { label: "STR/DEX/INT", tags: ["str_dex_int_armour"] },
];
const SHIELD_BASE_SUBTYPES: BaseSubtype[] = [
  { label: "STR", tags: ["str_armour", "str_shield"] },
  { label: "DEX", tags: ["dex_armour", "dex_shield"] },
  { label: "INT", tags: ["int_armour", "int_shield"] },
  { label: "STR/DEX", tags: ["str_dex_armour", "str_dex_shield"] },
  { label: "STR/INT", tags: ["str_int_armour", "str_int_shield"] },
  { label: "DEX/INT", tags: ["dex_int_armour", "dex_int_shield"] },
];

export const ITEM_CLASSES: Record<string, ItemClassDef> = {
  boots: {
    label: "Boots",
    tags: ["boots", "armour", ...BOOTS_GLOVES_HELMET_SUBTYPE_TAGS],
    baseSubtypes: BOOTS_GLOVES_HELMET_BASE_SUBTYPES,
  },
  gloves: {
    label: "Gloves",
    tags: ["gloves", "armour", ...BOOTS_GLOVES_HELMET_SUBTYPE_TAGS],
    baseSubtypes: BOOTS_GLOVES_HELMET_BASE_SUBTYPES,
  },
  helmet: {
    label: "Helmet",
    tags: ["helmet", "armour", ...BOOTS_GLOVES_HELMET_SUBTYPE_TAGS],
    baseSubtypes: BOOTS_GLOVES_HELMET_BASE_SUBTYPES,
  },
  body_armour: {
    label: "Body Armour",
    tags: ["body_armour", "armour", ...BODY_ARMOUR_SUBTYPE_TAGS],
    baseSubtypes: BODY_ARMOUR_BASE_SUBTYPES,
  },
  shield: {
    label: "Shield",
    tags: ["shield", "armour", ...SHIELD_SUBTYPE_TAGS],
    baseSubtypes: SHIELD_BASE_SUBTYPES,
  },
  amulet: { label: "Amulet", tags: ["amulet"] },
  ring: { label: "Ring", tags: ["ring"] },
  belt: { label: "Belt", tags: ["belt"] },

  // Weapon tag sets pulled from RePoE's base_items.json (not guessed) — a
  // single weapon carries multiple of these simultaneously (e.g. a One Hand
  // Sword is "sword" + "one_hand_weapon" + "weapon" all at once), so
  // eligibility must check all of them, not just the first match. See
  // appliesToClass in tiersBackground.ts.
  one_hand_sword: { label: "One Hand Sword", tags: ["sword", "one_hand_weapon", "weapon"] },
  two_hand_sword: { label: "Two Hand Sword", tags: ["sword", "two_hand_weapon", "weapon"] },
  thrusting_one_hand_sword: {
    label: "Thrusting One Hand Sword",
    tags: ["sword", "rapier", "one_hand_weapon", "weapon"],
  },
  one_hand_axe: { label: "One Hand Axe", tags: ["axe", "one_hand_weapon", "weapon"] },
  two_hand_axe: { label: "Two Hand Axe", tags: ["axe", "two_hand_weapon", "weapon"] },
  one_hand_mace: { label: "One Hand Mace", tags: ["mace", "one_hand_weapon", "weapon"] },
  two_hand_mace: { label: "Two Hand Mace", tags: ["mace", "two_hand_weapon", "weapon"] },
  bow: { label: "Bow", tags: ["bow", "two_hand_weapon", "weapon", "ranged"] },
  claw: { label: "Claw", tags: ["claw", "one_hand_weapon", "weapon"] },
  dagger: { label: "Dagger", tags: ["dagger", "one_hand_weapon", "weapon"] },
  rune_dagger: { label: "Rune Dagger", tags: ["dagger", "one_hand_weapon", "weapon"] },
  sceptre: { label: "Sceptre", tags: ["sceptre", "one_hand_weapon", "weapon"] },
  staff: { label: "Staff", tags: ["staff", "two_hand_weapon", "weapon"] },
  warstaff: {
    label: "Warstaff",
    tags: ["warstaff", "staff", "attack_staff", "two_hand_weapon", "weapon"],
  },
  wand: { label: "Wand", tags: ["wand", "one_hand_weapon", "weapon", "ranged"] },

  quiver: { label: "Quiver", tags: ["quiver"] },
};

// Mod keys matching this get excluded from the "plain" tier ladder: they're
// influence-exclusive, Crucible-only, essence-only, or Royale-only variants
// that don't belong to the regular prefix/suffix tier progression players
// mean when they say "min tier 2".
export const EXCLUDE_MOD_KEY_RE =
  /(Royale|Enhanced|Influence|Maven|Elevated|Conquest|Puhuarte|Crucible)/;

// Trade sometimes lists two similarly-worded autocomplete rows for the
// same underlying stat — a plain one and one suffixed "(Local)" — and
// which one is actually "the" filter varies per stat with no way to infer
// it automatically: confirmed live that Armour wants "(Local)", while
// Attack Speed wants the plain row instead (even though both are backed by
// a `local_`-prefixed RePoE id). Default is plain; only override here once
// confirmed live per stat.
//
// The whole "local defence value" family (flat Armour/Evasion/Energy
// Shield and their %increased/combo variants) has turned out to
// consistently need "(Local)" — confirmed for flat Armour and for the %
// Armour+Energy Shield combo; the rest of this family is the same
// underlying stat category so added on that basis, but individually
// UNVERIFIED — flag any that turn out wrong.
export const PREFER_LOCAL_STAT_IDS = new Set([
  "local_base_physical_damage_reduction_rating", // Armour (flat) — confirmed live
  "local_base_evasion_rating", // Evasion (flat) — unverified
  "local_energy_shield", // Energy Shield (flat) — unverified
  "local_physical_damage_reduction_rating_+%", // increased Armour — unverified
  "local_evasion_rating_+%", // increased Evasion Rating — unverified
  "local_energy_shield_+%", // increased Energy Shield — unverified
  "local_armour_and_energy_shield_+%", // increased Armour and Energy Shield — confirmed live
  "local_armour_and_evasion_+%", // increased Armour and Evasion — unverified
  "local_evasion_and_energy_shield_+%", // increased Evasion and Energy Shield — unverified
]);

// Shared between tiersBackground.ts (building match text from RePoE's
// stat_translations templates) and tiersContent.ts (normalizing the trade
// page's actual row text) — must stay identical or matching silently
// breaks. Strips template placeholders ({0}), numbers, and punctuation so
// only the wording is compared.
export function normalizeStatText(text: string | null | undefined): string {
  return (text || "")
    .toLowerCase()
    .replace(/\{\d+\}/g, " ")
    .replace(/[+#%()\-–]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Row titles on the trade site come prefixed with the mod source, e.g.
// "explicit +# to maximum Life" — strip that before comparing against
// RePoE-derived text, which never has it.
export const MOD_SOURCE_PREFIX_RE =
  /^(explicit|implicit|pseudo|crafted|enchant|fractured|scourge|veiled)\s+/;
