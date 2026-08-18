// Shapes shared between tiersBackground.ts (builds these) and
// tiersContent.ts (consumes them via the GET_TIER_TABLE message).

export interface Tier {
  tier: number;
  min: number;
  max: number;
  requiredLevel: number;
}

export interface TierTableEntry {
  statId: string;
  matchText: string;
  label: string;
  affixType: "prefix" | "suffix";
  subtypes: string[] | null;
  tiers: Tier[];
}

// itemClassKey -> entries
export type TierTable = Record<string, TierTableEntry[]>;

export interface GetTierTableMessage {
  type: "GET_TIER_TABLE";
  forceRefresh?: boolean;
}
