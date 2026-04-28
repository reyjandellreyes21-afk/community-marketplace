/** Join class names; falsy values omitted. */
export function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}
