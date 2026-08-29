// DuckDB connection and query helper.
//
// Read only. The gold parquet is committed and bundled with the function, so
// there is no database to connect to and nothing here can write.

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { join } from "node:path";

let connection: Promise<DuckDBConnection> | null = null;

/** Absolute path to a committed data file, resolved against the bundle root. */
export function dataPath(...parts: string[]): string {
  return join(process.cwd(), "data", ...parts);
}

export function goldParquet(table: string): string {
  return dataPath("gold", `${table}.parquet`);
}

/**
 * One connection per warm function instance. Fluid Compute reuses instances
 * across requests, so this is worth holding onto.
 */
async function getConnection(): Promise<DuckDBConnection> {
  if (!connection) {
    connection = (async () => {
      const instance = await DuckDBInstance.create(":memory:");
      const con = await instance.connect();
      // Views over the committed parquet. Named to match shared/metrics.ts so
      // the SQL the registry composes reads the same as the registry says.
      for (const table of [
        "fact_sales_daily",
        "fact_orders_daily",
        "dim_product",
        "dim_store",
        "dim_date",
      ]) {
        await con.run(
          `CREATE OR REPLACE VIEW ${table} AS SELECT * FROM read_parquet('${goldParquet(table)}')`,
        );
      }
      return con;
    })();
  }
  return connection;
}

/** DuckDB returns BIGINT as JS BigInt, which JSON.stringify refuses. */
function coerce(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === "object" && "toString" in value) {
    // DECIMAL and friends arrive as objects carrying a numeric string.
    const s = String(value);
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
  }
  return value;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const con = await getConnection();
  const reader = await con.runAndReadAll(sql, params as never[]);
  return reader.getRowObjects().map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = coerce(v);
    return out as T;
  });
}
