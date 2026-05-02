/**
 * Applies supabase/migrations/20260507140000_ensure_courier_delivery_reviews.sql
 * against your Supabase Postgres (bypasses PostgREST; fixes PGRST205 for courier_delivery_reviews).
 *
 * Requires DATABASE_URL (Supabase Dashboard → Project Settings → Database → Connection string → URI).
 * Add to server/.env, then from repo root:  node server/scripts/apply-courier-delivery-reviews.js
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
  "../../supabase/migrations/20260507140000_ensure_courier_delivery_reviews.sql",
);

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error(
    "Missing DATABASE_URL. In Supabase: Project Settings → Database → copy the connection string (URI) into server/.env as DATABASE_URL=...",
  );
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");
const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("supabase.com") || url.includes("pooler") ? { rejectUnauthorized: false } : undefined,
});
try {
  await client.connect();
  await client.query(sql);
  console.log("Applied courier_delivery_reviews migration OK. PostgREST was notified to reload the schema.");
} catch (e) {
  console.error(e.message || e);
  if (/courier_assignments/i.test(String(e.message || ""))) {
    console.error(
      "Hint: Run earlier migrations so public.courier_assignments exists (e.g. 20260504120000_rename_delivery_bids_to_courier_assignments.sql), then run this script again.",
    );
  }
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
