import { describe, it, expect, vi } from "vitest";
import { buildDeviceMap, renderDeviceMapMarkdown } from "./device-mapper.ts";
import type { DeviceMap } from "./device-mapper.ts";
import type { RawDevice, RawGroup } from "./ampio.ts";

// --- helpers ---

function makeMap(
  devices: RawDevice[],
  groups: RawGroup[],
  groupDevices: Array<{ id_grupy: number; id_obiektu: number }>,
): DeviceMap {
  const deviceMap = new Map(devices.map((d) => [d.id, d]));
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const groupToDevices = new Map<number, number[]>();
  for (const gd of groupDevices) {
    const list = groupToDevices.get(gd.id_grupy) ?? [];
    list.push(gd.id_obiektu);
    groupToDevices.set(gd.id_grupy, list);
  }
  return { devices: deviceMap, groups: groupMap, groupToDevices, updatedAt: new Date("2024-01-01T00:00:00Z") };
}

// --- renderDeviceMapMarkdown ---

describe("renderDeviceMapMarkdown", () => {
  it("renders the header and updated timestamp", () => {
    const map = makeMap([], [], []);
    const md = renderDeviceMapMarkdown(map);
    expect(md).toContain("# Ampio Device Map");
    expect(md).toContain("2024-01-01T00:00:00.000Z");
  });

  it("renders a group with devices in a table", () => {
    const devices: RawDevice[] = [
      { id: 10, typ_komponentu: "led", opis_menu: "Ceiling lamp", stan_json: '{"on":true,"brightness":80}' },
    ];
    const groups: RawGroup[] = [{ id: 1, id_rodzica: 0, opis_menu: "Living room" }];
    const md = renderDeviceMapMarkdown(makeMap(devices, groups, [{ id_grupy: 1, id_obiektu: 10 }]));

    expect(md).toContain("Living room");
    expect(md).toContain("group id: 1");
    expect(md).toContain("| 10 |");
    expect(md).toContain("Ceiling lamp");
    expect(md).toContain("led");
    expect(md).toContain("brightness=80");
    // 'on' field should be stripped from state
    expect(md).not.toContain("on=true");
  });

  it("renders nested groups with increasing heading depth", () => {
    const groups: RawGroup[] = [
      { id: 1, id_rodzica: 0, opis_menu: "Floor 1" },
      { id: 2, id_rodzica: 1, opis_menu: "Bedroom" },
    ];
    const md = renderDeviceMapMarkdown(makeMap([], groups, []));
    expect(md).toContain("## Floor 1");
    expect(md).toContain("### Bedroom");
  });

  it("renders ungrouped devices in their own section", () => {
    const devices: RawDevice[] = [
      { id: 99, typ_komponentu: "flaga", opis_menu: "Orphan device", stan_json: null },
    ];
    const md = renderDeviceMapMarkdown(makeMap(devices, [], []));
    expect(md).toContain("## Ungrouped");
    expect(md).toContain("Orphan device");
  });

  it("shows — for null stan_json", () => {
    const devices: RawDevice[] = [
      { id: 5, typ_komponentu: "reg", opis_menu: "Thermostat", stan_json: null },
    ];
    const groups: RawGroup[] = [{ id: 1, id_rodzica: 0, opis_menu: "Room" }];
    const md = renderDeviceMapMarkdown(makeMap(devices, groups, [{ id_grupy: 1, id_obiektu: 5 }]));
    expect(md).toContain("| — |");
  });

  it("falls back to raw string when stan_json is not valid JSON", () => {
    const devices: RawDevice[] = [
      { id: 5, typ_komponentu: "reg", opis_menu: "Thermostat", stan_json: "raw-value" },
    ];
    const groups: RawGroup[] = [{ id: 1, id_rodzica: 0, opis_menu: "Room" }];
    const md = renderDeviceMapMarkdown(makeMap(devices, groups, [{ id_grupy: 1, id_obiektu: 5 }]));
    expect(md).toContain("raw-value");
  });

  it("skips table when a group has no matching devices", () => {
    const groups: RawGroup[] = [{ id: 1, id_rodzica: 0, opis_menu: "Empty room" }];
    const md = renderDeviceMapMarkdown(makeMap([], groups, []));
    expect(md).toContain("Empty room");
    expect(md).not.toContain("| ID |");
  });

  it("caps heading depth at h6 for deeply nested groups", () => {
    const groups: RawGroup[] = [
      { id: 1, id_rodzica: 0, opis_menu: "L1" },
      { id: 2, id_rodzica: 1, opis_menu: "L2" },
      { id: 3, id_rodzica: 2, opis_menu: "L3" },
      { id: 4, id_rodzica: 3, opis_menu: "L4" },
      { id: 5, id_rodzica: 4, opis_menu: "L5" },
      { id: 6, id_rodzica: 5, opis_menu: "L6" },
    ];
    const md = renderDeviceMapMarkdown(makeMap([], groups, []));
    expect(md).not.toMatch(/^#{7,} /m);
  });

  it("renders multiple top-level groups", () => {
    const groups: RawGroup[] = [
      { id: 1, id_rodzica: 0, opis_menu: "Ground floor" },
      { id: 2, id_rodzica: 0, opis_menu: "First floor" },
    ];
    const md = renderDeviceMapMarkdown(makeMap([], groups, []));
    expect(md).toContain("Ground floor");
    expect(md).toContain("First floor");
  });
});

// --- buildDeviceMap ---

describe("buildDeviceMap", () => {
  it("builds maps from raw API data", async () => {
    const mockAmpio = {
      fetchDevicesRaw: vi.fn().mockResolvedValue([
        { id: 1, typ_komponentu: "led", opis_menu: "Lamp", stan_json: null },
      ]),
      fetchGroupsRaw: vi.fn().mockResolvedValue([
        { id: 10, id_rodzica: 0, opis_menu: "Hallway" },
      ]),
      fetchGroupDevicesRaw: vi.fn().mockResolvedValue([
        { id_grupy: 10, id_obiektu: 1 },
      ]),
    };

    const map = await buildDeviceMap(mockAmpio as never);

    expect(map.devices.size).toBe(1);
    expect(map.devices.get(1)?.opis_menu).toBe("Lamp");
    expect(map.groups.size).toBe(1);
    expect(map.groupToDevices.get(10)).toEqual([1]);
    expect(map.updatedAt).toBeInstanceOf(Date);
  });

  it("handles multiple devices in the same group", async () => {
    const mockAmpio = {
      fetchDevicesRaw: vi.fn().mockResolvedValue([
        { id: 1, typ_komponentu: "led", opis_menu: "Lamp A", stan_json: null },
        { id: 2, typ_komponentu: "led", opis_menu: "Lamp B", stan_json: null },
      ]),
      fetchGroupsRaw: vi.fn().mockResolvedValue([{ id: 5, id_rodzica: 0, opis_menu: "Room" }]),
      fetchGroupDevicesRaw: vi.fn().mockResolvedValue([
        { id_grupy: 5, id_obiektu: 1 },
        { id_grupy: 5, id_obiektu: 2 },
      ]),
    };

    const map = await buildDeviceMap(mockAmpio as never);
    expect(map.groupToDevices.get(5)).toEqual([1, 2]);
  });

  it("sets updatedAt to a recent date", async () => {
    const before = new Date();
    const mockAmpio = {
      fetchDevicesRaw: vi.fn().mockResolvedValue([]),
      fetchGroupsRaw: vi.fn().mockResolvedValue([]),
      fetchGroupDevicesRaw: vi.fn().mockResolvedValue([]),
    };
    const map = await buildDeviceMap(mockAmpio as never);
    const after = new Date();
    expect(map.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(map.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
