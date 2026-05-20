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
  const Icon = ({ children, viewBox = "0 0 24 24" }) => (
    <svg className={cls} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      {children}
    </svg>
  );

  if (key.includes("grocer")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5.5 4.5H3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </Icon>
    );
  }
  if (key.includes("food")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v8M12 3v8M8 7h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 3v8a2 2 0 0 1-2 2h-1v8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21v-8a2 2 0 0 1-2-2V3" />
      </Icon>
    );
  }
  if (key.includes("service")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 7a4 4 0 1 1-7 3 4 4 0 0 1 7-3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 22l6-6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11l7 7" />
      </Icon>
    );
  }
  if (key.includes("property") || key.includes("home")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v11h14V10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-6h6v6" />
      </Icon>
    );
  }
  if (key.includes("electronic")) {
    return (
      <Icon>
        <rect x="4" y="6" width="16" height="11" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 20h8" />
      </Icon>
    );
  }
  if (key.includes("fashion")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4 7 7l-3 2 3 3v8h10v-8l3-3-3-2-2-3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4h6" />
      </Icon>
    );
  }
  if (key.includes("vehicle")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l1-4a3 3 0 0 1 3-2h10a3 3 0 0 1 3 2l1 4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 16v2a2 2 0 0 0 2 2h1" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 16v2a2 2 0 0 1-2 2h-1" />
        <circle cx="8.5" cy="18" r="1.5" />
        <circle cx="15.5" cy="18" r="1.5" />
      </Icon>
    );
  }
  if (key.includes("job")) {
    return (
      <Icon>
        <rect x="4" y="7" width="16" height="13" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
      </Icon>
    );
  }
  if (key.includes("pet")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 12.5c-1.6 0-3.5 1.2-3.5 3.1 0 2.3 2 4.4 6.9 4.4S19 18 19 15.6c0-1.9-1.9-3.1-3.5-3.1-1.2 0-1.8.6-3 .6s-1.8-.6-3-.6Z" />
        <circle cx="7.5" cy="9" r="1.3" />
        <circle cx="16.5" cy="9" r="1.3" />
        <circle cx="11" cy="8" r="1.1" />
        <circle cx="13" cy="8" r="1.1" />
      </Icon>
    );
  }
  if (key.includes("health") || key.includes("beauty")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4v4h4v4h-4v4h-4v-4H6V8h4V4Z" />
      </Icon>
    );
  }
  if (key.includes("baby") || key.includes("kids")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a7 7 0 0 0-7 7v3a7 7 0 0 0 14 0v-3a7 7 0 0 0-7-7Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11h.01M15.5 11h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 15c1.2 1 3.8 1 5 0" />
      </Icon>
    );
  }
  if (key.includes("sport")) {
    return (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.7 9.5c4.2 1.2 7.1 4.1 8.3 8.3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.3 14.5c-4.2-1.2-7.1-4.1-8.3-8.3" />
      </Icon>
    );
  }
  if (key.includes("book") || key.includes("school")) {
    return (
      <Icon>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5C4 4.12 5.12 3 6.5 3H20v18H6.5A2.5 2.5 0 0 0 4 23V5.5Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8" />
      </Icon>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
    </svg>
  );
};
