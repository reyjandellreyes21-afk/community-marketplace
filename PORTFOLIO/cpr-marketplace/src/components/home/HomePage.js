"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { marketplaceCategories } from "@/data/categories";
import { initialProducts, initialUsers, withoutLegacyDemoProducts } from "@/data/seedMarketplace";
import {
  loadPersistedState,
  loadSession,
  persistMarketplaceState,
  persistSession,
} from "@/lib/cprMarketplaceStorage";
import {
  createOrderApi,
  createProductApi,
  fetchMarketplaceSnapshot,
  loginUser,
  registerUser,
} from "@/lib/marketplaceApi";
import FeaturedCategoriesSection from "@/components/home/FeaturedCategoriesSection";
import HomeAddToCartModal from "@/components/home/HomeAddToCartModal";
import HomeAuthPanel from "@/components/home/HomeAuthPanel";
import HomeFlyToCartLayer from "@/components/home/HomeFlyToCartLayer";
import HomeHeroSection from "@/components/home/HomeHeroSection";
import HomeMarketplaceNotice from "@/components/home/HomeMarketplaceNotice";
import HomeProductSection from "@/components/home/HomeProductSection";
import HomeSellerDashboardModal from "@/components/home/HomeSellerDashboardModal";
import HomeStickyHeader from "@/components/home/HomeStickyHeader";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const initialCategories = marketplaceCategories;

  const persistedState = useMemo(() => loadPersistedState(), []);
  const persistedSession = useMemo(() => loadSession(), []);
  const [categories] = useState(initialCategories);
  const [users, setUsers] = useState(persistedState?.users ?? initialUsers);
  const [products, setProducts] = useState(() =>
    withoutLegacyDemoProducts(persistedState?.products ?? initialProducts)
  );
  const [orders, setOrders] = useState(persistedState?.orders ?? []);
  const [cart, setCart] = useState(persistedState?.cart ?? []);
  const [currentUserId, setCurrentUserId] = useState(
    persistedState?.currentUserId ?? persistedSession?.userId ?? null
  );
  const [activeMode, setActiveMode] = useState(persistedState?.activeMode ?? "buyer");
  const [authMode, setAuthMode] = useState("login");
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [showSellerDashboardModal, setShowSellerDashboardModal] = useState(false);
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [pendingCartProduct, setPendingCartProduct] = useState(null);
  const [pendingCartQty, setPendingCartQty] = useState(1);
  const [flyToCartItems, setFlyToCartItems] = useState([]);
  const [authInput, setAuthInput] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [notice, setNotice] = useState("");

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
    let active = true;
    fetchMarketplaceSnapshot()
      .then((snapshot) => {
        if (!active || !snapshot) return;
        if (snapshot.users?.length) setUsers(snapshot.users);
        if (snapshot.products) setProducts(withoutLegacyDemoProducts(snapshot.products));
        if (snapshot.orders) setOrders(snapshot.orders);
      })
      .catch(() => {
        // Keep local experience when backend is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    persistMarketplaceState(
      { users, products, orders, cart, currentUserId, activeMode },
      { silent: true }
    );
  }, [users, products, orders, cart, currentUserId, activeMode]);

  useEffect(() => {
    const sync = () => {
      const s = loadPersistedState();
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
  }, []);

  useEffect(() => {
    const onNotice = (e) => setNotice(e.detail?.message ?? "");
    window.addEventListener("cpr-notice", onNotice);
    return () => window.removeEventListener("cpr-notice", onNotice);
  }, []);

  useEffect(() => {
    const onAuth = (e) => {
      setShowAuthPanel(true);
      setAuthMode("login");
      setAuthError(e.detail?.message ?? "");
    };
    window.addEventListener("cpr-require-auth", onAuth);
    return () => window.removeEventListener("cpr-require-auth", onAuth);
  }, []);

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) || null,
    [users, currentUserId]
  );

  const isAdmin = Boolean(currentUser?.roles.includes("admin"));
  const canBuy = Boolean(isAdmin || currentUser?.roles.includes("buyer"));
  const canSell = Boolean(isAdmin || currentUser?.roles.includes("seller"));
  const activeProducts = useMemo(() => products.filter((product) => product.isActive), [products]);
  const latestProducts = useMemo(
    () =>
      [...activeProducts]
        .sort((a, b) => {
          const aValue = Number((a.createdAt || "").replace(/\D/g, "")) || 0;
          const bValue = Number((b.createdAt || "").replace(/\D/g, "")) || 0;
          return bValue - aValue;
        })
        .slice(0, 4),
    [activeProducts]
  );
  const serviceProducts = useMemo(
    () => activeProducts.filter((product) => product.category === "Services"),
    [activeProducts]
  );
  const featuredCategories = categories;
  const categoryIconByName = useMemo(
    () =>
      featuredCategories.reduce((acc, category) => {
        acc[category.name] = category.icon;
        return acc;
      }, {}),
    [featuredCategories]
  );

  const visibleCount = 6;
  const categoryCount = featuredCategories.length;
  const [trackIndex, setTrackIndex] = useState(visibleCount);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const autoSlideIntervalRef = useRef(null);
  const cartButtonRef = useRef(null);
  const addToCartConfirmButtonRef = useRef(null);
  const flyToCartIdRef = useRef(0);
  const carouselItems = [
    ...featuredCategories.slice(-visibleCount),
    ...featuredCategories,
    ...featuredCategories.slice(0, visibleCount),
  ];

  const goToNextSlide = () => {
    setIsTransitionEnabled(true);
    setTrackIndex((prev) => prev + 1);
  };

  const goToPrevSlide = () => {
    setIsTransitionEnabled(true);
    setTrackIndex((prev) => prev - 1);
  };

  const restartAutoSlide = useCallback(() => {
    if (showAllCategories) {
      return;
    }
    if (autoSlideIntervalRef.current) {
      clearInterval(autoSlideIntervalRef.current);
    }
    autoSlideIntervalRef.current = setInterval(goToNextSlide, 5000);
  }, [showAllCategories]);

  const handleTrackTransitionEnd = () => {
    if (trackIndex >= categoryCount + visibleCount) {
      setIsTransitionEnabled(false);
      setTrackIndex(visibleCount);
      return;
    }

    if (trackIndex < visibleCount) {
      setIsTransitionEnabled(false);
      setTrackIndex(categoryCount + visibleCount - 1);
    }
  };

  const handleNextClick = () => {
    goToNextSlide();
    restartAutoSlide();
  };

  const handlePrevClick = () => {
    goToPrevSlide();
    restartAutoSlide();
  };

  const requireAuth = (requiredRole) => {
    if (!currentUser) {
      setShowAuthPanel(true);
      setAuthError("Please login first.");
      return false;
    }
    if (requiredRole === "buyer" && !canBuy) {
      setNotice("Enable buyer role in account controls to continue.");
      return false;
    }
    if (requiredRole === "seller" && !canSell) {
      setNotice("Enable seller role in account controls to continue.");
      return false;
    }
    return true;
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    const email = authInput.email.trim().toLowerCase();
    const password = authInput.password.trim();
    const name = authInput.name.trim();

    if (!email || !password || (authMode === "register" && !name)) {
      setAuthError("Please complete all required fields.");
      return;
    }

    if (authMode === "login") {
      try {
        const result = await loginUser({ email, password });
        const loggedUser = result.user;
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === loggedUser.id);
          return exists ? prev.map((u) => (u.id === loggedUser.id ? loggedUser : u)) : [...prev, loggedUser];
        });
        setCurrentUserId(loggedUser.id);
        setActiveMode(
          loggedUser.roles.includes("buyer") || loggedUser.roles.includes("admin") ? "buyer" : "seller"
        );
        persistSession({ token: result.token, userId: loggedUser.id });
        setShowAuthPanel(false);
        setAuthInput({ name: "", email: "", password: "" });
        setNotice(`Welcome back, ${loggedUser.name}.`);
        return;
      } catch {
        // Fallback to local auth while backend is still provisioning.
      }
      const foundUser = users.find((user) => user.email === email && user.password === password);
      if (!foundUser) {
        setAuthError("Invalid email or password.");
        return;
      }
      setCurrentUserId(foundUser.id);
      setActiveMode(
        foundUser.roles.includes("buyer") || foundUser.roles.includes("admin") ? "buyer" : "seller"
      );
      setShowAuthPanel(false);
      setAuthInput({ name: "", email: "", password: "" });
      setNotice(`Welcome back, ${foundUser.name}.`);
      return;
    }

    const emailExists = users.some((user) => user.email === email);
    if (emailExists) {
      setAuthError("Email is already registered.");
      return;
    }

    try {
      const result = await registerUser({ name, email, password });
      const createdUser = result.user;
      setUsers((prev) => [...prev, createdUser]);
      setCurrentUserId(createdUser.id);
      setActiveMode("buyer");
      persistSession({ token: result.token, userId: createdUser.id });
      setShowAuthPanel(false);
      setAuthInput({ name: "", email: "", password: "" });
      setNotice(`Account created for ${createdUser.name}.`);
      return;
    } catch {
      // Fallback to local registration during migration.
    }

    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      password,
      roles: ["buyer"],
      likes: 0,
      likedByUserIds: [],
    };
    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    setActiveMode("buyer");
    setShowAuthPanel(false);
    setAuthInput({ name: "", email: "", password: "" });
    setNotice(`Account created for ${newUser.name}.`);
  };

  const logout = () => {
    setCurrentUserId(null);
    setActiveMode("buyer");
    setCart([]);
    persistSession(null);
    setShowSellerDashboardModal(false);
    setNotice("Logged out.");
  };

  const enableRole = (role) => {
    if (!currentUser) return;
    if (role === "admin") return;
    setUsers((prev) =>
      prev.map((user) =>
        user.id === currentUser.id && !user.roles.includes(role)
          ? { ...user, roles: [...user.roles, role] }
          : user
      )
    );
    setNotice(`Role enabled: ${role}.`);
  };

  const animateToCart = (sourceElement, imageSrc) => {
    if (!sourceElement || !cartButtonRef.current) return;

    const sourceRect = sourceElement.getBoundingClientRect();
    const cartRect = cartButtonRef.current.getBoundingClientRect();
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;
    flyToCartIdRef.current += 1;
    const id = `fly-${flyToCartIdRef.current}`;

    setFlyToCartItems((prev) => [
      ...prev,
      { id, startX, startY, endX, endY, imageSrc, active: false },
    ]);

    requestAnimationFrame(() => {
      setFlyToCartItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, active: true } : item))
      );
    });

    window.setTimeout(() => {
      setFlyToCartItems((prev) => prev.filter((item) => item.id !== id));
    }, 900);
  };

  const addToCart = (product, sourceElement, quantity = 1) => {
    if (!requireAuth("buyer")) return false;
    animateToCart(sourceElement, categoryIconByName[product.category] ?? null);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { productId: product.id, quantity }];
    });
    setNotice(`${product.name} added to cart${quantity > 1 ? ` (x${quantity})` : ""}.`);
    return true;
  };

  const openAddToCartModal = (product) => {
    setPendingCartProduct(product);
    setPendingCartQty(1);
    setShowAddToCartModal(true);
  };

  const confirmAddToCart = () => {
    if (!pendingCartProduct) return;
    const added = addToCart(pendingCartProduct, addToCartConfirmButtonRef.current, pendingCartQty);
    if (added) {
      setShowAddToCartModal(false);
      setPendingCartProduct(null);
      setPendingCartQty(1);
    }
  };

  const cartItems = useMemo(
    () =>
      cart
        .map((item) => {
          const product = products.find((productItem) => productItem.id === item.productId);
          return product ? { ...item, product } : null;
        })
        .filter(Boolean),
    [cart, products]
  );

  const createProduct = async (event) => {
    event.preventDefault();
    if (!requireAuth("seller")) return;
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
    createProductApi(created).catch(() => {
      // Non-blocking while backend endpoints are rolling out.
    });
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
    if (!currentUser) return;
    setProducts((prev) =>
      prev.map((product) =>
        product.id === productId && product.sellerId === currentUser.id
          ? { ...product, isActive: !product.isActive }
          : product
      )
    );
  };

  const adjustProductStock = (productId, delta) => {
    if (!requireAuth("seller")) return;
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
    if (!requireAuth("seller")) return;
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

  useEffect(() => {
    if (showAllCategories) {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current);
      }
      return;
    }

    restartAutoSlide();
    return () => {
      if (autoSlideIntervalRef.current) {
        clearInterval(autoSlideIntervalRef.current);
      }
    };
  }, [showAllCategories, restartAutoSlide]);

  useEffect(() => {
    if (!isTransitionEnabled) {
      const frameId = requestAnimationFrame(() => {
        setIsTransitionEnabled(true);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [isTransitionEnabled]);

  if (!isClient) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <HomeStickyHeader
        pathname={pathname}
        router={router}
        cartButtonRef={cartButtonRef}
        cartItems={cartItems}
        currentUser={currentUser}
        showNavMenu={showNavMenu}
        setShowNavMenu={setShowNavMenu}
        setShowAuthPanel={setShowAuthPanel}
        setAuthMode={setAuthMode}
        setAuthError={setAuthError}
        setShowSellerDashboardModal={setShowSellerDashboardModal}
        logout={logout}
      />

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-12 md:px-10">
        <HomeMarketplaceNotice notice={notice} onDismiss={() => setNotice("")} />

        {showAuthPanel && (
          <HomeAuthPanel
            authMode={authMode}
            authInput={authInput}
            setAuthInput={setAuthInput}
            authError={authError}
            onSubmit={handleAuthSubmit}
            onClose={() => setShowAuthPanel(false)}
            setAuthMode={setAuthMode}
          />
        )}

        {showAddToCartModal && pendingCartProduct && (
          <HomeAddToCartModal
            pendingCartProduct={pendingCartProduct}
            pendingCartQty={pendingCartQty}
            setPendingCartQty={setPendingCartQty}
            categoryIconByName={categoryIconByName}
            addToCartConfirmButtonRef={addToCartConfirmButtonRef}
            onClose={() => setShowAddToCartModal(false)}
            onConfirm={confirmAddToCart}
          />
        )}

        <HomeFlyToCartLayer flyToCartItems={flyToCartItems} />

        {showSellerDashboardModal && currentUser && canSell && (
          <HomeSellerDashboardModal
            router={router}
            currentUser={currentUser}
            setShowSellerDashboardModal={setShowSellerDashboardModal}
            createProduct={createProduct}
            newProductForm={newProductForm}
            setNewProductForm={setNewProductForm}
            onProductImageError={(message) => setNotice(message)}
            categories={categories}
            activeProducts={activeProducts}
            toggleProductStatus={toggleProductStatus}
            adjustProductStock={adjustProductStock}
            deleteProduct={deleteProduct}
            orders={orders}
            updateOrderStatus={updateOrderStatus}
          />
        )}

        <HomeHeroSection
          currentUser={currentUser}
          canSell={canSell}
          canBuy={canBuy}
          enableRole={enableRole}
          setShowAuthPanel={setShowAuthPanel}
          setAuthMode={setAuthMode}
        />

        <FeaturedCategoriesSection
          featuredCategories={featuredCategories}
          showAllCategories={showAllCategories}
          setShowAllCategories={setShowAllCategories}
          carouselItems={carouselItems}
          visibleCount={visibleCount}
          trackIndex={trackIndex}
          isTransitionEnabled={isTransitionEnabled}
          handleTrackTransitionEnd={handleTrackTransitionEnd}
          handlePrevClick={handlePrevClick}
          handleNextClick={handleNextClick}
        />

        <HomeProductSection
          title="Popular Products"
          products={activeProducts}
          sectionKey="popular"
          onAddToCart={openAddToCartModal}
        />

        <HomeProductSection
          title="Latest Products"
          products={latestProducts}
          sectionKey="latest"
          onAddToCart={openAddToCartModal}
        />

        <HomeProductSection
          title="Services"
          products={serviceProducts}
          sectionKey="services"
          onAddToCart={openAddToCartModal}
        />
      </main>
    </div>
  );
}
