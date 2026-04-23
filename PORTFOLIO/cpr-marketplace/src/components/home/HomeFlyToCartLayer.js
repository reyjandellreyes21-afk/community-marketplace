import Image from "next/image";

export default function HomeFlyToCartLayer({ flyToCartItems }) {
  if (flyToCartItems.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {flyToCartItems.map((item) => (
        <div key={item.id}>
          <span
            className="absolute flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.25)]"
            style={{
              left: item.startX,
              top: item.startY,
              transform: item.active
                ? `translate(-50%, -50%) translate(${item.endX - item.startX}px, ${item.endY - item.startY}px) scale(0.38)`
                : "translate(-50%, -50%) scale(1.02)",
              opacity: item.active ? 0.05 : 1,
              transition: "transform 850ms cubic-bezier(0.16, 0.84, 0.24, 1), opacity 850ms ease",
            }}
          >
            {item.imageSrc ? (
              <Image
                src={item.imageSrc}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                unoptimized
              />
            ) : (
              <span className="h-8 w-8 rounded-md bg-teal-100" />
            )}
          </span>
          <span
            className="absolute h-6 w-6 rounded-full border-2 border-teal-300/80 bg-teal-200/30"
            style={{
              left: item.startX,
              top: item.startY,
              transform: item.active
                ? `translate(-50%, -50%) translate(${item.endX - item.startX}px, ${item.endY - item.startY}px) scale(0.2)`
                : "translate(-50%, -50%) scale(1)",
              opacity: item.active ? 0 : 0.75,
              transition: "transform 850ms cubic-bezier(0.16, 0.84, 0.24, 1), opacity 850ms ease",
            }}
          />
        </div>
      ))}
    </div>
  );
}
