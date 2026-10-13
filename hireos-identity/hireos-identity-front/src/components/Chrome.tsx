import { useI18n } from "../i18n";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">H</span>
      <span className="brand-name">HireOS Command</span>
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button type="button" className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
      EN / 中
    </button>
  );
}
