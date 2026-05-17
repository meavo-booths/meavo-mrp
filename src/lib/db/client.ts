import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

declare global {
   
  var __meavo_pg_client__: ReturnType<typeof postgres> | undefined;
   
  var __meavo_db__: PostgresJsDatabase<typeof schema> | undefined;
}

function getQueryClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in .env.local (see .env.example).",
    );
  }
  if (!globalThis.__meavo_pg_client__) {
    globalThis.__meavo_pg_client__ = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // safer with Supabase pgBouncer transaction-mode pooling
    });
  }
  return globalThis.__meavo_pg_client__;
}

/**
 * Drizzle client. Lazy-initialized on first use so that `next build` can
 * statically analyze API routes without a live DATABASE_URL.
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_target, prop) {
      if (!globalThis.__meavo_db__) {
        globalThis.__meavo_db__ = drizzle(getQueryClient(), { schema });
      }
      return Reflect.get(
        globalThis.__meavo_db__ as object,
        prop,
        globalThis.__meavo_db__,
      );
    },
  },
);

export type DbClient = typeof db;
export { schema };
