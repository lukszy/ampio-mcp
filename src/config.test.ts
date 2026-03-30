import { describe, it, expect, vi, beforeEach } from "vitest";

// Sensible defaults so Zod enum fields never see an empty string
const VALID_BASE: Record<string, string> = {
  NODE_ENV: "test",
  LOG_LEVEL: "info",
};

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  const merged = { ...VALID_BASE, ...env };
  for (const [k, v] of Object.entries(merged)) {
    vi.stubEnv(k, v);
  }
  const mod = await import("./config.ts");
  return mod;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getConfig", () => {
  it("returns defaults when no env vars set", async () => {
    const { getConfig } = await loadConfig({ NODE_ENV: "development" });
    const config = getConfig();
    expect(config.PORT).toBe(3000);
    expect(config.AMPIO_URL).toBe("192.168.1.100");
    expect(config.AMPIO_PORT).toBe(8060);
    expect(config.NODE_ENV).toBe("development");
    expect(config.LOG_LEVEL).toBe("info");
    expect(config.SERVER_NAME).toBe("ampio-smart-home");
  });

  it("reads PORT from env", async () => {
    const { getConfig } = await loadConfig({ PORT: "4000" });
    expect(getConfig().PORT).toBe(4000);
  });

  it("reads AMPIO_URL and AMPIO_PORT from env", async () => {
    const { getConfig } = await loadConfig({ AMPIO_URL: "10.0.0.1", AMPIO_PORT: "9000" });
    const config = getConfig();
    expect(config.AMPIO_URL).toBe("10.0.0.1");
    expect(config.AMPIO_PORT).toBe(9000);
  });

  it("uses AMPIO_LOGIN when set", async () => {
    const { getConfig } = await loadConfig({ AMPIO_LOGIN: "myuser", AMPIO_PASSWORD: "mypass" });
    const config = getConfig();
    expect(config.AMPIO_LOGIN).toBe("myuser");
    expect(config.AMPIO_PASSWORD).toBe("mypass");
  });

  it("falls back to AMPIO_USERNAME when AMPIO_LOGIN is empty", async () => {
    const { getConfig } = await loadConfig({ AMPIO_USERNAME: "fallback" });
    expect(getConfig().AMPIO_LOGIN).toBe("fallback");
  });

  it("prefers AMPIO_LOGIN over AMPIO_USERNAME when both set", async () => {
    const { getConfig } = await loadConfig({ AMPIO_LOGIN: "login", AMPIO_USERNAME: "username" });
    expect(getConfig().AMPIO_LOGIN).toBe("login");
  });

  it("caches config on subsequent calls", async () => {
    const { getConfig } = await loadConfig({ PORT: "5000" });
    const a = getConfig();
    const b = getConfig();
    expect(a).toBe(b);
  });
});

describe("isProduction / isDevelopment", () => {
  it("isProduction returns true when NODE_ENV=production", async () => {
    const { isProduction, isDevelopment } = await loadConfig({ NODE_ENV: "production" });
    expect(isProduction()).toBe(true);
    expect(isDevelopment()).toBe(false);
  });

  it("isDevelopment returns true when NODE_ENV=development", async () => {
    const { isProduction, isDevelopment } = await loadConfig({ NODE_ENV: "development" });
    expect(isDevelopment()).toBe(true);
    expect(isProduction()).toBe(false);
  });

  it("both return false when NODE_ENV=test", async () => {
    const { isProduction, isDevelopment } = await loadConfig({ NODE_ENV: "test" });
    expect(isProduction()).toBe(false);
    expect(isDevelopment()).toBe(false);
  });
});
