import { getApiV1Base } from "../apiBase.js";

const API_URL = getApiV1Base();

function getApiErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  const rawDetails = payload.error?.details;
  if (rawDetails && typeof rawDetails === "object" && !Array.isArray(rawDetails)) {
    const { method, url } = rawDetails;
    if (typeof method === "string" && typeof url === "string" && url) {
      return `Route not found (${method} ${url}).`;
    }
  }
  const detailed = Array.isArray(payload.error?.details)
    ? payload.error.details
        .map((entry) => {
          const msg = entry?.msg || entry?.message;
          if (!msg) return "";
          const field = entry?.path || entry?.param;
          return field ? `${field}: ${msg}` : msg;
        })
        .filter(Boolean)
        .join(" ")
    : "";
  const normalizedDetails = detailed.replace(/\s{2,}/g, " ").trim();
  if (/^firstName:\s*Invalid value$/i.test(normalizedDetails)) {
    return "Please enter a valid username.";
  }
  if (normalizedDetails) return normalizedDetails;
  const genericMessage = payload.error?.message || payload.message || fallback;
  return genericMessage === "Validation failed." ? "Please check the highlighted fields and try again." : genericMessage;
}

async function readApiPayload(response) {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!response.ok) return { error: { message: `Request failed (${response.status})` } };
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    if (!response.ok) {
      return { error: { message: text.slice(0, 200) || `Request failed (${response.status})` } };
    }
    return { error: { message: "Invalid response from server." } };
  }
}

export async function apiRequest(path, { method = "GET", token, body, headers = {}, cache } = {}) {
  const requestHeaders = { ...headers };
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const hasBody = body !== undefined;
  if (hasBody && !(body instanceof FormData) && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: hasBody ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
      ...(cache !== undefined ? { cache } : {}),
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
      throw new Error("No internet connection. Please check your network and try again.");
    }
    throw new Error(message || "Cannot reach server.");
  }
  const payload = await readApiPayload(response);
  if (!response.ok) {
    const proxiedDev = import.meta.env.DEV && API_URL.startsWith("/");
    let fallback = `Request failed (${response.status})`;
    if (response.status === 502 && proxiedDev) {
      fallback =
        "Request failed (502): Vite could not reach the API at http://127.0.0.1:4000. Start `community-marketplace/server` (npm run dev) and ensure the API is listening on port 4000.";
    }
    const requestedUrl =
      typeof window !== "undefined"
        ? (() => {
            try {
              const base =
                API_URL.startsWith("http") ? API_URL : `${window.location.origin}${API_URL.startsWith("/") ? "" : "/"}${API_URL}`;
              return new URL(path.replace(/^\//, ""), `${base.replace(/\/+$/, "")}/`).href;
            } catch {
              return `${API_URL}${path}`;
            }
          })()
        : `${API_URL}${path}`;
    const error = new Error(
      `${getApiErrorMessage(payload, fallback)}${response.status === 404 ? `\nRequested: ${requestedUrl}` : ""}`,
    );
    error.status = response.status;
    throw error;
  }
  return payload;
}

/** Only treat 401 as invalid session — do not clear the token on network or server errors. */
export const isUnauthorizedApiError = (error) => typeof error?.status === "number" && error.status === 401;
