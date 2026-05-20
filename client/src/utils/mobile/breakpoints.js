/**
 * Breakpoints aligned with Tailwind defaults (`md:` = 768px) and mobile-specific media used in the shell.
 */
export const MOBILE_MAX_WIDTH_PX = 767;

export const mediaQueries = {
  /** Phone / narrow layouts — matches `(max-width: 767px)` checks in the app shell. */
  mobile: `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`,
  mdUp: `(min-width: 768px)`,
};
