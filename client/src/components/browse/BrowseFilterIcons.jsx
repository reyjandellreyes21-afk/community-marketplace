export const quickFilterIcon = (id) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (id === "new") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M3 12h18" />
      </svg>
    );
  }
  if (id === "sale") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M17 17h.01M6 18 18 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h5L6 11zM18 18h-5l5-5z" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
};

export const categoryIcon = (id) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  const key = String(id || "").toLowerCase();
  if (key.includes("grocer")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🛒</span>;
  if (key.includes("food")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🍽️</span>;
  if (key.includes("service")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🛠️</span>;
  if (key.includes("property") || key.includes("home")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🏠</span>;
  if (key.includes("electronic")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💻</span>;
  if (key.includes("fashion")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>👕</span>;
  if (key.includes("vehicle")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🚗</span>;
  if (key.includes("job")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💼</span>;
  if (key.includes("pet")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🐾</span>;
  if (key.includes("health") || key.includes("beauty")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>💊</span>;
  if (key.includes("baby") || key.includes("kids")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🧸</span>;
  if (key.includes("sport")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>🏀</span>;
  if (key.includes("book") || key.includes("school")) return <span className={`${cls} inline-flex items-center justify-center text-[12px]`}>📚</span>;
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
    </svg>
  );
};
