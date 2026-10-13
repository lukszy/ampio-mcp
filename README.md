# ampio-mcp

MCP server for the **Ampio smart home system**. Exposes Ampio's HTTP API as MCP tools and maintains an auto-refreshing device map that AI assistants use to discover rooms, device IDs, and states before issuing control commands.

## Features

- 25+ MCP tools: device queries, control (on/off/dim/color/roller/temperature), scenes, notifications, logbook, CAN events
- `ampio://device-map` resource — markdown table of all rooms and devices, refreshed every 30 s
- `ampio-device-map` prompt — injects the map as context so the AI always knows device IDs
- HTTP Basic auth to the Ampio controller

## Requirements

- [Bun](https://bun.sh) ≥ 1.2
- Ampio controller reachable over HTTP (default port 8060)
- Ampio HTTP API credentials

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
```

```env
AMPIO_URL=192.168.1.100   # IP, host:port, or full http(s):// URL
AMPIO_PORT=8060            # used when AMPIO_URL has no port
AMPIO_LOGIN=admin          # HTTP Basic auth username
AMPIO_PASSWORD=secret      # HTTP Basic auth password
PORT=3000                  # MCP HTTP server port (default: 3000)
LOG_LEVEL=info             # error | warn | info | debug
```

### 3. Run

```bash
bun run dev    # development with hot reload
bun run build && bun start    # production
```

The MCP server listens at `http://localhost:3000/mcp`.

---

## Connecting AI assistants

### Claude (claude.ai/code)

Add to `~/.claude.json` (global) or `.mcp.json` (project):

```json
{
  "mcpServers": {
    "ampio": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Or use the CLI:

```bash
npx @anthropic-ai/claude-code mcp add --transport http ampio http://localhost:3000/mcp
```

### OpenCode

```bash
npx opencode@latest config mcp add ampio http://localhost:3000/mcp
```

Or edit `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "ampio": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Codex (OpenAI)

```bash
npx @openai/codex mcp add ampio http://localhost:3000/mcp
```

Or edit `~/.codex/config.json`:

```json
{
  "mcpServers": {
    "ampio": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Hermes (Nous Research)

```bash
hermes mcp add --url http://localhost:3000/mcp ampio
```

Or edit `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  ampio:
    url: "http://localhost:3000/mcp"
```

Then run `/reload-mcp` (or restart Hermes) and verify with `hermes mcp test ampio`.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ampio": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

---

## Docker

```bash
docker build -t ampio-mcp .
docker run -p 3000:3000 \
  -e AMPIO_URL=192.168.1.100 \
  -e AMPIO_LOGIN=admin \
  -e AMPIO_PASSWORD=secret \
  ampio-mcp
```

---

## Available tools

**Query**

| Tool | Description |
|------|-------------|
| `ampio_json_groups` | List all groups |
| `ampio_json_group_devices` | Device IDs per group |
| `ampio_json_group_devices_for_group` | Devices for a specific group |
| `ampio_json_devices` | List all devices |
| `ampio_json_devices_by_type` | Filter by type (led, rgb, roleta, …) |
| `ampio_json_devs_detail` | Devices with extended details |
| `ampio_json_device_state` | Legacy state format |
| `ampio_json_device_state2` | Current state (preferred) |
| `ampio_json_logbook` | Logbook with time range and pagination |
| `ampio_json_device_signal` | RF signal strength |
| `ampio_json_device_getsignal` | Trigger RF signal measurement |

**Control**

| Tool | Description |
|------|-------------|
| `ampio_set_device_simple` | turnOn / turnOff / open / close / stop / switch |
| `ampio_set_device_value` | setValue, setColor, setTemperature, arm, disarm, … |
| `ampio_set_device_value_timed` | Set value with a duration |

**Scenes**

| Tool | Description |
|------|-------------|
| `ampio_json_scenes` | List scenes |
| `ampio_run_scene` | Run a scene |
| `ampio_undo_scene` | Undo a scene |
| `ampio_off_scene` | Turn off a scene |

**Notifications & events**

| Tool | Description |
|------|-------------|
| `ampio_call_notification` | Call notification for a device |
| `ampio_push_notification` | Push to all users |
| `ampio_push_notification_user` | Push to a specific user |
| `ampio_set_event` | Send a CAN event |
| `ampio_set_lcd_upper` | Set LCD upper line |
| `ampio_set_lcd_lower` | Set LCD lower line |

---

## Project structure

```
src/
├── index.ts          # Express server, MCP sessions, device map refresh
├── ampio.ts          # Ampio HTTP API client
├── ampio-tools.ts    # MCP tool registrations
├── device-mapper.ts  # Builds the markdown device map
├── config.ts         # Zod-validated env config
├── logger.ts         # Pino structured logger
└── lib/utils.ts      # MCP response helpers
```

## Development

```bash
bun run lint          # ESLint
bun run format        # Prettier
bun test              # Vitest
```

See `CLAUDE.md` / `AGENTS.md` for coding standards.
