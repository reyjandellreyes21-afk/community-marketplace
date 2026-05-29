import test from "node:test";
import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import { geoValidators } from "../src/schemas/geoSchemas.js";

async function runValidation(chains, req) {
  for (const chain of chains) {
    await chain.run(req);
  }
  return validationResult(req);
}

test("geo search validator accepts q and limit", async () => {
  const req = { query: { q: "Quezon City", limit: "5" }, body: {}, params: {} };
  const result = await runValidation(geoValidators.search, req);
  assert.equal(result.isEmpty(), true);
});

test("geo reverse validator requires lat/lng", async () => {
  const req = { query: { lat: "14.65", lng: "121.03" }, body: {}, params: {} };
  const result = await runValidation(geoValidators.reverse, req);
  assert.equal(result.isEmpty(), true);
});
