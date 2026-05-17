import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // drizzle-kit migrations should use the direct connection (port 5432)
    // because pgBouncer transaction-mode does not support advisory locks.
    url:
      process.env.DIRECT_DATABASE_URL ??
      process.env.DATABASE_URL ??
      "postgres://localhost/meavo_stock_dev",
  },
  strict: true,
  verbose: true,
});
