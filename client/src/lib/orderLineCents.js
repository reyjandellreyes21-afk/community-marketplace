/**
 * Unit price (per item) from persisted order line — `cod_goods_cents` is line total for `quantity`.
 */
export function orderLineUnitPriceCents(order) {
  const q = Math.max(1, Math.floor(Number(order?.quantity) || 1));
  const goods = Math.max(0, Number(order?.codGoodsCents ?? order?.cod_goods_cents) || 0);
  return Math.round(goods / q);
}

/** Goods + delivery COD amount for display / handoff. */
export function orderCodGrandTotalCents(order) {
  const goods = Math.max(0, Number(order?.codGoodsCents ?? order?.cod_goods_cents) || 0);
  const del = Math.max(0, Number(order?.codDeliveryCents ?? order?.cod_delivery_cents) || 0);
  return goods + del;
}
