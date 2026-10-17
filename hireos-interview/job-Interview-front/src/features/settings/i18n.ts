import { useCallback } from "react";
import { useStore } from "../../store/StoreContext";

/*
 * Copy for the settings page, keyed by the English text like the other subsystems' `t("…")` — kept
 * separate from data/i18n.ts's LANG objects so this shared page reads the same as in JD / Screening /
 * Written.
 */
const ZH: Record<string, string> = {
  Personal: "个人",
  Workspace: "工作区",
  "My Profile & Preferences": "我的资料与偏好",
  Appearance: "外观",
  "Members & Permissions": "成员与权限",
  "Current user": "当前用户",
  "Account — personal": "账号 — 个人",
  "This panel and the header Appearance button control the same preference — changes apply instantly everywhere.":
    "此处与顶部的外观按钮控制同一套设置，修改会立即在所有页面生效。",
  "Reset to defaults": "重置为默认",
  Done: "完成",
  "Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.":
    "外观偏好仅保存于本次会话和当前演示角色。生产环境的 HireOS 会将外观设置同步到你的账号并跨设备生效。",
  Theme: "主题",
  Accent: "强调色",
  "Text size": "文字大小",
  "Text size preview": "字号预览",
  "Review the details below before you continue. This preview updates immediately when you change the text size.":
    "继续之前请核对下面的详细信息。切换字号后，此预览会立即更新。",
  Light: "浅色",
  Dark: "深色",
  Deep: "深蓝",
  System: "跟随系统",
  Blue: "蓝色",
  Teal: "青色",
  Violet: "紫色",
  Small: "小",
  Medium: "中",
  Large: "大",
  "Display name": "显示名称",
  Language: "语言",
  Roles: "角色",
  Save: "保存",
  Saved: "已保存",
  "Saved — the new name shows everywhere after a refresh": "已保存，刷新后各处都会显示新名字",
  "Not signed in — showing the demo role": "未登录，当前显示演示身份",
  "Something went wrong — please try again.": "出了点问题，请重试。",
  Admin: "管理员",
  HR: "HR",
  Interviewer: "面试官",
  "Permission admin": "权限管理",
  "Search members…": "搜索成员…",
  "Add member": "添加成员",
  "Remove member": "移除成员",
  "Remove {name} from the workspace? They will no longer be able to sign in.": "将 {name} 移出工作区？对方将无法再登录。",
  Remove: "移除",
  Cancel: "取消",
  "Member removed": "已移除成员",
  "Invited — the invitation email could not be sent": "已邀请，但邀请邮件发送失败",
  "Invitation sent": "已发送邀请",
  "Sign in to manage workspace members.": "登录后才能管理工作区成员。",
  "Only admins can manage workspace members.": "只有管理员可以管理工作区成员。",
  "Members sign in with an emailed code — only invited emails can sign in. The list is shared by every HireOS subsystem.":
    "成员通过邮箱验证码登录，只有被邀请的邮箱才能登录。成员列表在 HireOS 各子系统间共用。",
  "Loading…": "加载中…",
  "No members found": "没有找到成员",
  You: "你",
  Invited: "已邀请",
  Disabled: "已停用",
  "You cannot remove yourself.": "不能移除自己。",
  Invite: "邀请",
  Email: "邮箱",
  Name: "姓名",
  "Name is required": "请填写姓名",
  "Enter a valid email address.": "请输入有效的邮箱地址。",
  "Pick at least one role.": "至少选择一个角色。",
  "Send an invitation email": "同时发送邀请邮件",
  "This email is already a member.": "该邮箱已经是成员。",
  "The workspace needs at least one active admin.": "工作区至少需要一位正常状态的管理员。",
};

export function useSettingsT() {
  const { state } = useStore();
  return useCallback((source: string) => (state.lang === "zh" ? (ZH[source] ?? source) : source), [state.lang]);
}
