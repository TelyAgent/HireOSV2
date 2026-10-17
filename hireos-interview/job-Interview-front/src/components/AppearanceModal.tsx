import { Button, Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { AppearancePanel } from "../features/settings/AppearancePanel";
import { useSettingsT } from "../features/settings/i18n";

/** Top-bar Appearance dialog — same content and layout as the other subsystems' (Screening is the reference). */
export function AppearanceModal() {
  const { state, resetPrefs, toggleAppearance } = useStore();
  const t = useSettingsT();
  return (
    <Modal
      open={state.showAppearance}
      onCancel={toggleAppearance}
      title={t("Appearance")}
      className={`appearance-modal appearance-${state.textSize}`}
      width={640}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button type="text" onClick={resetPrefs}>
            {t("Reset to defaults")}
          </Button>
          <Button type="primary" onClick={toggleAppearance}>
            {t("Done")}
          </Button>
        </div>
      }
    >
      <AppearancePanel />
      <p className="hs-tiny">
        {t("Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.")}
      </p>
    </Modal>
  );
}
