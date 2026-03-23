import { z } from "zod";

const configSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    SERVER_NAME: z.string().default("ampio-smart-home"),
    AMPIO_URL: z.string().default("192.168.1.100"),
    AMPIO_PORT: z.coerce.number().default(8060),
    /** Basic auth user (OpenAPI `basicAuth`). */
    AMPIO_LOGIN: z.string().default(""),
    /** Alternative to AMPIO_LOGIN if you prefer this name in `.env`. */
    AMPIO_USERNAME: z.string().default(""),
    /** Basic auth password. */
    AMPIO_PASSWORD: z.string().default(""),
    SERVER_VERSION: z.string().default("1.0.0"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  })
  .transform(({ AMPIO_USERNAME, ...rest }) => ({
    ...rest,
    AMPIO_LOGIN: rest.AMPIO_LOGIN || AMPIO_USERNAME,
  }));

export type Config = z.infer<typeof configSchema>;

let config: Config;

export function getConfig(): Config {
  if (!config) {
    try {
      config = configSchema.parse(process.env);
    } catch (error) {
      console.error("❌ Invalid environment configuration:", error);
      process.exit(1);
    }
  }
  return config;
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === "production";
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === "development";
}