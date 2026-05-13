/**
 * Applies supabase/migrations/20260519120000_orders_status_provider_on_the_way.sql
 *
 * Adds `provider_on_the_way` to the `orders.status` CHECK constraint so service-booking
 * "Mark On The Way" transitions can write the new status without violating the whitelist.
 *
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
  "../../supabase/migrations/20260519120000_orders_status_provider_on_the_way.sql",
);

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "Missing DATABASE_URL. Add it to server/.env (Supabase Dashboard → Project Settings → Database → Connection string), then run again.",
  );
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");
const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  await client.query(sql);
  console.log("Applied orders.status provider_on_the_way migration OK.");
} finally {
  await client.end().catch(() => {});
}
