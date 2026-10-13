import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App as AntApp, ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { App } from "./App";
import { I18nProvider, useI18n } from "./i18n";
import "./styles.css";

function Themed() {
  const { lang } = useI18n();
  return (
    <ConfigProvider locale={lang === "zh" ? zhCN : enUS} theme={{ token: { colorPrimary: "#0d9488", borderRadius: 10 } }}>
      <AntApp>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <Themed />
    </I18nProvider>
  </StrictMode>,
);
