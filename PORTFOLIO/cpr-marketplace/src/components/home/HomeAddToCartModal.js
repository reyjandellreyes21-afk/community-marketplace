import Image from "next/image";

export default function HomeAddToCartModal({
  pendingCartProduct,
  pendingCartQty,
  setPendingCartQty,
  categoryIconByName,
  addToCartConfirmButtonRef,
  onClose,
  onConfirm,
}) {
  if (!pendingCartProduct) return null;
  return (
    <section className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add to Cart</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Close
          </button>
        </div>
        <article className="rounded-2xl border border-slate-200 bg-white p-3">
          <div
            className={`relative h-32 overflow-hidden rounded-xl ${
              pendingCartProduct.imageDataUrl ? "bg-slate-100" : `bg-gradient-to-r ${pendingCartProduct.imageClass}`
            }`}
          >
            {pendingCartProduct.imageDataUrl ? (
              <img
                src={pendingCartProduct.imageDataUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : null}
            {pendingCartProduct.isPromo && (
              <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
                Promo
              </span>
            )}
            {!pendingCartProduct.imageDataUrl && (
              <div className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-lg bg-white/85">
                <Image
                  src={categoryIconByName[pendingCartProduct.category] ?? "/icons/categories/food.png"}
                  alt={pendingCartProduct.name}
                  width={24}
                  height={24}
                  unoptimized
                />
              </div>
            )}
          </div>
          <h3 className="mt-3 line-clamp-2 text-[30px] font-semibold leading-tight text-slate-900">
            {pendingCartProduct.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{pendingCartProduct.subtitle}</p>
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
            <span className="text-amber-400">★</span>
            <span>{pendingCartProduct.rating}</span>
            <span>•</span>
            <span>{pendingCartProduct.distance}</span>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <p className="text-base font-semibold text-slate-900">
              {"\u20B1"}
              {pendingCartProduct.price}
            </p>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              {pendingCartProduct.category}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Quantity</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingCartQty((prev) => Math.max(1, prev - 1))}
                className="h-8 w-8 rounded-full border border-slate-300 text-base font-bold text-slate-700 hover:bg-slate-100"
              >
                -
              </button>
              <p className="w-6 text-center text-sm font-semibold">{pendingCartQty}</p>
              <button
                type="button"
                onClick={() => setPendingCartQty((prev) => prev + 1)}
                className="h-8 w-8 rounded-full border border-slate-300 text-base font-bold text-slate-700 hover:bg-slate-100"
              >
                +
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Subtotal:{" "}
              <span className="font-semibold text-slate-900">
                {"\u20B1"}
                {pendingCartProduct.price * pendingCartQty}
              </span>
            </p>
            <button
              ref={addToCartConfirmButtonRef}
              type="button"
              onClick={onConfirm}
              className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
            >
              Add to Cart
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}
