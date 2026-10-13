import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import { DEFAULT_LANDING, MEMBERS_URL } from "./api";
import { LoginPage } from "./pages/LoginPage";

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <Spin fullscreen />;
}

/**
 * The account app is only the sign-in page now: profile and member management live in each
 * subsystem's Settings. Anything else under /account/ forwards to where that lives.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/members" element={<ExternalRedirect to={MEMBERS_URL} />} />
      <Route path="*" element={<ExternalRedirect to={DEFAULT_LANDING} />} />
    </Routes>
  );
}
