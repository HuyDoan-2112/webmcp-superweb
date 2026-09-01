import assert from "node:assert/strict";
import fs from "node:fs";
import { DuckDBInstance } from "@duckdb/node-api";

const codes = JSON.parse(fs.readFileSync("data/catalog-products.json", "utf8"));
assert.ok(codes.every((code) => /^\d{7}$/.test(code)), "invalid product code");
const photos = fs.readdirSync("public/products")
  .filter((name) => /^\d{7}\.jpg$/.test(name))
  .map((name) => name.slice(0, -4))
  .sort();
assert.deepEqual(photos, [...codes].sort(), "manifest and JPEGs differ");

const db = await DuckDBInstance.create(":memory:");
const connection = await db.connect();
const selected = "'" + codes.join("','") + "'";
const rows = (await connection.runAndReadAll(`
  SELECT lower(color) AS color, COUNT(*) AS products
  FROM 'data/gold/dim_product.parquet'
  WHERE product_code IN (${selected})
  GROUP BY 1 ORDER BY 1
`)).getRowObjectsJson();
connection.closeSync();

const counts = Object.fromEntries(rows.map((row) => [row.color, Number(row.products)]));
assert.deepEqual(counts, { black: 8, blue: 2, grey: 2, orange: 4, silver: 5, white: 7 });
assert.equal(codes.length, 28);
console.log("catalog: 28 photographed products across 6 colours");
