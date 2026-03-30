import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Ampio } from "./ampio.ts";

const BASE_CONFIG = {
  AMPIO_URL: "192.168.1.100",
  AMPIO_PORT: 8060,
  AMPIO_LOGIN: "admin",
  AMPIO_PASSWORD: "secret",
};

function makeAmpio(overrides: Partial<typeof BASE_CONFIG> = {}) {
  return new Ampio({ ...BASE_CONFIG, ...overrides });
}

function mockFetch(body: unknown, status = 200) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- URL construction ---

describe("URL construction", () => {
  it("builds URL from bare IP + AMPIO_PORT", async () => {
    const spy = mockFetch({ List: [] });
    await makeAmpio({ AMPIO_URL: "192.168.1.100", AMPIO_PORT: 8060 }).jsonGroups();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("http://192.168.1.100:8060/api/json/groups"),
      expect.anything(),
    );
  });

  it("uses port embedded in AMPIO_URL when present", async () => {
    const spy = mockFetch({ List: [] });
    await makeAmpio({ AMPIO_URL: "192.168.1.50:9090" }).jsonGroups();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("http://192.168.1.50:9090/api/json/groups"),
      expect.anything(),
    );
  });

  it("uses full https URL as-is", async () => {
    const spy = mockFetch({ List: [] });
    await makeAmpio({ AMPIO_URL: "https://ampio.local" }).jsonGroups();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("https://ampio.local/api/json/groups"),
      expect.anything(),
    );
  });

  it("strips trailing slash from AMPIO_URL", async () => {
    const spy = mockFetch({ List: [] });
    await makeAmpio({ AMPIO_URL: "http://192.168.1.100/" }).jsonGroups();
    const url = spy.mock.calls[0][0] as string;
    // path should not contain double slash (protocol :// is fine)
    expect(url.replace("http://", "")).not.toContain("//");
  });
});

// --- Auth header ---

describe("auth header", () => {
  it("sends Authorization: Basic header", async () => {
    const spy = mockFetch({});
    await makeAmpio().jsonDevices();
    const init = spy.mock.calls[0][1] as RequestInit;
    const auth = (init.headers as Record<string, string>)["Authorization"];
    expect(auth).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
  });
});

// --- Successful responses ---

describe("successful responses", () => {
  it("jsonGroups returns parsed JSON as text content", async () => {
    mockFetch({ List: [{ id: 1, id_rodzica: 0, opis_menu: "Living room" }] });
    const result = await makeAmpio().jsonGroups();
    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Living room");
  });

  it("jsonDeviceState2 calls correct path", async () => {
    const spy = mockFetch({ state: "on" });
    await makeAmpio().jsonDeviceState2(42);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/json/device/42/state2"),
      expect.anything(),
    );
  });

  it("setDeviceSimple calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().setDeviceSimple(7, "turnOn");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/set/7/turnOn"),
      expect.anything(),
    );
  });

  it("setDeviceValue calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().setDeviceValue(7, "setValue", "128");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/set/7/setValue/128"),
      expect.anything(),
    );
  });

  it("setDeviceValueTimed calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().setDeviceValueTimed(7, "setValue", "255", 100);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/set/7/setValue/255/100"),
      expect.anything(),
    );
  });

  it("runScene calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().runScene(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/run/scene/3"),
      expect.anything(),
    );
  });

  it("undoScene calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().undoScene(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/undo/scene/3"),
      expect.anything(),
    );
  });

  it("offScene calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().offScene(3);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/off/scene/3"),
      expect.anything(),
    );
  });

  it("pushNotification URL-encodes message", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().pushNotification("hello world");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/pushNotification/hello%20world"),
      expect.anything(),
    );
  });

  it("pushNotificationUser calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().pushNotificationUser("hi", "alice");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/pushNotification/hi/alice"),
      expect.anything(),
    );
  });

  it("setEvent calls correct path", async () => {
    const spy = mockFetch("OK");
    await makeAmpio().setEvent(5);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/setEvent/5"),
      expect.anything(),
    );
  });

  it("jsonLogbook assembles all path segments", async () => {
    const spy = mockFetch({ List: [] });
    await makeAmpio().jsonLogbook({ type: 6, objectType: 0, fromTime: 1000, toTime: 2000, objectId: 0, requestSize: 50, requestOffset: 0 });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("/api/json/logbook/6/0/1000/2000/0/50/0"),
      expect.anything(),
    );
  });
});

// --- Error handling ---

describe("error handling", () => {
  it("returns isError result on non-ok HTTP response", async () => {
    mockFetch("Unauthorized", 401);
    const result = await makeAmpio().jsonGroups();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("401");
  });

  it("returns isError result on network failure", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await makeAmpio().jsonGroups();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network error");
  });

  it("returns isError with fallback message for non-Error throws", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue("string error");
    const result = await makeAmpio().jsonGroups();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unknown error occurred");
  });

  it("returns plain text when response body is not JSON", async () => {
    mockFetch("plain text response");
    const result = await makeAmpio().jsonGroups();
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("plain text response");
  });
});

// --- Raw fetch methods ---

describe("raw fetch methods", () => {
  it("fetchDevicesRaw returns List array", async () => {
    const devices = [{ id: 1, typ_komponentu: "led", opis_menu: "Lamp", stan_json: null }];
    mockFetch({ List: devices });
    const result = await makeAmpio().fetchDevicesRaw();
    expect(result).toEqual(devices);
  });

  it("fetchDevicesRaw returns empty array when List missing", async () => {
    mockFetch({});
    const result = await makeAmpio().fetchDevicesRaw();
    expect(result).toEqual([]);
  });

  it("fetchGroupsRaw returns List array", async () => {
    const groups = [{ id: 1, id_rodzica: 0, opis_menu: "Floor 1" }];
    mockFetch({ List: groups });
    const result = await makeAmpio().fetchGroupsRaw();
    expect(result).toEqual(groups);
  });

  it("fetchGroupDevicesRaw returns List array", async () => {
    const gd = [{ id_grupy: 1, id_obiektu: 10 }];
    mockFetch({ List: gd });
    const result = await makeAmpio().fetchGroupDevicesRaw();
    expect(result).toEqual(gd);
  });
});
