"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPersistedState, persistMarketplaceState } from "@/lib/cprMarketplaceStorage";
import { createOrderApi } from "@/lib/marketplaceApi";

function canBuy(user) {
  return Boolean(user?.roles?.includes("admin") || user?.roles?.includes("buyer"));
}

export default function GlobalCheckoutModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    deliveryMethod: "delivery",
    paymentMethod: "cod",
    address: "",
    notes: "",
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const snapshot = useMemo(() => loadPersistedState(), [tick]);

  const currentUser = useMemo(() => {
    const s = snapshot;
    if (!s?.users || s.currentUserId == null) return null;
    return s.users.find((u) => u.id === s.currentUserId) || null;
  }, [snapshot]);

  const cartItems = useMemo(() => {
    const s = snapshot;
    if (!s?.cart?.length || !s.products) return [];
    return s.cart
      .map((item) => {
        const product = s.products.find((p) => p.id === item.productId);
        return product ? { ...item, product } : null;
      })
      .filter(Boolean);
  }, [snapshot]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [cartItems]
  );

  useEffect(() => {
    const onOpen = () => {
      refresh();
      setCheckoutForm((prev) => ({ ...prev }));
      setOpen(true);
    };
    window.addEventListener("cpr-open-checkout", onOpen);
    return () => window.removeEventListener("cpr-open-checkout", onOpen);
  }, [refresh]);

  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener("cpr-marketplace-state-changed", onChanged);
    return () => window.removeEventListener("cpr-marketplace-state-changed", onChanged);
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "1") return;
    const s = loadPersistedState();
    const user = s?.users?.find((u) => u.id === s.currentUserId);
    if (!user) {
      router.replace("/", { scroll: false });
      window.dispatchEvent(
        new CustomEvent("cpr-require-auth", {
          detail: { message: "Please login to access buyer checkout." },
        })
      );
      return;
    }
    window.dispatchEvent(new CustomEvent("cpr-open-checkout"));
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const removeFromCart = (product) => {
    const s = loadPersistedState();
    if (!s) return;
    const user = s.users.find((u) => u.id === s.currentUserId);
    if (!canBuy(user)) return;
    const prevCart = s.cart ?? [];
    const existing = prevCart.find((item) => item.productId === product.id);
    if (!existing) return;
    let nextCart;
    if (existing.quantity <= 1) {
      nextCart = prevCart.filter((item) => item.productId !== product.id);
    } else {
      nextCart = prevCart.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity - 1 } : item
      );
    }
    persistMarketplaceState({ cart: nextCart });
  };

  const addToCart = (product, quantity = 1) => {
    const s = loadPersistedState();
    if (!s) return;
    const user = s.users.find((u) => u.id === s.currentUserId);
    if (!canBuy(user)) return;
    const prevCart = s.cart ?? [];
    const existing = prevCart.find((item) => item.productId === product.id);
    let nextCart;
    if (existing) {
      nextCart = prevCart.map((item) =>
        item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      nextCart = [...prevCart, { productId: product.id, quantity }];
    }
    persistMarketplaceState({ cart: nextCart });
  };

  const checkout = () => {
    const s = loadPersistedState();
    if (!s) return;
    const user = s.users.find((u) => u.id === s.currentUserId);
    if (!canBuy(user)) {
      window.dispatchEvent(
        new CustomEvent("cpr-notice", { detail: { message: "Enable buyer role to checkout." } })
      );
      return;
    }
    const items = cartItems;
    if (!items.length) {
      window.dispatchEvent(
        new CustomEvent("cpr-notice", { detail: { message: "Your cart is empty." } })
      );
      return;
    }
    if (!checkoutForm.address.trim()) {
      window.dispatchEvent(
        new CustomEvent("cpr-notice", { detail: { message: "Please provide delivery/pickup location." } })
      );
      return;
    }

    const orders = s.orders ?? [];
    const newOrder = {
      id: `ord-${orders.length + 1}-${items.length}`,
      buyerId: user.id,
      buyerName: user.name,
      items: items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        sellerId: item.product.sellerId,
      })),
      subtotal: cartTotal,
      deliveryMethod: checkoutForm.deliveryMethod,
      paymentMethod: checkoutForm.paymentMethod,
      paymentStatus: "unpaid",
      orderStatus: "pending",
      address: checkoutForm.address.trim(),
      notes: checkoutForm.notes.trim(),
      createdAt: `order-${orders.length + 1}`,
    };
    persistMarketplaceState({
      orders: [newOrder, ...orders],
      cart: [],
    });
    createOrderApi(newOrder).catch(() => {
      // Keep local checkout functional if API is unavailable.
    });
    setCheckoutForm((prev) => ({ ...prev, notes: "", address: "" }));
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("cpr-notice", {
        detail: { message: "Order placed. Payment will be collected on delivery/pickup." },
      })
    );
  };

  if (!open) return null;

  return (
    <section className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="surface-card max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">Buyer Checkout</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-3 font-semibold">Cart Items ({cartItems.length})</h4>
            <div className="space-y-2">
              {cartItems.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product)}
                        className="h-6 w-6 rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        aria-label={`Decrease ${item.product.name}`}
                      >
                        -
                      </button>
                      <p className="text-slate-500">Qty: {item.quantity}</p>
                      <button
                        type="button"
                        onClick={() => addToCart(item.product, 1)}
                        className="h-6 w-6 rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100"
                        aria-label={`Increase ${item.product.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="font-semibold">
                    {"\u20B1"}
                    {item.product.price * item.quantity}
                  </p>
                </div>
              ))}
              {!cartItems.length && (
                <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                  Your cart is empty.
                </p>
              )}
            </div>
            <p className="mt-3 text-sm font-semibold">
              Total: {"\u20B1"}
              {cartTotal}
            </p>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold">Delivery & Payment</h4>
            <select
              value={checkoutForm.deliveryMethod}
              onChange={(event) => {
                const deliveryMethod = event.target.value;
                setCheckoutForm((prev) => ({
                  ...prev,
                  deliveryMethod,
                  paymentMethod: deliveryMethod === "delivery" ? "cod" : "cash_pickup",
                }));
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
            </select>
            <select
              value={checkoutForm.paymentMethod}
              onChange={(event) =>
                setCheckoutForm((prev) => ({ ...prev, paymentMethod: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {checkoutForm.deliveryMethod === "delivery" ? (
                <option value="cod">Cash on Delivery (COD)</option>
              ) : (
                <option value="cash_pickup">Cash on Pickup</option>
              )}
            </select>
            <input
              value={checkoutForm.address}
              onChange={(event) =>
                setCheckoutForm((prev) => ({ ...prev, address: event.target.value }))
              }
              placeholder={
                checkoutForm.deliveryMethod === "delivery" ? "Delivery address" : "Pickup location"
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <textarea
              value={checkoutForm.notes}
              onChange={(event) =>
                setCheckoutForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="Order notes (optional)"
              className="h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button type="button" onClick={checkout} className="btn-primary px-5 py-2 text-sm">
              Place Order
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
