"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import SiteHeader from "@/components/SiteHeader";
import ProductImageUploadField from "@/components/ProductImageUploadField";
import { persistMarketplaceState } from "@/lib/cprMarketplaceStorage";
import {
  getSellerLikeCount,
  hasViewerLikedSeller,
  registerSellerLike,
  unregisterSellerLike,
} from "@/lib/sellerLikes";

const STORAGE_KEY = "cpr-marketplace-state-v1";

const defaultCategories = [
  "Food",
  "Services",
  "Apparel",
  "Bags",
  "Beauty",
  "Beverages",
  "Electronics",
  "Fashion",
  "Fresh Produce",
  "Gardening",
  "Gifts",
  "Home Decor",
  "Home Furniture",
  "Housewares",
  "Office Supplies",
  "Packaging",
  "Personal Care",
  "Shoes",
  "Souvenirs",
  "Toys",
];

const loadState = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export default function SellerDashboardPage() {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const persistedState = useMemo(() => loadState(), []);
  const [users, setUsers] = useState(persistedState?.users ?? []);
  const [products, setProducts] = useState(persistedState?.products ?? []);
  const [orders, setOrders] = useState(persistedState?.orders ?? []);
  const [cart, setCart] = useState(persistedState?.cart ?? []);
  const [currentUserId, setCurrentUserId] = useState(persistedState?.currentUserId ?? null);
  const [activeMode, setActiveMode] = useState(persistedState?.activeMode ?? "seller");
  const [notice, setNotice] = useState("");
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    name: "",
    address: "",
    contactNo: "",
  });
  const [newProductForm, setNewProductForm] = useState({
    name: "",
    subtitle: "",
    category: "Food",
    price: "",
    distance: "2.0 km",
    isPromo: false,
    imageDataUrl: null,
  });

  useEffect(() => {
    if (!isClient) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        users,
        products,
        orders,
        cart,
        currentUserId,
        activeMode,
      })
    );
  }, [isClient, users, products, orders, cart, currentUserId, activeMode]);

  useEffect(() => {
    if (!isClient) return;
    const sync = () => {
      const s = loadState();
      if (!s) return;
      if (s.users) setUsers(s.users);
      if (s.products) setProducts(s.products);
      if (s.orders) setOrders(s.orders);
      if (s.cart) setCart(s.cart);
      if (s.currentUserId !== undefined) setCurrentUserId(s.currentUserId);
      if (s.activeMode) setActiveMode(s.activeMode);
    };
    window.addEventListener("cpr-marketplace-state-changed", sync);
    return () => window.removeEventListener("cpr-marketplace-state-changed", sync);
  }, [isClient]);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [users, currentUserId]
  );

  const canSell = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.roles?.includes("seller") || currentUser.roles?.includes("admin");
  }, [currentUser]);

  const categoryOptions = useMemo(() => {
    const fromProducts = products.map((product) => product.category).filter(Boolean);
    return Array.from(new Set([...defaultCategories, ...fromProducts]));
  }, [products]);

  const sellerProducts = useMemo(() => {
    if (!currentUser) return [];
    return products
      .filter((product) => product.sellerId === currentUser.id)
      .sort((a, b) => {
        const aValue = Number((a.createdAt || "").replace(/\D/g, "")) || 0;
        const bValue = Number((b.createdAt || "").replace(/\D/g, "")) || 0;
        return bValue - aValue;
      });
  }, [products, currentUser]);

  const sellerOrders = useMemo(() => {
    if (!currentUser) return [];
    return orders.filter((order) =>
      order.items?.some((item) => item.sellerId === currentUser.id)
    );
  }, [orders, currentUser]);
  const sellerAddress = (currentUser?.address ?? "").trim() || "Not set yet";
  const sellerContactNo =
    (currentUser?.contactNo ?? currentUser?.phone ?? "").trim() || "Not set yet";
  const sellerAvatar = currentUser?.profileImage?.trim() || "";
  const sellerLikes = getSellerLikeCount(currentUser);
  const profileLikedByViewer =
    Boolean(currentUser && currentUserId && hasViewerLikedSeller(currentUser, currentUserId));

  const handleProfileLikeClick = () => {
    if (!currentUser || !currentUserId) return;
    const nextUsers = profileLikedByViewer
      ? unregisterSellerLike(users, currentUser.id, currentUserId)
      : registerSellerLike(users, currentUser.id, currentUserId);
    persistMarketplaceState({ users: nextUsers });
    setUsers(nextUsers);
  };

  const openProfileEdit = () => {
    if (!currentUser) return;
    setProfileDraft({
      name: currentUser.name ?? "",
      address: (currentUser.address ?? "").trim(),
      contactNo: (currentUser.contactNo ?? currentUser.phone ?? "").trim(),
    });
    setShowProfileEdit(true);
  };

  const saveProfileEdit = (event) => {
    event.preventDefault();
    if (!currentUser || !canSell) return;
    const name = profileDraft.name.trim();
    if (!name) {
      setNotice("Name is required.");
      return;
    }
    const address = profileDraft.address.trim();
    const contactNo = profileDraft.contactNo.trim();

    setUsers((prev) =>
      prev.map((user) =>
        user.id === currentUser.id
          ? { ...user, name, address, contactNo, phone: contactNo }
          : user
      )
    );
    setProducts((prev) =>
      prev.map((product) =>
        product.sellerId === currentUser.id ? { ...product, sellerName: name } : product
      )
    );
    setShowProfileEdit(false);
    setNotice("Profile updated.");
  };

  const createProduct = (event) => {
    event.preventDefault();
    if (!currentUser || !canSell) return;
    if (!newProductForm.name.trim() || !newProductForm.price.trim()) {
      setNotice("Product name and price are required.");
      return;
    }

    const parsedPrice = Number(newProductForm.price);
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setNotice("Enter a valid positive price.");
      return;
    }

    const created = {
      id: `p-${Date.now()}`,
      sellerId: currentUser.id,
      sellerName: currentUser.name,
      name: newProductForm.name.trim(),
      subtitle: newProductForm.subtitle.trim() || "Local marketplace product",
      rating: "0.0",
      distance: newProductForm.distance.trim() || "0.0 km",
      price: parsedPrice,
      category: newProductForm.category,
      isPromo: newProductForm.isPromo,
      stock: 10,
      imageClass: "from-slate-200 via-slate-100 to-slate-50",
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    if (newProductForm.imageDataUrl) {
      created.imageDataUrl = newProductForm.imageDataUrl;
    }

    setProducts((prev) => [created, ...prev]);
    setNewProductForm({
      name: "",
      subtitle: "",
      category: "Food",
      price: "",
      distance: "2.0 km",
      isPromo: false,
      imageDataUrl: null,
    });
    setNotice("Product created successfully.");
  };

  const toggleProductStatus = (productId) => {
    if (!currentUser || !canSell) return;
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId && product.sellerId === currentUser.id
          ? { ...product, isActive: !product.isActive }
          : product
      )
    );
  };

  const adjustProductStock = (productId, delta) => {
    if (!currentUser || !canSell) return;
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId && product.sellerId === currentUser.id
          ? {
              ...product,
              stock: Math.max(0, (Number(product.stock) || 0) + delta),
            }
          : product
      )
    );
  };

  const deleteProduct = (productId) => {
    if (!currentUser || !canSell) return;
    setProducts((prev) =>
      prev.filter((product) => !(product.id === productId && product.sellerId === currentUser.id))
    );
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setNotice("Product removed.");
  };

  const updateOrderStatus = (orderId, orderStatus, paymentStatus) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? { ...order, orderStatus, paymentStatus: paymentStatus ?? order.paymentStatus }
          : order
      )
    );
  };

  if (!isClient) {
    return <div className="min-h-screen bg-white" />;
  }

  if (!currentUser || !canSell) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader activePage="" />
        <main className="mx-auto w-full max-w-4xl px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">Seller access required</h1>
            <p className="mt-2 text-sm text-slate-500">
              Please login with a seller/admin account from the home page.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-500"
            >
              Back to Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader activePage="" />
      <main className="mx-auto w-full max-w-7xl px-6 py-8 md:px-8">
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex shrink-0 flex-col items-center gap-3 sm:items-start">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-2xl font-semibold text-slate-600">
                {sellerAvatar ? (
                  <img src={sellerAvatar} alt={`${currentUser.name} profile`} className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden>{currentUser.name?.charAt(0).toUpperCase() || "U"}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleProfileLikeClick}
                  title={profileLikedByViewer ? "Unlike this profile" : "Like this profile"}
                  aria-label={profileLikedByViewer ? "Unlike seller profile" : "Like seller profile"}
                  aria-pressed={profileLikedByViewer}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition-colors ${
                    profileLikedByViewer
                      ? "cursor-pointer border-teal-600 bg-teal-600 text-white shadow-sm hover:bg-teal-700"
                      : "border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <span aria-hidden>♥</span>
                </button>
                <button
                  type="button"
                  onClick={openProfileEdit}
                  aria-label="Edit seller profile"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-sm text-slate-700 hover:bg-slate-100"
                >
                  ✎
                </button>
              </div>
            </div>
            <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-left text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Name:</span>
              <span className="break-words">{currentUser.name}</span>
              <span className="font-semibold text-slate-900">Address:</span>
              <span className="break-words">{sellerAddress}</span>
              <span className="font-semibold text-slate-900">Contact no:</span>
              <span className="break-words">{sellerContactNo}</span>
              <span className="font-semibold text-slate-900">Likes:</span>
              <span className="tabular-nums">{sellerLikes}</span>
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Seller Profile</h1>
            <p className="mt-1 text-sm text-slate-500">
              Fullscreen profile for managing all listings and orders.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to Marketplace
          </Link>
        </div>

        {notice && (
          <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            {notice}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createProduct} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Add Product</h2>
          <ProductImageUploadField
            value={newProductForm.imageDataUrl}
            onChange={(dataUrl) => setNewProductForm((prev) => ({ ...prev, imageDataUrl: dataUrl }))}
            onError={(message) => setNotice(message)}
          />
          <input
            value={newProductForm.name}
            onChange={(event) => setNewProductForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Product name"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={newProductForm.subtitle}
            onChange={(event) => setNewProductForm((prev) => ({ ...prev, subtitle: event.target.value }))}
            placeholder="Description"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newProductForm.category}
              onChange={(event) => setNewProductForm((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              value={newProductForm.price}
              onChange={(event) => setNewProductForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="Price"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newProductForm.distance}
              onChange={(event) => setNewProductForm((prev) => ({ ...prev, distance: event.target.value }))}
              placeholder="Distance"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={newProductForm.isPromo}
                onChange={(event) =>
                  setNewProductForm((prev) => ({ ...prev, isPromo: event.target.checked }))
                }
              />
              Promo listing
            </label>
          </div>
          <button
            type="submit"
            className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Save Product
          </button>
          </form>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Your Products ({sellerProducts.length})</h2>
          {sellerProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{product.name}</p>
                <p className="text-slate-500">
                  {"\u20B1"}
                  {product.price} • {product.category} • {product.isActive ? "Active" : "Inactive"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Qty</span>
                <div className="inline-flex items-center rounded-full border border-slate-300">
                  <button
                    type="button"
                    aria-label="Decrease stock"
                    onClick={() => adjustProductStock(product.id, -1)}
                    className="px-2 py-1 text-sm leading-none hover:bg-slate-100"
                  >
                    −
                  </button>
                  <span className="min-w-[2rem] px-1 text-center text-xs font-semibold tabular-nums">
                    {Number(product.stock) || 0}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase stock"
                    onClick={() => adjustProductStock(product.id, 1)}
                    className="px-2 py-1 text-sm leading-none hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleProductStatus(product.id)}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold hover:bg-slate-100"
                >
                  {product.isActive ? "Deactivate" : "Activate"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteProduct(product.id)}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {!sellerProducts.length && <p className="text-sm text-slate-500">No products yet.</p>}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Order Management</h2>
          <div className="mt-3 space-y-2">
            {sellerOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <p className="font-medium">
                  {order.id} • {order.buyerName}
                </p>
                <p className="text-slate-500">
                  {order.deliveryMethod} • {order.paymentMethod} • payment: {order.paymentStatus}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, "confirmed")}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => updateOrderStatus(order.id, "completed", "paid")}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100"
                  >
                    Mark Paid + Complete
                  </button>
                </div>
              </div>
            ))}
            {!sellerOrders.length && <p className="text-sm text-slate-500">No seller orders yet.</p>}
          </div>
        </section>

        {showProfileEdit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
            onClick={() => setShowProfileEdit(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-edit-title"
            >
              <h3 id="profile-edit-title" className="text-lg font-semibold text-slate-900">
                Edit profile
              </h3>
              <form onSubmit={saveProfileEdit} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="profile-name" className="block text-xs font-medium text-slate-600">
                    Name
                  </label>
                  <input
                    id="profile-name"
                    value={profileDraft.name}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({ ...draft, name: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="profile-address" className="block text-xs font-medium text-slate-600">
                    Address
                  </label>
                  <input
                    id="profile-address"
                    value={profileDraft.address}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({ ...draft, address: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="profile-contact" className="block text-xs font-medium text-slate-600">
                    Contact no.
                  </label>
                  <input
                    id="profile-contact"
                    value={profileDraft.contactNo}
                    onChange={(event) =>
                      setProfileDraft((draft) => ({ ...draft, contactNo: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="submit"
                    className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProfileEdit(false)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

