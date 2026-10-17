import { useEffect, type ReactNode } from "react";
import { ConfigProvider } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useStore } from "../store/StoreContext";
import { useAccountLocale } from "../lib/session";

/**
 * The app language, applied where the app's own messages don't reach (#234 #238): Ant Design's built-in texts
 * (confirm buttons, empty selects, form validation) and the page's `lang` attribute, which screen readers and
 * browser translation go by. Nested inside the outer ConfigProvider, so its theme still applies. The language itself
 * is the account's (#233).
 */
export function LocaleSync({ children }: { children: ReactNode }) {
  const { state, toggleLang } = useStore();
  const zh = state.lang === "zh";
  useAccountLocale(zh ? "zh" : "en", toggleLang);
  useEffect(() => {
    document.documentElement.lang = zh ? "zh-CN" : "en";
  }, [zh]);
  return <ConfigProvider locale={zh ? zhCN : enUS}>{children}</ConfigProvider>;
}
