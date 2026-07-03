import { config } from "dotenv";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// Next.js loads .env.local automatically; drizzle-kit does not — load it here.
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl || databaseUrl.includes("localhost")) {
  throw new Error(
    "Set DIRECT_DATABASE_URL (or DATABASE_URL) in .env.local to your Supabase connection string (port 5432). " +
      "See .env.example — drizzle-kit does not connect to localhost by default.",
  );
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use direct connection (port 5432) — pgBouncer transaction mode lacks advisory locks.
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
