import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { BASE_URL, MEMBERS_URL, api, type Me } from "./api";
import { AppHeader } from "./components/Chrome";
import { LoginPage } from "./pages/LoginPage";
import { AccountPage } from "./pages/AccountPage";

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return <Spin fullscreen />;
}

/** Signed-in area: resolves the session once, otherwise sends the visitor to sign-in and back. */
function SignedIn() {
  const location = useLocation();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    api
      .me()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  if (me === undefined) return <Spin fullscreen />;
  if (me === null) {
    const here = `${BASE_URL.replace(/\/$/, "")}${location.pathname}${location.search}`;
    return <Navigate to={`/login?return_to=${encodeURIComponent(here)}`} replace />;
  }
  return (
    <>
      <AppHeader me={me} />
      <Routes>
        <Route path="/" element={<AccountPage me={me} onChange={setMe} onSignedOut={() => setMe(null)} />} />
        {/* Member management moved to the JD settings page. */}
        <Route path="/members" element={<ExternalRedirect to={MEMBERS_URL} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<SignedIn />} />
    </Routes>
  );
}
