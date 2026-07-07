import "server-only";

import { z } from "zod";

const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(10).optional(),

  AUTH_SECRET: z.string().min(10).optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  MRP_TOOL_CARD_ID: z.string().default("seed-mrp-tool"),
  GATEWAY_URL: z.string().url().default("https://meavo.app"),

  BLOB_READ_WRITE_TOKEN: z.string().min(10).optional(),

  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_THINKING_BUDGET: z.coerce.number().int().min(0).max(8192).default(0),

  ZERON_ADAPTER: z
    .enum(["stub", "export", "api", "agent"])
    .default("stub"),
  ZERON_API_BASE_URL: z.string().optional(),
  ZERON_API_KEY: z.string().optional(),
  ZERON_EXPORT_EMAIL: z.string().optional(),

  GOOGLE_SHEETS_MASTER_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Empty strings (e.g. unset Vercel placeholders) behave like missing vars. */
function nonEmptyEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => (entry[1] ?? "") !== "",
    ),
  );
}

function loadEnv(): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(nonEmptyEnv());
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Invalid server environment variables. See .env.example.\n${issues}`,
    );
  }
  return parsed.data;
}

/**
 * Lazily-validated server-side environment variables.
 *
 * The validation is intentionally permissive at construction time — many
 * variables are optional so that local builds work before the database and
 * auth are wired.
 */
export const env: ServerEnv = (() => {
  try {
    return loadEnv();
  } catch (e) {
    // Print once at startup but do not crash the build.
    // Routes that require missing values will throw with clearer errors.
    if (process.env.NODE_ENV !== "production") {
       
      console.warn(
        "[meavo-mrp] env warning:",
        (e as Error).message.split("\n")[0],
      );
    }
    return ServerEnvSchema.parse({
      NODE_ENV: process.env.NODE_ENV || "development",
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    });
  }
})();
