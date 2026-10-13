import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "zh" | "en";

const ZH: Record<string, string> = {
  "Sign in": "登录",
  "Enter your work email and we’ll send you a 6-digit code.": "输入工作邮箱，我们会发送一个 6 位验证码。",
  Email: "邮箱",
  "Send code": "发送验证码",
  "Sending…": "发送中…",
  "Enter a valid email address.": "请输入有效的邮箱地址。",
  "We sent a 6-digit code to {email}. It expires in 10 minutes.": "验证码已发送到 {email}，10 分钟内有效。",
  "If this email has been invited to HireOS, the code will arrive shortly.": "如果该邮箱已被邀请加入 HireOS，验证码稍后就会送达。",
  Code: "验证码",
  "Signing in…": "登录中…",
  "Resend code": "重新发送",
  "Resend in {s}s": "{s} 秒后可重新发送",
  "Use a different email": "换一个邮箱",
  "The code is incorrect.": "验证码错误。",
  "{n} attempts left.": "还可以尝试 {n} 次。",
  "Too many incorrect attempts — this code no longer works. Request a new one.": "错误次数过多，该验证码已失效，请重新获取。",
  "This code has expired. Request a new one.": "验证码已过期，请重新获取。",
  "This code has already been used. Request a new one.": "该验证码已使用过，请重新获取。",
  "A newer code was sent — use the code from the latest email.": "已发送新的验证码，请使用最新邮件中的验证码。",
  "Request a code first.": "请先获取验证码。",
  "Too many requests — try again in {s}s.": "请求太频繁，请 {s} 秒后再试。",
  "Could not send the code — please try again shortly.": "验证码发送失败，请稍后重试。",
  "This account has been disabled. Contact your admin.": "该账号已被停用，请联系管理员。",
  "Something went wrong — please try again.": "出了点问题，请重试。",
  "Prototype only — demo accounts": "仅限原型 — 演示账号",
  "By continuing you agree to the Terms of Service and Privacy Policy.": "继续即表示你同意服务条款和隐私政策。",
  Account: "账号",
  Members: "成员",
  "Sign out": "退出登录",
  "Sign out of all devices": "退出所有设备",
  "Signed out of all devices": "已退出所有设备",
  Profile: "个人信息",
  Name: "姓名",
  Roles: "角色",
  Workspace: "工作区",
  Language: "语言",
  Save: "保存",
  Saved: "已保存",
  "Go to": "前往",
  Screening: "简历筛选",
  Jobs: "职位",
  Interview: "面试",
  "Written test": "笔试",
  admin: "管理员",
  hr: "HR",
  interviewer: "面试官",
  "Invite member": "邀请成员",
  Invite: "邀请",
  "Only invited emails can sign in.": "只有被邀请的邮箱才能登录。",
  "Send an invitation email": "同时发送邀请邮件",
  "Invitation sent": "已邀请",
  "Invited — the invitation email could not be sent": "已邀请，但邀请邮件发送失败",
  Status: "状态",
  "Last sign-in": "最近登录",
  Never: "从未登录",
  Invited: "已邀请",
  Active: "正常",
  Disabled: "已停用",
  Edit: "编辑",
  Disable: "停用",
  Enable: "启用",
  Remove: "移除",
  Cancel: "取消",
  "Edit member": "编辑成员",
  "Disable {name}? They are signed out everywhere immediately.": "停用 {name}？对方会立即在所有设备上退出登录。",
  "Remove {name} from the workspace? They will no longer be able to sign in.": "将 {name} 移出工作区？对方将无法再登录。",
  "Pick at least one role.": "至少选择一个角色。",
  "This email is already a member.": "该邮箱已经是成员。",
  "The workspace needs at least one active admin.": "工作区至少需要一位正常状态的管理员。",
  "You cannot disable your own account.": "不能停用自己的账号。",
  "You cannot remove yourself.": "不能移除自己。",
  "Admins only.": "仅管理员可访问。",
  You: "你",
};

type I18n = { lang: Lang; setLang: (lang: Lang) => void; t: (source: string, vars?: Record<string, string | number>) => string };

const I18nContext = createContext<I18n | null>(null);
const LANG_KEY = "hireos_account_lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    // storage unavailable — fall through to the browser language
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next);
        try {
          localStorage.setItem(LANG_KEY, next);
        } catch {
          // not persisted — the choice still applies for this visit
        }
      },
      t: (source, vars) => {
        let text = lang === "zh" ? (ZH[source] ?? source) : source;
        for (const [key, value] of Object.entries(vars ?? {})) text = text.replace(`{${key}}`, String(value));
        return text;
      },
    }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n outside I18nProvider");
  return value;
}
