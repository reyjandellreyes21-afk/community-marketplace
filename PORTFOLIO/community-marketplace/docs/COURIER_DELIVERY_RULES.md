# Community courier & delivery — Phase 1 rules

Plain-language behavior for **delivery orders** when using **community couriers**. Canonical mechanics live in `server/src/controllers/marketplaceController.js` (`listOpenDeliveryOrders`, `assignCourierToOpenDeliveryOrder`, order transitions).

## When is a delivery “open” for couriers?

- The seller has **accepted** the order (`order.status === "seller_accepted"`).
- Fulfillment is **delivery** (not pickup).
- The listing is tied to a **community** (same barangay / neighborhood used for matching).
- The order is **not** already assigned to a community courier (no successful claim yet for that order).
- The buyer and seller **cannot** act as the courier on that order.

**Open tasks** for couriers are listed via `GET /delivery/open`: same **community** as the courier’s profile, excluding orders where the viewer is the buyer or seller.

## Who can claim?

- **Community couriers** only: members with their profile `community_id` matching the order’s community (via listing, or seller’s community when the listing has no `community_id`).
- **Not** the buyer or seller for that order.

## First accept wins (race-safe)

- Multiple couriers may try to accept the same open task.
- The server uses a **single winning transition** on the order (from `seller_accepted` to `courier_assigned` with a chosen `courier_assignments` row). Losers get a **409**-style response and their pending assignment row is marked rejected.
- This prevents double-booking the same run.

## Seller self-delivery (bypasses community courier)

- If the seller chooses **self-delivery** before a courier is assigned, the order moves to **`out_for_delivery`** and any **pending** courier assignment rows for that order are **rejected**.
- After that, the order is **not** in the open-courier list (open list is only `seller_accepted`).

## Courier presence: online / off / busy

- **Off** (`offline`): not looking for runs; open tasks are not shown in the hub.
- **On** (`available` or `active`): can see open tasks and claim (API also requires one of these to claim).
- **Busy** is set **by the system** when a courier **successfully claims** a delivery. It is **not** set manually by the client.
- **Busy** is also the **effective** status while the courier has an **in-progress** delivery: order status is `courier_assigned` or `out_for_delivery` for an **accepted** assignment for that courier. In that state, **availability cannot be changed** until the order is completed or otherwise resolved (e.g. cancel rules as implemented).
- When the run ends (e.g. buyer confirms receipt), the system returns the courier toward **available** as implemented in the order/courier cleanup path.

## Transport mode (walk / run / bike)

- The profile stores **which modes** the courier uses (`profiles.courier_modes`).
- Each claim records **one mode** on `courier_assignments.mode` for that run (for ETA, analytics, and gamification). The client sends an explicit `mode` on `POST /orders/:id/courier/claim`; the server checks it against the profile when the profile lists modes, and falls back to a default order (bike → run → walk) when no mode is sent.

## Summary

| Topic | Rule |
|--------|------|
| Open for claim | `seller_accepted` + delivery + same community + not buyer/seller as courier |
| Winner | First successful server-side assign; others get “already taken” |
| Self-delivery | Seller can move to `out_for_delivery` from `seller_accepted` and clear pending courier rows |
| Busy | Automatic on claim; effective while an active delivery is in progress; no manual “busy” toggle |
| Mode | Profile + per-run `courier_assignments.mode` on accept |

This document is the **product contract** for Phase 1. If the app behavior diverges, either the code or this page should be updated to match.

## Phase 2 — money clarity (courier pool)

See [`COURIER_MONEY_PHASE2.md`](./COURIER_MONEY_PHASE2.md): buyer/seller pool splits, optional **minimum pool** to show open tasks (`OPEN_DELIVERY_MIN_COURIER_CENTS`), suggested courier rate on profile, and handoff expectations (still **no wallet**).
