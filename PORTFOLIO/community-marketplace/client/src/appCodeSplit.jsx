import { lazy, Suspense } from "react";

/** Shared skeleton while product-detail chunks load (cart, orders, quick-add). */
const productDetailFallback = (
  <div
    className="min-h-[5rem] animate-pulse rounded-lg bg-neutral-100/90 dark:bg-slate-800/80"
    aria-hidden
  />
);

const LazyMarketplaceProductDetailStack = lazy(() =>
  import("./components/marketplace/MarketplaceProductDetailStack.jsx").then((m) => ({
    default: m.MarketplaceProductDetailStack,
  })),
);

/** Lazy-loaded stack + Suspense boundary — keeps initial JS smaller on mobile. */
export function DeferredProductDetailStack(props) {
  return (
    <Suspense fallback={productDetailFallback}>
      <LazyMarketplaceProductDetailStack {...props} />
    </Suspense>
  );
}

export const LazyPublicListingPage = lazy(() =>
  import("./components/PublicListingPage.jsx").then((m) => ({ default: m.PublicListingPage })),
);

export const LazyLandingIllustration = lazy(() =>
  import("./components/landing/LandingIllustration.jsx").then((m) => ({ default: m.LandingIllustration })),
);

export const LazyCommunityShopListingCard = lazy(() =>
  import("./components/marketplace/CommunityShopListingCard.jsx").then((m) => ({
    default: m.CommunityShopListingCard,
  })),
);

export const LazyProductInspectModal = lazy(() =>
  import("./components/marketplace/ProductInspectModal.jsx").then((m) => ({ default: m.ProductInspectModal })),
);

export const LazyOrderBuyerReviewForm = lazy(() =>
  import("./components/marketplace/OrderBuyerReviewForm.jsx").then((m) => ({ default: m.OrderBuyerReviewForm })),
);

export const LazyCourierDeliveryReviewForm = lazy(() =>
  import("./components/marketplace/CourierDeliveryReviewForm.jsx").then((m) => ({ default: m.CourierDeliveryReviewForm })),
);

export const LazySellerBuyerFeedbackList = lazy(() =>
  import("./components/marketplace/SellerBuyerFeedbackList.jsx").then((m) => ({
    default: m.SellerBuyerFeedbackList,
  })),
);

export const LazyCourierBuyerFeedbackList = lazy(() =>
  import("./components/marketplace/CourierBuyerFeedbackList.jsx").then((m) => ({
    default: m.CourierBuyerFeedbackList,
  })),
);
