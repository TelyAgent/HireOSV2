import { useState } from "react";
import { App as AntApp, Button, Card, Descriptions, Input, Space, Tag } from "antd";
import { ROOT_URL, api, type Me } from "../api";
import { useI18n } from "../i18n";
import { Avatar } from "../components/Chrome";

const SUBSYSTEMS = [
  { path: "screening/", label: "Screening" },
  { path: "jd/", label: "Jobs" },
  { path: "interview/", label: "Interview" },
  { path: "written/", label: "Written test" },
];

export function AccountPage({ me, onChange, onSignedOut }: { me: Me; onChange: (me: Me) => void; onSignedOut: () => void }) {
  const { t } = useI18n();
  const { message } = AntApp.useApp();
  const [name, setName] = useState(me.user.displayName);
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    setSaving(true);
    try {
      onChange(await api.updateMe({ displayName: name.trim() }));
      message.success(t("Saved"));
    } catch {
      message.error(t("Something went wrong — please try again."));
    } finally {
      setSaving(false);
    }
  };

  const signOut = async (everywhere: boolean) => {
    try {
      await (everywhere ? api.logoutAll() : api.logout());
      if (everywhere) message.success(t("Signed out of all devices"));
    } finally {
      onSignedOut();
    }
  };

  return (
    <div className="page">
      <Card>
        <div className="profile-head">
          <Avatar name={me.user.displayName} color={me.user.avatarColor} size={56} />
          <div>
            <div className="profile-name">{me.user.displayName}</div>
            <div className="muted">{me.user.email}</div>
          </div>
        </div>
        <Descriptions column={1} size="middle" style={{ marginTop: 20 }}>
          <Descriptions.Item label={t("Name")}>
            <Space.Compact style={{ maxWidth: 360, width: "100%" }}>
              <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
              <Button type="primary" loading={saving} disabled={!name.trim() || name.trim() === me.user.displayName} onClick={saveName}>
                {t("Save")}
              </Button>
            </Space.Compact>
          </Descriptions.Item>
          <Descriptions.Item label={t("Workspace")}>{me.workspace.name}</Descriptions.Item>
          <Descriptions.Item label={t("Roles")}>
            {me.roles.map((role) => (
              <Tag key={role} color={role === "admin" ? "gold" : role === "hr" ? "cyan" : "purple"}>
                {t(role)}
              </Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label={t("Go to")}>
            <Space wrap>
              {SUBSYSTEMS.map((s) => (
                <Button key={s.path} href={`${ROOT_URL}${s.path}`}>
                  {t(s.label)}
                </Button>
              ))}
            </Space>
          </Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 12 }}>
          <Button onClick={() => void signOut(false)}>{t("Sign out")}</Button>
          <Button danger onClick={() => void signOut(true)}>
            {t("Sign out of all devices")}
          </Button>
        </Space>
      </Card>
    </div>
  );
}
