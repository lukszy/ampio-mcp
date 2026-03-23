import { writeFile } from "node:fs/promises";
import type { Ampio, RawDevice, RawGroup } from "./ampio.ts";
import { logger } from "./logger.ts";

const TYPE_LABEL: Record<string, string> = {
  przekaznik: "relay",
  led: "LED",
  reg: "thermostat",
  temp: "temperature",
  roleta_procenty: "blind",
  flaga: "flag",
  lin_wej: "analog-in",
  wej: "input",
  custom: "custom",
  detekcja: "presence",
  symulacja: "simulation",
  rgb: "RGB",
};

function parseState(stanJson: string | null, typ: string): string {
  if (!stanJson) return "—";
  try {
    const s = JSON.parse(stanJson);
    const val = String(s.state ?? "").trim();
    switch (typ) {
      case "przekaznik":
      case "led":
        return val === "0" ? "OFF" : "ON";
      case "reg":
        return `${s.measureTemp}°C / set ${s.setTemperature}°C${s.state === "1" ? " [heating]" : ""}`;
      case "temp":
        return `${val}°C`;
      case "roleta_procenty":
        return `${val}%`;
      case "lin_wej":
        return val;
      default:
        return val;
    }
  } catch {
    return "?";
  }
}

function renderTable(devices: RawDevice[]): string {
  if (devices.length === 0) return "";
  const rows = devices.map((d) => {
    const label = TYPE_LABEL[d.typ_komponentu] ?? d.typ_komponentu;
    const state = parseState(d.stan_json, d.typ_komponentu);
    return `| ${d.id} | ${d.opis_menu} | ${label} | ${state} |`;
  });
  return ["| ID | Name | Type | State |", "|----|------|------|-------|", ...rows].join("\n");
}

export async function buildAndSaveDeviceMap(ampio: Ampio, outputPath: string): Promise<void> {
  const [devices, groups, groupDevices] = await Promise.all([
    ampio.fetchDevicesRaw(),
    ampio.fetchGroupsRaw(),
    ampio.fetchGroupDevicesRaw(),
  ]);

  const deviceById = new Map<number, RawDevice>(devices.map((d) => [d.id, d]));

  // Build group → device list
  const groupToDeviceIds = new Map<number, number[]>();
  for (const gd of groupDevices) {
    const list = groupToDeviceIds.get(gd.id_grupy) ?? [];
    list.push(gd.id_obiektu);
    groupToDeviceIds.set(gd.id_grupy, list);
  }
  const assignedIds = new Set(groupDevices.map((gd) => gd.id_obiektu));

  // Build group tree
  const childrenOf = new Map<number, RawGroup[]>();
  for (const g of groups) {
    const list = childrenOf.get(g.id_rodzica) ?? [];
    list.push(g);
    childrenOf.set(g.id_rodzica, list);
  }

  const lines: string[] = [
    "# Ampio Device Map",
    `> Generated: ${new Date().toISOString()}`,
    ">",
    "> Use device IDs when calling ampio_set_device_simple, ampio_set_device_value, etc.",
    "",
  ];

  function renderGroup(group: RawGroup, depth: number): void {
    const heading = "#".repeat(Math.min(depth + 2, 6));
    lines.push(`${heading} ${group.opis_menu} (group id: ${group.id})`);
    lines.push("");

    const ids = groupToDeviceIds.get(group.id) ?? [];
    const devs = ids.map((id) => deviceById.get(id)).filter((d): d is RawDevice => !!d);
    if (devs.length > 0) {
      lines.push(renderTable(devs));
      lines.push("");
    }

    for (const child of childrenOf.get(group.id) ?? []) {
      renderGroup(child, depth + 1);
    }
  }

  for (const topGroup of childrenOf.get(0) ?? []) {
    renderGroup(topGroup, 0);
  }

  const ungrouped = devices.filter(
    (d) => !assignedIds.has(d.id) && d.typ_komponentu !== "custom",
  );
  if (ungrouped.length > 0) {
    lines.push("## Ungrouped");
    lines.push("");
    lines.push(renderTable(ungrouped));
    lines.push("");
  }

  const markdown = lines.join("\n");
  await writeFile(outputPath, markdown, "utf-8");
  logger.info({ outputPath, devices: devices.length, groups: groups.length }, "Device map saved");
}
