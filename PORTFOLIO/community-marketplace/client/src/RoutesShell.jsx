import { Route, Routes } from "react-router-dom";
import App from "./App.jsx";

/** Single shell: in-app navigation uses `activeView` + state (no `/c/.../shop` routes). */
export function RoutesShell() {
  return (
    <Routes>
      <Route path="*" element={<App />} />
    </Routes>
  );
}
