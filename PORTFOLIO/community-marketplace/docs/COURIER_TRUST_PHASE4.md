# Trust after delivery (Phase 4)

## Buyer → courier rating (per assignment)

- **Storage:** `public.courier_delivery_reviews` — one row per **accepted** `courier_assignments` row (the delivery run), with `order_id`, `buyer_id`, and `courier_id` for queries and trust signals.
- **Not** a replacement for **buyer → seller** `order_reviews` (product / seller feedback stays separate).

## API

- **PUT** `/api/v1/orders/:id/courier-review` (auth buyer only)
  - Body: `rating` (1–5), optional `tags` (`["fast","late","friendly"]`), optional `abuseNote` (≤500 chars).
  - Allowed only when the order is **completed**, **delivery**, and has **`accepted_courier_assignment_id`** (community courier run). Self-delivery orders have no courier review.

## Moderation basics

- **One review per delivery:** enforced by `UNIQUE (courier_assignment_id)` — upserts update the same row.
- **Report later:** optional `abuseNote`. When non-empty, `abuse_reported_at` is set the first time (kept if the buyer edits or clears the note text later).
- Operator-facing workflows (triage queue, email alerts) are **not** in this repo — data is stored for export or a future admin tool.

## RLS (direct Supabase clients)

Buyer and courier can **select** their rows; only the buyer can **insert/update**. The marketplace API uses the **service role** and bypasses RLS.
