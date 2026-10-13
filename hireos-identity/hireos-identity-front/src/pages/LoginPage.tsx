import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, DEFAULT_LANDING, api, initials, type DevAccount } from "../api";
import { useI18n } from "../i18n";
import { Brand, LangToggle } from "../components/Chrome";

const CODE_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function goTo(returnTo: string | null) {
  window.location.assign(returnTo || DEFAULT_LANDING);
}

export function LoginPage() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const returnTo = params.get("return_to");
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [demoAccounts, setDemoAccounts] = useState<DevAccount[]>([]);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  // Already signed in → straight through.
  useEffect(() => {
    api.me().then(() => goTo(returnTo)).catch(() => undefined);
    api
      .config()
      .then((config) => (config.devLogin ? api.devAccounts().then(setDemoAccounts) : undefined))
      .catch(() => undefined);
  }, [returnTo]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const describe = (err: unknown) => {
    if (!(err instanceof ApiError)) return t("Something went wrong — please try again.");
    const retry = Number(err.body.retryAfterSeconds);
    switch (err.code) {
      case "INVALID_EMAIL":
        return t("Enter a valid email address.");
      case "CODE_RATE_LIMITED":
        if (Number.isFinite(retry)) setResendIn(retry);
        return t("Too many requests — try again in {s}s.", { s: Number.isFinite(retry) ? retry : 60 });
      case "MAIL_UNAVAILABLE":
        return t("Could not send the code — please try again shortly.");
      case "USER_DISABLED":
        return t("This account has been disabled. Contact your admin.");
      case "CODE_INVALID": {
        const left = Number(err.body.attemptsLeft);
        if (left > 0) return `${t("The code is incorrect or has expired.")} ${t("{n} attempts left.", { n: left })}`;
        return t("This code can no longer be used — request a new one.");
      }
      default:
        return t("Something went wrong — please try again.");
    }
  };

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError(t("Enter a valid email address."));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api.requestCode(value, lang);
      setStep("code");
      setDigits(Array(CODE_LENGTH).fill(""));
      setResendIn(result.resendAfterSeconds);
      window.setTimeout(() => inputs.current[0]?.focus(), 0);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.verify(email.trim(), code, returnTo);
      goTo(result.returnTo);
    } catch (err) {
      setError(describe(err));
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
      setBusy(false);
    }
  };

  const setDigit = (index: number, raw: string) => {
    const value = raw.replace(/\D/g, "");
    if (value.length > 1) {
      fillFrom(index, value);
      return;
    }
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const fillFrom = (index: number, value: string) => {
    const next = [...digits];
    for (let i = 0; i < value.length && index + i < CODE_LENGTH; i++) next[index + i] = value[i];
    setDigits(next);
    inputs.current[Math.min(index + value.length, CODE_LENGTH - 1)]?.focus();
    if (next.every(Boolean)) void verify(next.join(""));
  };

  const onPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const value = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!value) return;
    event.preventDefault();
    fillFrom(index, value);
  };

  const onKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const devLogin = async (account: DevAccount) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.devLogin(account.email, returnTo);
      goTo(result.returnTo);
    } catch (err) {
      setError(describe(err));
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <LangToggle />
      </div>
      <Brand />
      <div className="auth-card">
        <h1>{t("Sign in")}</h1>
        {step === "email" ? (
          <form onSubmit={sendCode} noValidate>
            <p className="auth-sub">{t("Enter your work email and we’ll send you a 6-digit code.")}</p>
            <label className="auth-label" htmlFor="email">
              {t("Email")}
            </label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-button" type="submit" disabled={busy}>
              {busy ? t("Sending…") : t("Send code")}
            </button>
          </form>
        ) : (
          <div>
            <p className="auth-sub">{t("We sent a 6-digit code to {email}. It expires in 10 minutes.", { email: email.trim() })}</p>
            <p className="auth-hint">{t("If this email has been invited to HireOS, the code will arrive shortly.")}</p>
            <label className="auth-label">{t("Code")}</label>
            <div className="code-boxes">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputs.current[index] = el;
                  }}
                  className="code-box"
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={CODE_LENGTH}
                  value={digit}
                  disabled={busy}
                  aria-label={`${t("Code")} ${index + 1}`}
                  onChange={(e) => setDigit(index, e.target.value)}
                  onPaste={(e) => onPaste(index, e)}
                  onKeyDown={(e) => onKeyDown(index, e)}
                />
              ))}
            </div>
            {busy && <p className="auth-hint">{t("Signing in…")}</p>}
            {error && <p className="auth-error">{error}</p>}
            <div className="auth-links">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setStep("email");
                  setError(null);
                }}
              >
                {t("Use a different email")}
              </button>
              <button type="button" className="link-button" disabled={resendIn > 0 || busy} onClick={() => void sendCode()}>
                {resendIn > 0 ? t("Resend in {s}s", { s: resendIn }) : t("Resend code")}
              </button>
            </div>
          </div>
        )}

        {demoAccounts.length > 0 && (
          <div className="demo-box">
            <div className="demo-title">{t("Prototype only — demo accounts")}</div>
            <div className="demo-chips">
              {demoAccounts.map((account) => (
                <button key={account.email} type="button" className="demo-chip" disabled={busy} onClick={() => void devLogin(account)} title={account.email}>
                  <span className="avatar" style={{ background: account.avatarColor || "#64748b" }}>
                    {initials(account.displayName)}
                  </span>
                  {account.displayName}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="auth-footer">{t("By continuing you agree to the Terms of Service and Privacy Policy.")}</p>
    </div>
  );
}
