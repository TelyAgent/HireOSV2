import { useCallback, useEffect, useMemo, useState } from "react";
import { App as AntApp, Button, Checkbox, Form, Input, Modal, Select, Tag } from "antd";
import { ACCOUNT_URL, authFetch, useSessionUser } from "../../lib/session";
import { useSettingsT } from "./i18n";
import { initials } from "../../lib/initials";
import { InterviewerBindings } from './InterviewerBindings';

const icon = (name: string) => <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{name}</span>;

/*
 * Workspace members — the shared HireOS accounts in hireos-identity (invite-only sign-in). Every
 * subsystem uses the same member list; this screen calls the identity service's admin API directly
 * (`<root>/account/api/users`, same origin, session cookie).
 */
type Role = "admin" | "hr" | "interviewer";
type Member = {
  id: string;
  email: string;
  displayName: string;
  avatarColor: string | null;
  roles: Role[];
  membershipStatus: "invited" | "active";
  status: "active" | "disabled";
};

const ROLES: Role[] = ["admin", "hr", "interviewer"];
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", hr: "HR", interviewer: "Interviewer" };
const ERROR_TEXT: Record<string, string> = {
  ROLES_REQUIRED: "Pick at least one role.",
  INVALID_EMAIL: "Enter a valid email address.",
  ALREADY_MEMBER: "This email is already a member.",
  LAST_ADMIN: "The workspace needs at least one active admin.",
  CANNOT_REMOVE_SELF: "You cannot remove yourself.",
};

class MembersApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`${ACCOUNT_URL}api${path}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new MembersApiError(response.status, typeof body.code === "string" ? body.code : `HTTP_${response.status}`);
  return body as T;
}


type InviteForm = { email: string; displayName: string; roles: Role[]; sendEmail: boolean };

export function MembersSection() {
  const t = useSettingsT();
  const { message, modal } = AntApp.useApp();
  const me = useSessionUser();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [blocked, setBlocked] = useState<"signin" | "admin" | null>(null);
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [form] = Form.useForm<InviteForm>();

  const fail = useCallback(
    (error: unknown) => {
      const code = error instanceof MembersApiError ? error.code : "";
      message.error(t(ERROR_TEXT[code] ?? "Something went wrong — please try again."));
    },
    [message, t],
  );

  const load = useCallback(() => {
    request<Member[]>("/users")
      .then((list) => {
        setMembers(list);
        setBlocked(null);
      })
      .catch((error) => {
        if (error instanceof MembersApiError && error.status === 401) setBlocked("signin");
        else if (error instanceof MembersApiError && error.status === 403) setBlocked("admin");
        else fail(error);
        setMembers([]);
      });
  }, [fail]);

  useEffect(load, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!members || !q) return members ?? [];
    return members.filter((m) => m.displayName.toLowerCase().includes(q) || m.email.includes(q));
  }, [members, query]);

  const changeRoles = async (member: Member, roles: Role[]) => {
    if (!roles.length) {
      message.error(t("Pick at least one role."));
      return;
    }
    setSavingId(member.id);
    try {
      await request(`/users/${member.id}`, { method: "PATCH", body: JSON.stringify({ roles }) });
      setMembers((list) => list?.map((m) => (m.id === member.id ? { ...m, roles } : m)) ?? null);
      message.success(t("Saved"));
    } catch (error) {
      fail(error);
    } finally {
      setSavingId(null);
    }
  };

  const remove = (member: Member) => {
    modal.confirm({
      title: t("Remove member"),
      content: t("Remove {name} from the workspace? They will no longer be able to sign in.").replace("{name}", member.displayName),
      okText: t("Remove"),
      cancelText: t("Cancel"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await request(`/users/${member.id}`, { method: "DELETE" });
          message.success(t("Member removed"));
          load();
        } catch (error) {
          fail(error);
        }
      },
    });
  };

  const submitInvite = async (values: InviteForm) => {
    try {
      const result = await request<{ emailSent: boolean }>("/users/invite", { method: "POST", body: JSON.stringify(values) });
      if (values.sendEmail && !result.emailSent) message.warning(t("Invited — the invitation email could not be sent"));
      else message.success(t("Invitation sent"));
      setInviting(false);
      form.resetFields();
      load();
    } catch (error) {
      fail(error);
    }
  };

  const roleOptions = ROLES.map((role) => ({ value: role, label: t(ROLE_LABEL[role]) }));

  return (
    <>
      <h2 className="hs-title">
        {t("Members & Permissions")}
        <span className="hs-scope">{t("Permission admin")}</span>
      </h2>

      {blocked ? (
        <div className="hs-card hs-pad hs-tiny">
          {blocked === "signin" ? t("Sign in to manage workspace members.") : t("Only admins can manage workspace members.")}
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <Input
              size="large"
              allowClear
              prefix={icon("search")}
              placeholder={t("Search members…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button type="primary" size="large" icon={icon("person_add")} onClick={() => setInviting(true)}>
              {t("Add member")}
            </Button>
          </div>
          <p className="hs-tiny" style={{ margin: "-6px 0 12px" }}>
            {t("Members sign in with an emailed code — only invited emails can sign in. The list is shared by every HireOS subsystem.")}
          </p>

          <div className="hs-card">
            {members === null ? (
              <div className="hs-pad hs-tiny">{t("Loading…")}</div>
            ) : visible.length === 0 ? (
              <div className="hs-pad hs-tiny">{t("No members found")}</div>
            ) : (
              visible.map((m) => {
                const isMe = m.id === me?.id;
                return (
                  <div key={m.id} className="hs-row" style={{ opacity: m.status === "disabled" ? 0.55 : 1 }}>
                    <span className="hs-avatar" style={{ background: m.avatarColor || "#64748b", width: 28, height: 28 }}>
                      {initials(m.displayName)}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        {m.displayName}
                        {isMe && <Tag color="green">{t("You")}</Tag>}
                        {m.membershipStatus === "invited" && <Tag color="blue">{t("Invited")}</Tag>}
                        {m.status === "disabled" && <Tag>{t("Disabled")}</Tag>}
                      </div>
                      <div className="hs-tiny">{m.email}</div>
                    </div>
                    <Select<Role[]>
                      mode="multiple"
                      value={m.roles}
                      options={roleOptions}
                      disabled={isMe || savingId === m.id}
                      loading={savingId === m.id}
                      onChange={(roles) => void changeRoles(m, roles)}
                      style={{ width: 220 }}
                      maxTagCount="responsive"
                    />
                    <Button
                      type="text"
                      icon={icon("delete")}
                      disabled={isMe}
                      title={isMe ? t("You cannot remove yourself.") : t("Remove member")}
                      aria-label={t("Remove member")}
                      onClick={() => remove(m)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {!blocked && members !== null && me?.roles.includes('admin') && <InterviewerBindings members={members} />}

      <Modal
        open={inviting}
        title={t("Add member")}
        okText={t("Invite")}
        cancelText={t("Cancel")}
        onCancel={() => setInviting(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form<InviteForm> form={form} layout="vertical" initialValues={{ roles: ["hr"], sendEmail: true }} onFinish={submitInvite} preserve={false}>
          <Form.Item name="email" label={t("Email")} rules={[{ required: true, type: "email", message: t("Enter a valid email address.") }]}>
            <Input placeholder="name@company.com" autoFocus />
          </Form.Item>
          <Form.Item name="displayName" label={t("Name")} rules={[{ required: true, whitespace: true, message: t("Name is required") }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="roles" label={t("Roles")} rules={[{ required: true, type: "array", min: 1, message: t("Pick at least one role.") }]}>
            <Checkbox.Group options={roleOptions} />
          </Form.Item>
          <Form.Item name="sendEmail" valuePropName="checked" style={{ marginBottom: 0 }}>
            <Checkbox>{t("Send an invitation email")}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
