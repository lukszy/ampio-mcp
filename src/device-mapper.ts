import type { Ampio, RawDevice, RawGroup } from "./ampio.ts";
import { logger } from "./logger.ts";

export interface DeviceMap {
  devices: Map<number, RawDevice>;
  groups: Map<number, RawGroup>;
  groupToDevices: Map<number, number[]>;
  updatedAt: Date;
}

export async function buildDeviceMap(ampio: Ampio): Promise<DeviceMap> {
  const [rawDevices, rawGroups, rawGroupDevices] = await Promise.all([
    ampio.fetchDevicesRaw(),
    ampio.fetchGroupsRaw(),
    ampio.fetchGroupDevicesRaw(),
  ]);

  const devices = new Map<number, RawDevice>(rawDevices.map((d) => [d.id, d]));
  const groups = new Map<number, RawGroup>(rawGroups.map((g) => [g.id, g]));

  const groupToDevices = new Map<number, number[]>();
  for (const gd of rawGroupDevices) {
    const list = groupToDevices.get(gd.id_grupy) ?? [];
    list.push(gd.id_obiektu);
    groupToDevices.set(gd.id_grupy, list);
  }

  logger.debug({ devices: devices.size, groups: groups.size }, "Device map refreshed");
  return { devices, groups, groupToDevices, updatedAt: new Date() };
}

export function renderDeviceMapMarkdown(map: DeviceMap): string {
  const { devices, groups, groupToDevices } = map;

  const assignedIds = new Set([...groupToDevices.values()].flat());

  const childrenOf = new Map<number, RawGroup[]>();
  for (const g of groups.values()) {
    const list = childrenOf.get(g.id_rodzica) ?? [];
    list.push(g);
    childrenOf.set(g.id_rodzica, list);
  }

  const lines: string[] = [
    "# Ampio Device Map",
    `> Updated: ${map.updatedAt.toISOString()}`,
    ">",
    "> Use device IDs when calling ampio_set_device_simple, ampio_set_device_value, etc.",
    "",
  ];

  function extractState(stanJson: string | null): string {
    if (!stanJson) return "—";
    try {
      const { on: _on, ...rest } = JSON.parse(stanJson);
      return Object.entries(rest)
        .map(([k, v]) => `${k}=${String(v).trim()}`)
        .join(", ");
    } catch {
      return stanJson.trim();
    }
  }

  function renderTable(ids: number[]): void {
    const devs = ids.map((id) => devices.get(id)).filter((d): d is RawDevice => !!d);
    if (devs.length === 0) return;
    lines.push("| ID | Name | Type | State |");
    lines.push("|----|------|------|-------|");
    for (const d of devs) {
      lines.push(`| ${d.id} | ${d.opis_menu} | ${d.typ_komponentu} | ${extractState(d.stan_json)} |`);
    }
    lines.push("");
  }

  function renderGroup(group: RawGroup, depth: number): void {
    lines.push(`${"#".repeat(Math.min(depth + 2, 6))} ${group.opis_menu} (group id: ${group.id})`);
    lines.push("");
    renderTable(groupToDevices.get(group.id) ?? []);
    for (const child of childrenOf.get(group.id) ?? []) {
      renderGroup(child, depth + 1);
    }
  }

  for (const topGroup of childrenOf.get(0) ?? []) {
    renderGroup(topGroup, 0);
  }

  const ungroupedIds = [...devices.keys()].filter((id) => !assignedIds.has(id));
  if (ungroupedIds.length > 0) {
    lines.push("## Ungrouped");
    lines.push("");
    renderTable(ungroupedIds);
  }

  return lines.join("\n");
}
