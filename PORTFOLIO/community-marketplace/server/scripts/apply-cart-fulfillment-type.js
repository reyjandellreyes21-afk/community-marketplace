/**
 * Applies supabase/migrations/20260503130000_cart_items_fulfillment_type.sql
 * Requires DATABASE_URL (Supabase Dashboard → Project Settings → Database → URI).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const migrationPath = path.join(
  __dirname,
  "../../supabase/migrations/20260503130000_cart_items_fulfillment_type.sql",
);

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "Missing DATABASE_URL. Add it to server/.env (Database → Connection string from Supabase Dashboard), then run again.",
  );
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  console.log("Applied cart_items.fulfillment_type migration OK.");
} finally {
  await client.end().catch(() => {});
}
