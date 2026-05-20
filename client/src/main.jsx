import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { ViewportProvider } from "./context/ViewportContext.jsx";
import { RoutesShell } from "./RoutesShell.jsx";

/** Matches `vite.config.js` `base` — required when the app is hosted under a subpath (e.g. `/linkmart/`). */
function routerBasename() {
  const raw = import.meta.env.BASE_URL ?? "/";
  if (raw === "/" || raw === "" || raw === "./") return undefined;
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === ".") return undefined;
  return trimmed;
}

registerSW({ immediate: true });

if (Capacitor.isNativePlatform()) {
  void SplashScreen.hide();
  void StatusBar.setStyle({ style: Style.Light });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ViewportProvider>
      <BrowserRouter basename={routerBasename()}>
        <RoutesShell />
      </BrowserRouter>
    </ViewportProvider>
  </StrictMode>,
);
