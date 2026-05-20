# Subscription tiers (Basic / Pro / Premium)

Read this before wiring paid rules or checkout. It describes **what kinds of rules** you can apply per tier and **where they live in this repo**.

**If tables look like plain text:** use **Markdown: Open Preview** in Cursor, **or** open [`subscription-tiers.html`](subscription-tiers.html) in your browser (double-click) for a formatted version.

---

## Tier order

Tiers are strictly ordered:

`basic` < `pro` < `premium`

“Requires Pro” means **Pro or Premium** unless you explicitly scope to Pro-only.

---

## Data model

<table>
<thead>
<tr><th>Item</th><th>Detail</th></tr>
</thead>
<tbody>
<tr><td><strong>Column</strong></td><td><code>public.profiles.subscription_tier</code></td></tr>
<tr><td><strong>Allowed values</strong></td><td><code>basic</code>, <code>pro</code>, <code>premium</code></td></tr>
<tr><td><strong>Default</strong></td><td><code>basic</code></td></tr>
<tr><td><strong>Migration</strong></td><td><code>supabase/migrations/20260503130000_profiles_subscription_tier.sql</code></td></tr>
<tr><td><strong>Who may change tier</strong></td><td>Payment webhooks, admin, SQL — <strong>not</strong> <code>PATCH /auth/me</code> from the client</td></tr>
</tbody>
</table>

---

## Server helpers

<table>
<thead>
<tr><th>File</th><th>Purpose</th></tr>
</thead>
<tbody>
<tr><td><a href="../server/src/utils/subscriptionTier.js"><code>server/src/utils/subscriptionTier.js</code></a></td><td><code>normalizeSubscriptionTier</code>, <code>subscriptionTierRank</code>, <code>meetsMinSubscriptionTier</code></td></tr>
<tr><td><a href="../server/src/middleware/auth.js"><code>server/src/middleware/auth.js</code></a></td><td>Sets <code>req.user.subscriptionTier</code> after loading <code>profiles</code></td></tr>
<tr><td><strong><code>requireMinSubscriptionTier('pro')</code></strong></td><td>Chain after <code>requireAuth</code>; <strong>403</strong> + code <strong><code>PLAN_REQUIRED</code></strong> if tier too low</td></tr>
</tbody>
</table>

API responses expose **`subscriptionTier`** on the user object via [`server/src/utils/displayName.js`](../server/src/utils/displayName.js) → `userToClient()`.

---

## Client helpers

<table>
<thead>
<tr><th>File</th><th>Purpose</th></tr>
</thead>
<tbody>
<tr><td><a href="../client/src/lib/subscriptionTier.js"><code>client/src/lib/subscriptionTier.js</code></a></td><td>Same tier helpers + <strong><code>formatSubscriptionTierLabel</code></strong> for UI</td></tr>
</tbody>
</table>

**`GET /api/v1/auth/me`** (and login/register) includes **`subscriptionTier`**. Use for **UX only**; enforce paid rules on the server.

---

## Current code status (inventory)

<table>
<thead>
<tr><th>Piece</th><th>Status</th></tr>
</thead>
<tbody>
<tr><td>DB column + default <code>basic</code></td><td>Implemented (after migration applied)</td></tr>
<tr><td><code>subscriptionTier</code> on API user JSON</td><td>Implemented</td></tr>
<tr><td>Profile tier badge (your account)</td><td>Implemented</td></tr>
<tr><td>Any route using <code>requireMinSubscriptionTier</code></td><td><strong>Not wired yet</strong> — all authenticated users get same API behavior</td></tr>
<tr><td>Pro/Premium-only UI gates</td><td><strong>Not wired</strong> (except showing the tier label)</td></tr>
</tbody>
</table>

---

## Product matrix (starter — edit for LinkMart)

Replace vague words with **concrete limits** (e.g. max listings **10 / 50 / 200**) when you set pricing.

<table>
<thead>
<tr><th>Capability</th><th>Basic</th><th>Pro</th><th>Premium</th></tr>
</thead>
<tbody>
<tr><td>Core browse &amp; buy</td><td>Yes</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Sell / create listings</td><td>Yes (lowest limits)</td><td>Yes (higher limits)</td><td>Yes (best limits)</td></tr>
<tr><td>Images per listing / total media</td><td>Fewest</td><td>More</td><td>Most</td></tr>
<tr><td>Seller tools (bulk, duplicate, schedule)</td><td>Minimal / none</td><td>Yes</td><td>Yes</td></tr>
<tr><td>Boosted or featured in browse</td><td>No</td><td>Optional / limited</td><td>Stronger / included</td></tr>
<tr><td>Analytics or CSV export</td><td>No</td><td>Basic</td><td>Advanced</td></tr>
<tr><td>Priority or dedicated support</td><td>No</td><td>No</td><td>Optional</td></tr>
</tbody>
</table>

---

## Rule types (what you can enforce)

<table>
<thead>
<tr><th>Type</th><th>What it means</th><th>Examples</th></tr>
</thead>
<tbody>
<tr><td><strong>Limits (quotas)</strong></td><td>Count or cap usage</td><td>Max active listings, communities owned, image count</td></tr>
<tr><td><strong>Feature gates</strong></td><td>Whole feature off below a tier</td><td>Bulk actions, boosts, private communities</td></tr>
<tr><td><strong>Quality of service</strong></td><td>Priority / speed / ranking</td><td>Support SLA, search boost (only promise what you ship)</td></tr>
<tr><td><strong>Billing (later)</strong></td><td>Paid lifecycle</td><td>Stripe webhooks → tier; optional <code>subscription_expires_at</code></td></tr>
</tbody>
</table>

---

## Product checklist (what to decide)

- [ ] Final limits per tier (listings, images, communities, …)
- [ ] Which features are **Basic vs Pro vs Premium** gates
- [ ] Pricing and trials (if any)
- [ ] What happens when subscription lapses (downgrade to Basic?)
- [ ] Support tier promises (if Premium includes priority support)

---

## Engineering checklist (when you implement each rule)

For **each** paid rule you add:

- [ ] Define **minimum tier** (`basic` | `pro` | `premium`)
- [ ] Add **server enforcement**: `requireMinSubscriptionTier(...)` on the route **and/or** DB check (count, insert guard)
- [ ] Add **client UX**: disable or explain + optional `meetsMinSubscriptionTier` for button state
- [ ] If the app writes tier-gated data **via Supabase client + RLS**, update policies to match the API

---

## Principle

**Store tier in Postgres; update from trusted server paths; enforce on the API; use the client only for clarity — not as security.**
