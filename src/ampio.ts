import { Buffer } from "node:buffer";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.ts";
import { createTextResult } from "./lib/utils.ts";
import { logger } from "./logger.ts";

type AmpioConfig = Pick<Config, "AMPIO_URL" | "AMPIO_PORT" | "AMPIO_LOGIN" | "AMPIO_PASSWORD">;

export interface RawDevice {
  id: number;
  typ_komponentu: string;
  opis_menu: string;
  stan_json: string | null;
}

export interface RawGroup {
  id: number;
  id_rodzica: number;
  opis_menu: string;
}

export interface RawGroupDevice {
  id_grupy: number;
  id_obiektu: number;
}

let warnedMissingAmpioCredentials = false;

/**
 * Ampio HTTP API client ([Swagger basicAuth](http://developer.ampio.com.pl/)):
 * sends `Authorization: Basic base64(login:password)` on every request.
 */
export class Ampio {
  constructor(private readonly config: AmpioConfig) {
    if (!warnedMissingAmpioCredentials && !this.config.AMPIO_LOGIN) {
      warnedMissingAmpioCredentials = true;
      logger.warn(
        "AMPIO_LOGIN or AMPIO_USERNAME is empty; Ampio API may respond with 401 Unauthorized",
      );
    }
  }

  /** RFC 7617 HTTP Basic authentication (login + password, not Bearer). */
  #basicAuthHeader(): string {
    logger.info(
      {
        login: this.config.AMPIO_LOGIN,
        password: this.config.AMPIO_PASSWORD,
      },
      "Basic authentication header",
    );
    const token = Buffer.from(
      `${this.config.AMPIO_LOGIN}:${this.config.AMPIO_PASSWORD}`,
    ).toString("base64");
    return `Basic ${token}`;
  }

  /** Resolves base URL (supports `http(s)://host:port`, `host:port`, or `host` + AMPIO_PORT). */
  #baseUrl(): string {
    const raw = this.config.AMPIO_URL.trim();
    if (/^https?:\/\//i.test(raw)) {
      return raw.replace(/\/+$/, "");
    }
    if (/:[0-9]+$/.test(raw)) {
      return `http://${raw}`.replace(/\/+$/, "");
    }
    return `http://${raw}:${this.config.AMPIO_PORT}`.replace(/\/+$/, "");
  }

  async #get(path: string): Promise<unknown> {
    const url = `${this.#baseUrl()}/api/${path}`;
    const started = performance.now();

    let response: Response;

    logger.info(
      {
        url,
        auth: this.#basicAuthHeader()
      },
      "Sending request to Ampio API",
    );

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: 'Basic YWRtaW46diZlZjhEbDh2SlM4Y1U4RWpOaVRHJkE2ZDdOM0h2RCQ=', // this.#basicAuthHeader(),
          Accept: "application/json",
        },
      });
    } catch (error: unknown) {
      logger.error(
        {
          path,
          error: error instanceof Error ? error.message : String(error),
        },
        "Ampio API fetch failed",
      );
      throw error;
    }
    const text = await response.text();
    const durationMs = Math.round(performance.now() - started);
    if (!response.ok) {
      logger.warn(
        {
          path,
          status: response.status,
          durationMs,
          bodyPreview: text.slice(0, 200),
        },
        "Ampio API returned error status",
      );
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 800)}`);
    }
    logger.debug(
      { path, status: response.status, durationMs },
      "Ampio API request completed",
    );
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  #errorResult(error: unknown): CallToolResult {
    if (error instanceof Error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
    return {
      isError: true,
      content: [{ type: "text", text: "An unknown error occurred" }],
    };
  }

  async #wrap(fn: () => Promise<unknown>): Promise<CallToolResult> {
    try {
      return createTextResult(await fn());
    } catch (error: unknown) {
      return this.#errorResult(error);
    }
  }

  // --- Groups (JSON) — http://developer.ampio.com.pl/ ---

  jsonGroups(): Promise<CallToolResult> {
    return this.#wrap(() => this.#get("json/groups"));
  }

  jsonGroupDevices(): Promise<CallToolResult> {
    return this.#wrap(() => this.#get("json/group_devices"));
  }

  jsonGroupDevicesForGroup(id_group: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/group_devices/${encodeURIComponent(String(id_group))}`),
    );
  }

  // --- Devices (JSON) ---

  jsonDevices(): Promise<CallToolResult> {
    return this.#wrap(() => this.#get("json/devices"));
  }

  jsonDevicesByType(dev_type: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/devices/${encodeURIComponent(dev_type)}`),
    );
  }

  jsonDevsDetail(): Promise<CallToolResult> {
    return this.#wrap(() => this.#get("json/devs_detail"));
  }

  // --- State (JSON) ---

  jsonDeviceState(id_dev: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/device/${encodeURIComponent(String(id_dev))}/state`),
    );
  }

  jsonDeviceState2(id_dev: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/device/${encodeURIComponent(String(id_dev))}/state2`),
    );
  }

  jsonLogbook(args: {
    type: number;
    objectType: number;
    fromTime: number;
    toTime: number;
    objectId: number;
    requestSize: number;
    requestOffset: number;
  }): Promise<CallToolResult> {
    const {
      type,
      objectType,
      fromTime,
      toTime,
      objectId,
      requestSize,
      requestOffset,
    } = args;
    const path = [
      "json/logbook",
      type,
      objectType,
      fromTime,
      toTime,
      objectId,
      requestSize,
      requestOffset,
    ].join("/");
    return this.#wrap(() => this.#get(path));
  }

  jsonDeviceSignal(id_dev: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/device/${encodeURIComponent(String(id_dev))}/signal`),
    );
  }

  jsonDeviceGetsignal(id_dev: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`json/device/${encodeURIComponent(String(id_dev))}/getsignal`),
    );
  }

  // --- Control ---

  setDeviceSimple(id_dev: number, fn: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(
        `set/${encodeURIComponent(String(id_dev))}/${encodeURIComponent(fn)}`,
      ),
    );
  }

  setDeviceValue(id_dev: number, fn: string, value: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(
        `set/${encodeURIComponent(String(id_dev))}/${encodeURIComponent(fn)}/${encodeURIComponent(value)}`,
      ),
    );
  }

  /** Timed setValue (and setColorRF per API docs); path: /api/set/{id}/{function}/{value}/{time} */
  setDeviceValueTimed(
    id_dev: number,
    fn: string,
    value: string,
    time: number,
  ): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(
        `set/${encodeURIComponent(String(id_dev))}/${encodeURIComponent(fn)}/${encodeURIComponent(value)}/${encodeURIComponent(String(time))}`,
      ),
    );
  }

  callNotification(id_dev: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`callNotofication/${encodeURIComponent(String(id_dev))}`),
    );
  }

  pushNotification(message: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`pushNotification/${encodeURIComponent(message)}`),
    );
  }

  pushNotificationUser(message: string, user: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(
        `pushNotification/${encodeURIComponent(message)}/${encodeURIComponent(user)}`,
      ),
    );
  }

  setEvent(eventNum: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`setEvent/${encodeURIComponent(String(eventNum))}`),
    );
  }

  setLcdUp(text: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`set/setLcdUp/${encodeURIComponent(text)}`),
    );
  }

  setLcdDown(text: string): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`set/setLcdDown/${encodeURIComponent(text)}`),
    );
  }

  // --- Scenes (JSON + run) ---

  jsonScenes(): Promise<CallToolResult> {
    return this.#wrap(() => this.#get("json/scenes"));
  }

  runScene(scene_id: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`run/scene/${encodeURIComponent(String(scene_id))}`),
    );
  }

  undoScene(scene_id: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`undo/scene/${encodeURIComponent(String(scene_id))}`),
    );
  }

  offScene(scene_id: number): Promise<CallToolResult> {
    return this.#wrap(() =>
      this.#get(`off/scene/${encodeURIComponent(String(scene_id))}`),
    );
  }

  // --- Raw data for device map builder ---

  async fetchDevicesRaw(): Promise<RawDevice[]> {
    const result = (await this.#get("json/devices")) as { List: RawDevice[] };
    return result.List ?? [];
  }

  async fetchGroupsRaw(): Promise<RawGroup[]> {
    const result = (await this.#get("json/groups")) as { List: RawGroup[] };
    return result.List ?? [];
  }

  async fetchGroupDevicesRaw(): Promise<RawGroupDevice[]> {
    const result = (await this.#get("json/group_devices")) as { List: RawGroupDevice[] };
    return result.List ?? [];
  }
}
