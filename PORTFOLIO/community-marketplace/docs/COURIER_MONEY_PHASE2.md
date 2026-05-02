# Courier money clarity (Phase 2) — no in-app wallet

This phase adds **visible buyer + seller shares** of the **courier COD pool** before anyone commits, an optional **open-task visibility threshold**, a **suggested** rate on the courier profile, and **handoff copy** (still **cash / COD only**).

## Data model

- `orders.buyer_courier_contribution_cents` — buyer’s share of the pool (PHP centavos).
- `orders.seller_courier_contribution_cents` — seller’s share of the pool (PHP centavos).
- `orders.cod_delivery_cents` — **total** courier pool = buyer + seller (maintained by the API).

## API

- **POST `/orders`**: optional `buyerCourierContributionCents` (delivery only).
- **PATCH `/orders/:id`** with `transition: "seller_accept"`: optional `sellerCourierContributionCents`.
- **PATCH `/orders/:id`** with `transition: "update_courier_contributions"`: adjust pools before a community courier is assigned.
  - **`placed`**: only the **buyer** may set `buyerCourierContributionCents`.
  - **`seller_accepted`** (no courier yet): **buyer** may set buyer share; **seller** may set seller share.
  - After a courier is assigned: **not** editable via this transition (coordinate off-app or cancel per your policy).

## Open deliveries visibility

Open courier tasks (`GET /delivery/open`) may be filtered by **`OPEN_DELIVERY_MIN_COURIER_CENTS`** (integer centavos). Default **`0`** shows all tasks.

Examples:

- `OPEN_DELIVERY_MIN_COURIER_CENTS=100` — hide tasks until the pooled courier COD is at least **₱1** (100 centavos).

### Edge cases

- **Seller bumps the pool later**: If a task was hidden and the seller (or buyer) increases contributions so the total crosses the threshold, the task **appears on the next load** (refresh / polling). Couriers already watching should refresh to see new tasks.
- **Threshold crossed downward**: If edits reduced the pool below the minimum (before a courier is assigned), the task **disappears** from the open list on the next fetch.
- **Courier assigned**: Pool amounts are **not** reset on claim (server preserves agreed totals).

## Profile — suggested rate

- Column: `profiles.courier_suggested_cents` (nullable).
- **PATCH `/auth/me`**: optional `courierSuggestedCents` (centavos) or `null` to clear.
- **PATCH `/me/courier-presence`**: optional `suggestedCompensationCents` (same).
- Shown in the app as **suggested / reference only** — **never** auto-charged.

## Product copy principle

All courier compensation remains **cash at handoff**. The app does **not** hold balances or process payouts.
