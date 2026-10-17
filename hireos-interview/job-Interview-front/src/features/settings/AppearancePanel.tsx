import { Radio } from "antd";
import { useStore } from "../../store/StoreContext";
import type { AppState } from "../../store/types";
import { useSettingsT } from "./i18n";

/** Theme / accent / text size — same controls as the JD / Screening / Written settings pages. */
export function AppearancePanel() {
  const { state, setTheme, setAccent, setTextSize } = useStore();
  const t = useSettingsT();
  return (
    <>
      <div className="hs-field">
        <div className="hs-label">{t("Theme")}</div>
        <Radio.Group value={state.theme} onChange={(e) => setTheme(e.target.value as AppState["theme"])}>
          <Radio.Button value="light">{t("Light")}</Radio.Button>
          <Radio.Button value="dark">{t("Dark")}</Radio.Button>
          <Radio.Button value="deep">{t("Deep")}</Radio.Button>
          <Radio.Button value="system">{t("System")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="hs-field">
        <div className="hs-label">{t("Accent")}</div>
        <Radio.Group value={state.accent} onChange={(e) => setAccent(e.target.value as AppState["accent"])}>
          <Radio.Button value="blue">{t("Blue")}</Radio.Button>
          <Radio.Button value="teal">{t("Teal")}</Radio.Button>
          <Radio.Button value="violet">{t("Violet")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="hs-field">
        <div className="hs-label">{t("Text size")}</div>
        <Radio.Group value={state.textSize} onChange={(e) => setTextSize(e.target.value as AppState["textSize"])}>
          <Radio.Button value="small">{t("Small")}</Radio.Button>
          <Radio.Button value="medium">{t("Medium")}</Radio.Button>
          <Radio.Button value="large">{t("Large")}</Radio.Button>
        </Radio.Group>
      </div>
      <div
        className={`appearance-preview appearance-preview-${state.textSize}`}
        aria-live="polite"
        aria-label={t("Text size preview")}
      >
        <div className="appearance-preview-label">{t("Text size preview")}</div>
        <p>{t("Review the details below before you continue. This preview updates immediately when you change the text size.")}</p>
      </div>
    </>
  );
}
