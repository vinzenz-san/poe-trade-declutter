import browser from "webextension-polyfill";
import type { Favorite } from "./types";

const STORAGE_KEY = "favorites";

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function getFavorites(): Promise<Favorite[]> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Favorite[] | undefined;
  return value ?? [];
}

async function writeFavorites(favorites: Favorite[]): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: favorites });
}

// New favorites are inserted at the front so the list defaults to
// most-recent-first; manual drag reordering (see favoritesSection.ts)
// then overwrites this order by rewriting the whole array.
export async function addFavorite(name: string, url: string): Promise<Favorite[]> {
  const favorites = await getFavorites();
  const now = Date.now();
  favorites.unshift({ id: makeId(), name, url, createdAt: now, updatedAt: now });
  await writeFavorites(favorites);
  return favorites;
}

export async function renameFavorite(id: string, name: string): Promise<Favorite[]> {
  const favorites = await getFavorites();
  const favorite = favorites.find((f) => f.id === id);
  if (favorite) {
    favorite.name = name;
    favorite.updatedAt = Date.now();
    await writeFavorites(favorites);
  }
  return favorites;
}

export async function overwriteFavoriteUrl(id: string, url: string): Promise<Favorite[]> {
  const favorites = await getFavorites();
  const favorite = favorites.find((f) => f.id === id);
  if (favorite) {
    favorite.url = url;
    favorite.updatedAt = Date.now();
    await writeFavorites(favorites);
  }
  return favorites;
}

export async function removeFavorite(id: string): Promise<Favorite[]> {
  const favorites = (await getFavorites()).filter((f) => f.id !== id);
  await writeFavorites(favorites);
  return favorites;
}

export async function reorderFavorites(orderedIds: string[]): Promise<Favorite[]> {
  const favorites = await getFavorites();
  const byId = new Map(favorites.map((f) => [f.id, f]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter((f): f is Favorite => f !== undefined);
  await writeFavorites(reordered);
  return reordered;
}
