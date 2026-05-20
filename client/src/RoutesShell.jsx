import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppBootFallback } from "./components/AppBootFallback.jsx";

const App = lazy(() => import("./App.jsx"));

/** Single shell: in-app navigation uses `activeView` + state (no `/c/.../shop` routes). */
export function RoutesShell() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <Suspense fallback={<AppBootFallback message="Loading app…" />}>
            <App />
          </Suspense>
        }
      />
    </Routes>
  );
}
