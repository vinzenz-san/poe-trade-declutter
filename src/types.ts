export type GroupId =
  | "status_filters"
  | "type_filters"
  | "weapon_filters"
  | "armour_filters"
  | "socket_filters"
  | "req_filters"
  | "map_filters"
  | "heist_filters"
  | "sanctum_filters"
  | "ultimatum_filters"
  | "misc_filters"
  | "trade_filters";

export interface TunerSettings {
  inactiveGroups: GroupId[];
  inactiveFields: Partial<Record<GroupId, string[]>>;
}

export interface FieldSchemaField {
  id: string;
  text?: string;
}

export interface FieldSchemaGroup {
  id: GroupId;
  title?: string;
  filters: FieldSchemaField[];
}
