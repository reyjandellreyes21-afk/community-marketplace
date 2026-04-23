import ProductImageUploadField from "@/components/ProductImageUploadField";

export default function HomeSellerDashboardModal({
  router,
  currentUser,
  setShowSellerDashboardModal,
  createProduct,
  newProductForm,
  setNewProductForm,
  onProductImageError,
  categories,
  activeProducts,
  toggleProductStatus,
  adjustProductStock,
  deleteProduct,
  orders,
  updateOrderStatus,
}) {
  return (
    <section className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Seller Dashboard</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add and manage listings. Orders default to COD/Pickup workflow.
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-start">
            <button
              type="button"
              onClick={() => {
                setShowSellerDashboardModal(false);
                router.push("/seller-dashboard");
              }}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Seller Profile
            </button>
            <button
              type="button"
              onClick={() => setShowSellerDashboardModal(false)}
              className="shrink-0 text-sm text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createProduct} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Add Product</h3>
            <ProductImageUploadField
              value={newProductForm.imageDataUrl}
              onChange={(dataUrl) => setNewProductForm((prev) => ({ ...prev, imageDataUrl: dataUrl }))}
              onError={onProductImageError}
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
                onChange={(event) =>
                  setNewProductForm((prev) => ({ ...prev, category: event.target.value }))
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
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
                onChange={(event) =>
                  setNewProductForm((prev) => ({ ...prev, distance: event.target.value }))
                }
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

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold">Your Products</h3>
            {activeProducts
              .filter((product) => product.sellerId === currentUser?.id)
              .map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-slate-500">
                      {"\u20B1"}
                      {product.price} • {product.category}
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
                      Deactivate
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
            {!activeProducts.filter((product) => product.sellerId === currentUser?.id).length && (
              <p className="text-sm text-slate-500">No products yet.</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Order Management</h3>
          <div className="mt-3 space-y-2">
            {orders
              .filter((order) => order.items.some((item) => item.sellerId === currentUser?.id))
              .map((order) => (
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
            {!orders.filter((order) => order.items.some((item) => item.sellerId === currentUser?.id)).length && (
              <p className="text-sm text-slate-500">No seller orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
