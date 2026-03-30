import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.ts";
import { getConfig } from "./config.ts";
import { Ampio } from "./ampio.ts";
import { registerAmpioMcpTools } from "./ampio-tools.ts";
import { buildDeviceMap, renderDeviceMapMarkdown } from "./device-mapper.ts";
import type { DeviceMap } from "./device-mapper.ts";

const REFRESH_INTERVAL_MS = 30_000;

let deviceMap: DeviceMap | null = null;

function getDeviceMapMarkdown(): string {
  return deviceMap ? renderDeviceMapMarkdown(deviceMap) : "Device map not yet available — loading...";
}

function startDeviceMapRefresh(ampio: Ampio): void {
  const refresh = () =>
    buildDeviceMap(ampio)
      .then((map) => { deviceMap = map; })
      .catch((err: unknown) => {
        logger.warn(
          { error: err instanceof Error ? err.message : String(err) },
          "Device map refresh failed",
        );
      });

  refresh();
  setInterval(refresh, REFRESH_INTERVAL_MS);
}

const getServer = () => {
  const config = getConfig();
  const server = new McpServer({
    name: config.SERVER_NAME,
    version: config.SERVER_VERSION,
  });

  const ampio = new Ampio({
    AMPIO_URL: config.AMPIO_URL,
    AMPIO_PORT: config.AMPIO_PORT,
    AMPIO_LOGIN: config.AMPIO_LOGIN,
    AMPIO_PASSWORD: config.AMPIO_PASSWORD,
  });

  registerAmpioMcpTools(server, ampio);

  server.resource(
    "ampio-device-map",
    "ampio://device-map",
    {
      description:
        "Ampio smart home device map — rooms, device IDs, types and current states. " +
        "Read this first to find device IDs before calling control tools.",
      mimeType: "text/markdown",
    },
    () => Promise.resolve({
      contents: [{ uri: "ampio://device-map", text: getDeviceMapMarkdown(), mimeType: "text/markdown" }],
    }),
  );

  server.prompt(
    "ampio-device-map",
    { description: "Inject Ampio device map as context — shows all rooms, device IDs, types and current states." },
    () => Promise.resolve({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Here is the current Ampio smart home device map. Use the device IDs from this map when calling control tools.\n\n${getDeviceMapMarkdown()}`,
          },
        },
      ],
    }),
  );

  return server;
};

const app = express();
app.use(express.json());

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const mcpHandler = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    // Handle initialization requests (usually POST without session ID)
    if (req.method === "POST" && !sessionId && isInitializeRequest(req.body)) {
      const newSessionId = randomUUID();
      logger.info("Initializing new MCP session", { sessionId: newSessionId });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
          logger.info("MCP session initialized", { sessionId });
        },
      });

      const server = getServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Handle existing session requests
    if (sessionId && transports[sessionId]) {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Handle case where no session ID is provided for non-init requests
    if (req.method === "POST" && !sessionId) {
      logger.warn(
        "POST request without session ID for non-initialization request",
      );
      res
        .status(400)
        .json({ error: "Session ID required for non-initialization requests" });
      return;
    }

    // Handle unknown session
    if (sessionId && !transports[sessionId]) {
      logger.warn("Request for unknown session", { sessionId });
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // For GET requests without session, return server info
    if (req.method === "GET") {
      const config = getConfig();
      res.json({
        name: config.SERVER_NAME,
        version: config.SERVER_VERSION,
        description: "TypeScript template for building MCP servers",
        capabilities: ["tools"],
      });
    }
  } catch (error) {
    logger.error("Error handling MCP request", {
      error: error instanceof Error ? error.message : error,
    });
    res.status(500).json({ error: "Internal server error" });
  }
};

// Handle MCP requests on /mcp endpoint
app.post("/mcp", mcpHandler);
app.get("/mcp", mcpHandler);

async function main() {
  const config = getConfig();

  const ampio = new Ampio({
    AMPIO_URL: config.AMPIO_URL,
    AMPIO_PORT: config.AMPIO_PORT,
    AMPIO_LOGIN: config.AMPIO_LOGIN,
    AMPIO_PASSWORD: config.AMPIO_PASSWORD,
  });
  startDeviceMapRefresh(ampio);

  // Graceful shutdown handling
  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    process.exit(0);
  });

  app.listen(config.PORT, () => {
    logger.info(
      `Ampio Smart Home MCP Server running on port ${config.PORT}`,
      {
        environment: config.NODE_ENV,
        serverName: config.SERVER_NAME,
        version: config.SERVER_VERSION,
      },
    );
  });
}

main().catch((error) => {
  logger.error("Server startup error", {
    error: error instanceof Error ? error.message : error,
  });
  process.exit(1);
});
