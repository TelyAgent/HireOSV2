import { useCallback, useEffect, useState } from "react";
import { App as AntApp, Button, Card, Checkbox, Form, Input, Modal, Space, Table, Tag } from "antd";
import { ApiError, api, type Me, type Member, type Role } from "../api";
import { useI18n } from "../i18n";
import { Avatar } from "../components/Chrome";

const ROLES: Role[] = ["admin", "hr", "interviewer"];
const ROLE_COLOR: Record<Role, string> = { admin: "gold", hr: "cyan", interviewer: "purple" };

const ERROR_TEXT: Record<string, string> = {
  ROLES_REQUIRED: "Pick at least one role.",
  INVALID_EMAIL: "Enter a valid email address.",
  ALREADY_MEMBER: "This email is already a member.",
  LAST_ADMIN: "The workspace needs at least one active admin.",
  CANNOT_DISABLE_SELF: "You cannot disable your own account.",
  CANNOT_REMOVE_SELF: "You cannot remove yourself.",
};

type InviteForm = { email: string; displayName: string; roles: Role[]; sendEmail: boolean };
type EditForm = { displayName: string; roles: Role[] };

export function MembersPage({ me }: { me: Me }) {
  const { t, lang } = useI18n();
  const { message, modal } = AntApp.useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [inviteForm] = Form.useForm<InviteForm>();
  const [editForm] = Form.useForm<EditForm>();

  const load = useCallback(() => {
    setLoading(true);
    api
      .members()
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const fail = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    message.error(t(ERROR_TEXT[code] ?? "Something went wrong — please try again."));
  };

  const submitInvite = async (values: InviteForm) => {
    try {
      const result = await api.invite(values);
      if (values.sendEmail && !result.emailSent) message.warning(t("Invited — the invitation email could not be sent"));
      else message.success(t("Invitation sent"));
      setInviting(false);
      inviteForm.resetFields();
      load();
    } catch (err) {
      fail(err);
    }
  };

  const submitEdit = async (values: EditForm) => {
    if (!editing) return;
    try {
      await api.updateMember(editing.id, values);
      message.success(t("Saved"));
      setEditing(null);
      load();
    } catch (err) {
      fail(err);
    }
  };

  const setStatus = (member: Member, status: "active" | "disabled") => {
    const run = async () => {
      try {
        await api.updateMember(member.id, { status });
        load();
      } catch (err) {
        fail(err);
      }
    };
    if (status === "active") return void run();
    modal.confirm({
      title: t("Disable"),
      content: t("Disable {name}? They are signed out everywhere immediately.", { name: member.displayName }),
      okButtonProps: { danger: true },
      okText: t("Disable"),
      cancelText: t("Cancel"),
      onOk: run,
    });
  };

  const remove = (member: Member) => {
    modal.confirm({
      title: t("Remove"),
      content: t("Remove {name} from the workspace? They will no longer be able to sign in.", { name: member.displayName }),
      okButtonProps: { danger: true },
      okText: t("Remove"),
      cancelText: t("Cancel"),
      onOk: async () => {
        try {
          await api.removeMember(member.id);
          load();
        } catch (err) {
          fail(err);
        }
      },
    });
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { dateStyle: "medium", timeStyle: "short" }) : t("Never");

  return (
    <div className="page">
      <Card
        title={t("Members")}
        extra={
          <Button type="primary" onClick={() => setInviting(true)}>
            {t("Invite member")}
          </Button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          {t("Only invited emails can sign in.")}
        </p>
        <Table<Member>
          rowKey="id"
          loading={loading}
          dataSource={members}
          pagination={false}
          scroll={{ x: 720 }}
          columns={[
            {
              title: t("Name"),
              render: (_, m) => (
                <Space>
                  <Avatar name={m.displayName} color={m.avatarColor} />
                  <div>
                    <div>
                      {m.displayName}
                      {m.id === me.user.id && <span className="muted"> ({t("You")})</span>}
                    </div>
                    <div className="muted small">{m.email}</div>
                  </div>
                </Space>
              ),
            },
            {
              title: t("Roles"),
              render: (_, m) =>
                m.roles.map((role) => (
                  <Tag key={role} color={ROLE_COLOR[role]}>
                    {t(role)}
                  </Tag>
                )),
            },
            {
              title: t("Status"),
              render: (_, m) =>
                m.status === "disabled" ? (
                  <Tag color="red">{t("Disabled")}</Tag>
                ) : m.membershipStatus === "invited" ? (
                  <Tag color="blue">{t("Invited")}</Tag>
                ) : (
                  <Tag color="green">{t("Active")}</Tag>
                ),
            },
            { title: t("Last sign-in"), render: (_, m) => <span className="muted">{formatDate(m.lastLoginAt)}</span> },
            {
              title: "",
              align: "right",
              render: (_, m) => (
                <Space size={4}>
                  <Button
                    size="small"
                    onClick={() => {
                      setEditing(m);
                      editForm.setFieldsValue({ displayName: m.displayName, roles: m.roles });
                    }}
                  >
                    {t("Edit")}
                  </Button>
                  {m.id !== me.user.id &&
                    (m.status === "disabled" ? (
                      <Button size="small" onClick={() => setStatus(m, "active")}>
                        {t("Enable")}
                      </Button>
                    ) : (
                      <Button size="small" danger onClick={() => setStatus(m, "disabled")}>
                        {t("Disable")}
                      </Button>
                    ))}
                  {m.id !== me.user.id && (
                    <Button size="small" type="text" danger onClick={() => remove(m)}>
                      {t("Remove")}
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={inviting}
        title={t("Invite member")}
        okText={t("Invite")}
        cancelText={t("Cancel")}
        onCancel={() => setInviting(false)}
        onOk={() => inviteForm.submit()}
        destroyOnHidden
      >
        <Form<InviteForm> form={inviteForm} layout="vertical" initialValues={{ roles: ["hr"], sendEmail: true }} onFinish={submitInvite} preserve={false}>
          <Form.Item name="email" label={t("Email")} rules={[{ required: true, type: "email", message: t("Enter a valid email address.") }]}>
            <Input placeholder="name@company.com" autoFocus />
          </Form.Item>
          <Form.Item name="displayName" label={t("Name")} rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="roles" label={t("Roles")} rules={[{ required: true, type: "array", min: 1, message: t("Pick at least one role.") }]}>
            <Checkbox.Group options={ROLES.map((role) => ({ value: role, label: t(role) }))} />
          </Form.Item>
          <Form.Item name="sendEmail" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>{t("Send an invitation email")}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title={t("Edit member")}
        okText={t("Save")}
        cancelText={t("Cancel")}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
      >
        <Form<EditForm> form={editForm} layout="vertical" onFinish={submitEdit}>
          <Form.Item name="displayName" label={t("Name")} rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="roles" label={t("Roles")} rules={[{ required: true, type: "array", min: 1, message: t("Pick at least one role.") }]}>
            <Checkbox.Group options={ROLES.map((role) => ({ value: role, label: t(role) }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
