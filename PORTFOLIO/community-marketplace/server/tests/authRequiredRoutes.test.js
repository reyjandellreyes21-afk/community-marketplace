import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

function requestJson({ method, path, headers = {}, body = null, port }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += String(chunk);
        });
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (body != null) req.write(JSON.stringify(body));
    req.end();
  });
}

test("app feedback POST rejects missing bearer token", async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "publishable-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key";
  const { app } = await import("../src/app.js");
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const response = await requestJson({
      method: "POST",
      path: "/api/v1/app-feedback",
      body: { category: "experience", message: "test" },
      port,
    });
    assert.equal(response.status, 401);
    assert.equal(response.body?.error?.message, "Missing or invalid Authorization header.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("protected marketplace route rejects missing bearer token", async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "publishable-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-role-key";
  const { app } = await import("../src/app.js");
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const response = await requestJson({
      method: "GET",
      path: "/api/v1/orders",
      port,
    });
    assert.equal(response.status, 401);
    assert.equal(response.body?.error?.message, "Missing or invalid Authorization header.");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
