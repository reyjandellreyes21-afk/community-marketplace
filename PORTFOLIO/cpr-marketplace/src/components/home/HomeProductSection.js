import HomeProductCard from "@/components/home/HomeProductCard";
import HomeProductPlaceholder from "@/components/home/HomeProductPlaceholder";

const EMPTY_GRID_SLOTS = 4;

export default function HomeProductSection({ title, products, sectionKey, onAddToCart }) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{title}</h2>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {products.length === 0
          ? Array.from({ length: EMPTY_GRID_SLOTS }, (_, i) => (
              <HomeProductPlaceholder key={`${sectionKey}-ph-${i}`} />
            ))
          : products.map((product) => (
              <HomeProductCard
                key={`${sectionKey}-${product.id}`}
                product={product}
                onAddToCart={onAddToCart}
              />
            ))}
      </div>
    </section>
  );
}
