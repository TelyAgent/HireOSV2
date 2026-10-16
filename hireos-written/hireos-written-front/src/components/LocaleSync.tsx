import { useEffect, type ReactNode } from "react";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useStore } from "../store/StoreContext";
import { setDisplayLang } from "../data/fixtures";

/**
 * The app language, applied where the app's own messages don't reach (#234 #238): Ant Design's built-in texts
 * (confirm buttons, empty selects, form validation) and the page's `lang` attribute, which screen readers and
 * browser translation go by. Nested inside the outer ConfigProvider, so its theme still applies.
 */
export function LocaleSync({ children }: { children: ReactNode }) {
  const { state } = useStore();
  const zh = state.lang === "zh";
  // Before children render, so every date in this render is written in the current language (#237).
  setDisplayLang(zh ? "zh" : "en");
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
  }, [zh]);
  return <ConfigProvider locale={zh ? zhCN : enUS}>{children}</ConfigProvider>;
}
