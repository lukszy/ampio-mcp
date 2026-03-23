import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Ampio } from "./ampio.ts";

const simpleFn = z.enum([
  "turnOn",
  "turnOff",
  "open",
  "close",
  "stop",
  "switch",
]);

export function registerAmpioMcpTools(server: McpServer, ampio: Ampio): void {
  server.registerTool(
    "ampio_json_groups",
    {
      title: "Ampio: list groups (JSON)",
      description:
        "GET /api/json/groups — List Ampio smart home groups (Ampio API).",
      inputSchema: z.object({}),
    },
    async () => ampio.jsonGroups(),
  );

  server.registerTool(
    "ampio_json_group_devices",
    {
      title: "Ampio: group devices (JSON)",
      description:
        "GET /api/json/group_devices — List device IDs per group.",
      inputSchema: z.object({}),
    },
    async () => ampio.jsonGroupDevices(),
  );

  server.registerTool(
    "ampio_json_group_devices_for_group",
    {
      title: "Ampio: devices for group (JSON)",
      description:
        "GET /api/json/group_devices/{id_group} — Devices for a specific group id.",
      inputSchema: {
        id_group: z
          .number()
          .int()
          .describe("Group id"),
      },
    },
    async (args) => ampio.jsonGroupDevicesForGroup(args.id_group),
  );

  server.registerTool(
    "ampio_json_devices",
    {
      title: "Ampio: list devices (JSON)",
      description:
        "GET /api/json/devices — List all devices (Ampio API).",
      inputSchema: z.object({}),
    },
    async () => ampio.jsonDevices(),
  );

  server.registerTool(
    "ampio_json_devices_by_type",
    {
      title: "Ampio: list devices by type (JSON)",
      description:
        "GET /api/json/devices/{dev_type} — e.g. led, rgb, wej, temp, reg, przekaznik, roleta, flaga, satel_wej, satel_alarm, moc_ciagla.",
      inputSchema: {
        dev_type: z
          .string()
          .describe("Device type filter"),
      },
    },
    async (args) => ampio.jsonDevicesByType(args.dev_type),
  );

  server.registerTool(
    "ampio_json_devs_detail",
    {
      title: "Ampio: devices detail (JSON)",
      description:
        "GET /api/json/devs_detail — Devices with details.",
      inputSchema: z.object({}),
    },
    async () => ampio.jsonDevsDetail(),
  );

  server.registerTool(
    "ampio_json_device_state",
    {
      title: "Ampio: device state (legacy JSON)",
      description:
        "GET /api/json/device/{id_dev}/state — older state format; prefer ampio_json_device_state2 for new apps.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
      },
    },
    async (args) => ampio.jsonDeviceState(args.id_dev),
  );

  server.registerTool(
    "ampio_json_device_state2",
    {
      title: "Ampio: device state (JSON)",
      description:
        "GET /api/json/device/{id_dev}/state2 — current state for device id.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
      },
    },
    async (args) => ampio.jsonDeviceState2(args.id_dev),
  );

  server.registerTool(
    "ampio_json_logbook",
    {
      title: "Ampio: logbook (JSON)",
      description:
        "GET /api/json/logbook/{type}/{objectType}/{fromTime}/{toTime}/{objectId}/{requestSize}/{requestOffset} — type: 0= today, 1=24h, 2=7d, 3=month, 4=3 months, 5=year, 6=custom epoch range. objectType: 0=all, 43=events.",
      inputSchema: {
        type: z
          .number()
          .int()
          .describe("Logbook range type (0–6)"),
        objectType: z
          .number()
          .int()
          .describe("Object type (0=all, 43=events)"),
        fromTime: z
          .number()
          .int()
          .describe("Start epoch (for type 6)"),
        toTime: z
          .number()
          .int()
          .describe("End epoch (for type 6)"),
        objectId: z.number().int().describe("Object id filter"),
        requestSize: z.number().int().describe("Page size"),
        requestOffset: z.number().int().describe("Offset"),
      },
    },
    async (args) => ampio.jsonLogbook(args),
  );

  server.registerTool(
    "ampio_json_device_signal",
    {
      title: "Ampio: RF device signal (JSON)",
      description:
        "GET /api/json/device/{id_dev}/signal — RF signal for device.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
      },
    },
    async (args) => ampio.jsonDeviceSignal(args.id_dev),
  );

  server.registerTool(
    "ampio_json_device_getsignal",
    {
      title: "Ampio: RF device getsignal (JSON)",
      description:
        "GET /api/json/device/{id_dev}/getsignal — then poll signal for value.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
      },
    },
    async (args) => ampio.jsonDeviceGetsignal(args.id_dev),
  );

  server.registerTool(
    "ampio_set_device_simple",
    {
      title: "Ampio: control device (simple)",
      description:
        "GET /api/set/{id_dev}/{function} — turnOn, turnOff, open, close, stop, switch.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
        function: simpleFn.describe("Control function"),
      },
    },
    async (args) => ampio.setDeviceSimple(args.id_dev, args.function),
  );

  server.registerTool(
    "ampio_set_device_value",
    {
      title: "Ampio: control device (with value)",
      description:
        "GET /api/set/{id_dev}/{function}/{value} — setValue, setColor, setColorW, setRollerPos, setVolume, setInput, setSeek, setText, setHeatingMode, setTemperature, arm, disarm, setColors, etc. (see Ampio API docs).",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
        function: z
          .string()
          .describe(
            "Function name (e.g. setValue, setColor, setTemperature, arm, disarm)",
          ),
        value: z
          .string()
          .describe("Primary value (string for path; use numeric strings as needed)"),
      },
    },
    async (args) =>
      ampio.setDeviceValue(args.id_dev, args.function, args.value),
  );

  server.registerTool(
    "ampio_set_device_value_timed",
    {
      title: "Ampio: set value with duration",
      description:
        "GET /api/set/{id_dev}/{function}/{value}/{time} — setValue with duration (time x 10ms units per API); setColorRF also.",
      inputSchema: {
        id_dev: z.number().int().describe("Device id"),
        function: z
          .string()
          .describe("Usually setValue or setColorRF"),
        value: z.string().describe("Value segment"),
        time: z
          .number()
          .int()
          .describe("Duration (API: x 10ms, 100 = 1s for setValue)"),
      },
    },
    async (args) =>
      ampio.setDeviceValueTimed(
        args.id_dev,
        args.function,
        args.value,
        args.time,
      ),
  );

  server.registerTool(
    "ampio_call_notification",
    {
      title: "Ampio: call notification",
      description:
        "GET /api/callNotofication/{id_dev} — typo preserved in upstream API.",
      inputSchema: {
        id_dev: z.number().int().describe("Calling device id"),
      },
    },
    async (args) => ampio.callNotification(args.id_dev),
  );

  server.registerTool(
    "ampio_push_notification",
    {
      title: "Ampio: push notification (all users)",
      description: "GET /api/pushNotification/{message}",
      inputSchema: {
        message: z.string().describe("Notification message"),
      },
    },
    async (args) => ampio.pushNotification(args.message),
  );

  server.registerTool(
    "ampio_push_notification_user",
    {
      title: "Ampio: push notification (user)",
      description: "GET /api/pushNotification/{message}/{user}",
      inputSchema: {
        message: z.string().describe("Notification message"),
        user: z.string().describe("Target user"),
      },
    },
    async (args) => ampio.pushNotificationUser(args.message, args.user),
  );

  server.registerTool(
    "ampio_set_event",
    {
      title: "Ampio: send CAN event",
      description: "GET /api/setEvent/{eventNum}",
      inputSchema: {
        eventNum: z.number().int().describe("Event number"),
      },
    },
    async (args) => ampio.setEvent(args.eventNum),
  );

  server.registerTool(
    "ampio_set_lcd_upper",
    {
      title: "Ampio: LCD upper line",
      description: "GET /api/set/setLcdUp/{text}",
      inputSchema: {
        text: z.string().describe("Upper LCD text"),
      },
    },
    async (args) => ampio.setLcdUp(args.text),
  );

  server.registerTool(
    "ampio_set_lcd_lower",
    {
      title: "Ampio: LCD lower line",
      description:
        "GET /api/set/setLcdDown/{text} — digits and comma only.",
      inputSchema: {
        text: z.string().describe("Lower LCD value (digits, comma)"),
      },
    },
    async (args) => ampio.setLcdDown(args.text),
  );

  server.registerTool(
    "ampio_json_scenes",
    {
      title: "Ampio: list scenes (JSON)",
      description: "GET /api/json/scenes",
      inputSchema: z.object({}),
    },
    async () => ampio.jsonScenes(),
  );

  server.registerTool(
    "ampio_run_scene",
    {
      title: "Ampio: run scene",
      description: "GET /api/run/scene/{scene_id}",
      inputSchema: {
        scene_id: z.number().int().describe("Scene id"),
      },
    },
    async (args) => ampio.runScene(args.scene_id),
  );

  server.registerTool(
    "ampio_undo_scene",
    {
      title: "Ampio: undo scene",
      description: "GET /api/undo/scene/{scene_id}",
      inputSchema: {
        scene_id: z.number().int().describe("Scene id"),
      },
    },
    async (args) => ampio.undoScene(args.scene_id),
  );

  server.registerTool(
    "ampio_off_scene",
    {
      title: "Ampio: off scene",
      description: "GET /api/off/scene/{scene_id}",
      inputSchema: {
        scene_id: z.number().int().describe("Scene id"),
      },
    },
    async (args) => ampio.offScene(args.scene_id),
  );
}
