import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { ScreenLoading } from "./components/ui/ScreenState.jsx";

const App = lazy(() => import("./App.jsx"));

/** Single shell: in-app navigation uses `activeView` + state (no `/c/.../shop` routes). */
export function RoutesShell() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <Suspense
            fallback={
              <div className="flex min-h-[100dvh] items-center justify-center bg-white dark:bg-slate-950">
                <ScreenLoading message="Loading app…" spacious className="w-full max-w-none border-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]" />
              </div>
            }
          >
            <App />
          </Suspense>
        }
      />
    </Routes>
  );
}
