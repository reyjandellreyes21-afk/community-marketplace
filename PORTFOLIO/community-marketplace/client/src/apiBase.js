const defaultApiUrl = () => {
  if (!import.meta.env.DEV) return "http://localhost:4000/api/v1";
  return "http://127.0.0.1:4000/api/v1";
};

/**
 * Resolves the API base including `/api/v1`.
 * Normalizes `VITE_API_URL=http://localhost:4000/api` → `.../api/v1`.
 */
export const getApiV1Base = () => {
  let base = String(import.meta.env.VITE_API_URL || defaultApiUrl())
    .trim()
    .replace(/\/+$/, "");
  /* Common mistake: full resource URL in env */
  base = base.replace(/\/communities\/?$/i, "");
  while (base.includes("/api/v1/api/v1")) {
    base = base.replace("/api/v1/api/v1", "/api/v1");
  }
  if (/\/api$/i.test(base) && !/\/api\/v1$/i.test(base)) {
    base = `${base}/v1`;
  }
  try {
    if (base.startsWith("http") && !base.includes("/api")) {
      const u = new URL(base);
      if (u.pathname === "/" || u.pathname === "") {
        base = `${u.origin.replace(/\/+$/, "")}/api/v1`;
      }
    }
  } catch {
    /* keep base */
  }
  return base;
};
