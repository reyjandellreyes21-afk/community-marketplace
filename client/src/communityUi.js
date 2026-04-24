/** Short label for gradient cards when no cover image is set. */
export function initialsFromName(name) {
  const s = String(name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] || "";
    const b = parts[1][0] || "";
    return `${a}${b}`.toUpperCase().slice(0, 3);
  }
  return s.slice(0, 3).toUpperCase();
}

/** Stable HSL gradient from an id (placeholder when community `imageUrl` is empty). */
export function gradientForId(id) {
  const s = String(id || "x");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  const h1 = h % 360;
  const h2 = (h1 + 42) % 360;
  return { from: `hsl(${h1} 52% 42%)`, to: `hsl(${h2} 48% 30%)` };
}
