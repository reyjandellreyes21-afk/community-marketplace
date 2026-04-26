export const LANDING_DISCOVERY_CARDS = [
  {
    badge: "GRC",
    title: "Groceries and Essentials",
    description: "Find daily needs from trusted sellers in your neighborhood with quick local pickup options.",
  },
  {
    badge: "HOM",
    title: "Home and Living",
    description: "Browse furniture, appliances, and home upgrades posted by people in your area.",
  },
  {
    badge: "FAS",
    title: "Fashion and Personal",
    description: "Shop preloved and brand new fashion finds from nearby community sellers.",
  },
  {
    badge: "GAD",
    title: "Gadgets and Electronics",
    description: "Discover phones, accessories, and devices sold locally for safer meetups and faster deals.",
  },
  {
    badge: "SVS",
    title: "Local Services",
    description: "Connect with nearby service providers for repairs, errands, and home-based work.",
  },
  {
    badge: "COM",
    title: "Community Deals",
    description: "See curated listings and time-limited offers happening around your subdivision or barangay.",
  },
];

export const LANDING_DISCOVERY_SLIDE_SIZE = 3;
export const LANDING_DISCOVERY_SLIDES = Array.from(
  { length: Math.ceil(LANDING_DISCOVERY_CARDS.length / LANDING_DISCOVERY_SLIDE_SIZE) },
  (_, i) =>
    LANDING_DISCOVERY_CARDS.slice(i * LANDING_DISCOVERY_SLIDE_SIZE, i * LANDING_DISCOVERY_SLIDE_SIZE + LANDING_DISCOVERY_SLIDE_SIZE),
);

export const BROWSE_QUICK_FILTERS = [
  { id: "all", label: "All categories" },
  { id: "new", label: "New" },
  { id: "sale", label: "Sale" },
];
