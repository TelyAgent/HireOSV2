import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { BASE_URL, api, type Me } from "./api";
import { useI18n } from "./i18n";
import { AppHeader } from "./components/Chrome";
import { LoginPage } from "./pages/LoginPage";
import { AccountPage } from "./pages/AccountPage";
import { MembersPage } from "./pages/MembersPage";

/** Signed-in area: resolves the session once, otherwise sends the visitor to sign-in and back. */
function SignedIn() {
  const { t } = useI18n();
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
        <Route
          path="/members"
          element={
            me.roles.includes("admin") ? (
              <MembersPage me={me} />
            ) : (
              <div className="page">
                <p className="muted">{t("Admins only.")}</p>
              </div>
            )
          }
        />
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
