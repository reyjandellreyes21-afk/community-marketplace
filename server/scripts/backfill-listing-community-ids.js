import "../load-env.js";
import { createClient } from "@supabase/supabase-js";
import { findCommunityIdByName } from "../src/lib/profileListingCommunity.js";

/**
 * One-time backfill: attach listings that currently have a NULL `community_id` to
 * their seller's resolvable profile community (matched by community *name* with the
 * same exact → strip-"Barangay" → case-insensitive → fuzzy rules the app now uses).
 *
 * Safe to re-run: only touches listings where `community_id IS NULL` and only when the
 * seller's profile community resolves to a real community row. Pass `--dry` to preview
 * without writing.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env.");
}
const dryRun = process.argv.includes("--dry");

const supabase = createClient(String(supabaseUrl).trim().replace(/\/+$/, ""), serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: communityRows, error: communitiesError } = await supabase.from("communities").select("*");
if (communitiesError) throw communitiesError;
const communities = communityRows || [];

const { data: listingRows, error: listingsError } = await supabase
  .from("listings")
  .select("id, seller_id, community_id")
  .is("community_id", null);
if (listingsError) throw listingsError;
const listings = listingRows || [];

if (listings.length === 0) {
  console.log("No listings with a NULL community_id. Nothing to backfill.");
  process.exit(0);
}

const sellerIds = [...new Set(listings.map((l) => String(l.seller_id || "").trim()).filter(Boolean))];
const { data: profileRows, error: profilesError } = await supabase
  .from("profiles")
  .select("id, community, community_id")
  .in("id", sellerIds);
if (profilesError) throw profilesError;

/** sellerId -> resolved community UUID (profile.community_id if set, else name match). */
const communityIdBySeller = new Map();
for (const p of profileRows || []) {
  const sellerId = String(p?.id || "").trim();
  if (!sellerId) continue;
  const fromProfile = p?.community_id ? String(p.community_id).trim() : "";
  const resolved = fromProfile || findCommunityIdByName(communities, p?.community);
  if (resolved) communityIdBySeller.set(sellerId, String(resolved));
}

/** communityId -> [listingId] for grouped updates. */
const listingsByCommunity = new Map();
let skipped = 0;
for (const listing of listings) {
  const sellerId = String(listing.seller_id || "").trim();
  const communityId = communityIdBySeller.get(sellerId);
  if (!communityId) {
    skipped += 1;
    continue;
  }
  if (!listingsByCommunity.has(communityId)) listingsByCommunity.set(communityId, []);
  listingsByCommunity.get(communityId).push(listing.id);
}

const toUpdateCount = [...listingsByCommunity.values()].reduce((sum, ids) => sum + ids.length, 0);
console.log(
  `Found ${listings.length} listing(s) with NULL community_id: ${toUpdateCount} resolvable, ${skipped} skipped (seller has no resolvable community).`,
);

if (dryRun) {
  for (const [communityId, ids] of listingsByCommunity) {
    const name = communities.find((c) => String(c.id) === communityId)?.name || communityId;
    console.log(`  [dry] ${ids.length} listing(s) → "${name}" (${communityId})`);
  }
  console.log("Dry run complete — no rows written.");
  process.exit(0);
}

let updated = 0;
for (const [communityId, ids] of listingsByCommunity) {
  const { error: updateError } = await supabase
    .from("listings")
    .update({ community_id: communityId })
    .in("id", ids)
    .is("community_id", null);
  if (updateError) {
    console.error(`Failed updating ${ids.length} listing(s) for community ${communityId}:`, updateError.message);
    continue;
  }
  updated += ids.length;
}

console.log(`Backfill complete: ${updated} listing(s) attached, ${skipped} skipped.`);
process.exit(0);
