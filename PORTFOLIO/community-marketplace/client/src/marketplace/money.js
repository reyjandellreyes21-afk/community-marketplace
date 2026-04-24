export function formatCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP" }).format(n / 100);
  } catch {
    return `₱${(n / 100).toFixed(2)}`;
  }
}
