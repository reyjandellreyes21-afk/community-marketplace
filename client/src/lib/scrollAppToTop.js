/**
 * Reset the app scroll surface(s): `#main-content` on mobile and `window` on desktop.
 * Call after primary navigation changes so each destination starts at the top.
 */
export function scrollAppToTop() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    const main = document.getElementById("main-content");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  });
}
