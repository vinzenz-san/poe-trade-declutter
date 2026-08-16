import type { FieldSchemaGroup } from "./types";

const TRADE_FILTERS_KEY = "lscache-tradefilters";

export function readTradeFilterSchema(): FieldSchemaGroup[] | null {
  const raw = localStorage.getItem(TRADE_FILTERS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FieldSchemaGroup[];
  } catch {
    return null;
  }
}
