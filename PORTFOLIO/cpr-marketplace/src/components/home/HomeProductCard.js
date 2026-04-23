export default function HomeProductCard({ product, onAddToCart }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3">
      <div
        className={`relative h-32 overflow-hidden rounded-xl ${
          product.imageDataUrl ? "bg-slate-100" : `bg-gradient-to-r ${product.imageClass}`
        }`}
      >
        {product.imageDataUrl ? (
          <img
            src={product.imageDataUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
        {product.isPromo && (
          <span className="absolute left-2 top-2 rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
            Promo
          </span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-[22px] font-semibold leading-tight text-slate-900">
        {product.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.subtitle}</p>
      <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
        <span className="text-amber-400">★</span>
        <span>{product.rating}</span>
        <span>•</span>
        <span>{product.distance}</span>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <p className="text-base font-semibold text-slate-900">
          {"\u20B1"}
          {product.price}
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {product.category}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onAddToCart(product)}
        className="mt-3 rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100"
      >
        Add to Cart
      </button>
    </article>
  );
}
