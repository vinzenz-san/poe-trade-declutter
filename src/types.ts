// Used to be a closed union mirroring trade's own internal group ids, sourced
// from its filter-schema cache at runtime. That cache no longer exists (see
// slugify() in labelUtils.ts), so ids are now derived directly from each
// group's visible label text instead — any string, not a fixed enum.
export type GroupId = string;

export interface TunerSettings {
  inactiveGroups: GroupId[];
  inactiveFields: Partial<Record<GroupId, string[]>>;
}

export interface Favorite {
  id: string;
  name: string;
  url: string;
  createdAt: number;
  updatedAt: number;
}
