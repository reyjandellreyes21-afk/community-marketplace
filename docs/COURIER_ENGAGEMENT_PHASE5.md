# Engagement & “game” (Phase 5)

## API

**GET** `/api/v1/communities/:communityId/courier-engagement` (auth, **member of that community only**)

Returns:

- **`leaderboardToday` / `leaderboardWeek`**: couriers with the most **completed community delivery runs** in the barangay (UTC **calendar day** vs **ISO week** starting **Monday 00:00 UTC**). Counts use orders with an **accepted** `courier_assignments` row and `orders.fulfillment_type = delivery`, scoped by the same **effective community** as open deliveries (listing `community_id`, else seller profile `community_id`).
- **`topCourierOfWeek`**: first entry on the weekly table (by delivery count) that also has **global** `courier_delivery_reviews` stats with `avgRating >=` threshold and `reviewCount >=` minimum. (Cheap v1: reviews are not re-scoped to the community — only delivery counts are community-scoped.)
- **`fastestRunnerWeek`**: among couriers with at least **`COURIER_FASTEST_MIN_DELIVERIES`** timed runs this week in the community, the **lowest average** of `(order.completed_at - courier_assignments.created_at)` in minutes. This uses existing timestamps (claim row + completion) — no new DB columns.

## Environment (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `COURIER_TOP_MIN_AVG_RATING` | `4` | Min average star rating for “top courier” |
| `COURIER_TOP_MIN_REVIEWS` | `1` | Min number of **global** courier reviews to qualify |
| `COURIER_FASTEST_MIN_DELIVERIES` | `2` | Min weekly runs with valid timing for fastest |
| `COURIER_LEADERBOARD_LIMIT` | `15` | Max rows per table |

## Phase 5.16 — “Fastest runner” + Fast tags

- **Now**: duration leaderboard + per-row **`fastTagRate`** (fraction of reviews with tag `fast`).
- **Later**: optionally rank by Fast-tag rate or blend with duration once completion/review volume is stable —see API `meta.fastestRunnerPhaseNote`.
