const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = "Request failed";
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export async function fetchMarketplaceSnapshot() {
  return request("/state");
}

export async function registerUser(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createProductApi(payload) {
  return request("/state/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createOrderApi(payload) {
  return request("/state/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

