import test from "node:test";
import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import { listingsValidators, marketplaceRouteValidators } from "../src/schemas/marketplaceSchemas.js";

async function runValidation(chains, req) {
  for (const chain of chains) {
    await chain.run(req);
  }
  return validationResult(req);
}

test("listings list validator accepts q/limit/offset within bounds", async () => {
  const req = {
    query: {
      q: "headphones",
      limit: "24",
      offset: "0",
      radiusKm: "5",
    },
    body: {},
    params: {},
  };
  const result = await runValidation(listingsValidators.list, req);
  assert.equal(result.isEmpty(), true);
});

test("listings list validator rejects oversized limit", async () => {
  const req = {
    query: {
      limit: "999",
    },
    body: {},
    params: {},
  };
  const result = await runValidation(listingsValidators.list, req);
  assert.equal(result.isEmpty(), false);
});

test("orders list validator accepts buyer/seller role + paging", async () => {
  const req = {
    query: {
      role: "seller",
      limit: "50",
      offset: "200",
    },
    body: {},
    params: {},
  };
  const result = await runValidation(marketplaceRouteValidators.listOrders, req);
  assert.equal(result.isEmpty(), true);
});
