import assert from "node:assert/strict";
import test from "node:test";
import { effectiveServiceSlotFromOrderRow } from "../src/lib/serviceBookingHold.js";

test("effectiveServiceSlotFromOrderRow: full snake_case columns", () => {
  const slot = effectiveServiceSlotFromOrderRow({
    service_booking_date: "2026-05-14",
    service_booking_time: "12:00:00",
    buyer_comment: "Requested: 2026-05-14 12:00\nnote",
  });
  assert.deepEqual(slot, { date: "2026-05-14", time: "12:00" });
});

test("effectiveServiceSlotFromOrderRow: merge date column + time from Requested line", () => {
  const slot = effectiveServiceSlotFromOrderRow({
    service_booking_date: "2026-05-14",
    service_booking_time: null,
    buyer_comment: "Requested: 2026-05-14 12:00\nBuyer note",
  });
  assert.deepEqual(slot, { date: "2026-05-14", time: "12:00" });
});

test("effectiveServiceSlotFromOrderRow: camelCase columns", () => {
  const slot = effectiveServiceSlotFromOrderRow({
    serviceBookingDate: "2026-05-14",
    serviceBookingTime: "12:00",
    buyerComment: "",
  });
  assert.deepEqual(slot, { date: "2026-05-14", time: "12:00" });
});

test("effectiveServiceSlotFromOrderRow: merge time column + date from comment when date column missing", () => {
  const slot = effectiveServiceSlotFromOrderRow({
    service_booking_date: null,
    service_booking_time: "12:00",
    buyer_comment: "Requested: 2026-05-14 12:00",
  });
  assert.deepEqual(slot, { date: "2026-05-14", time: "12:00" });
});
