import { StrictMode, Component, useState, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider, useStore } from "./store/StoreContext";
import { SessionGate } from "./lib/session";
import "./index.css";

const BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL || "/";
const IS_DEV = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);

/** What users see when a page crashes (#23): one plain sentence and three ways out — never a stack trace. */
function ErrorFallback({ error, componentStack, onRetry }: { error: Error; componentStack: string; onRetry: () => void }) {
  const { t } = useStore();
  const [copied, setCopied] = useState(false);
  const report = async () => {
    const text = [`HireOS Screening error`, `Page: ${window.location.href}`, `Time: ${new Date().toISOString()}`, `Error: ${error.message}`].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt(t("Copy this and send it to your administrator:"), text);
    }
  };
  return (
    <div className="card card-pad" style={{ maxWidth: 560, margin: "48px auto", textAlign: "center" }} role="alert">
      <h2 style={{ marginTop: 0 }}>{t("Something went wrong on this page")}</h2>
      <p className="tiny" style={{ marginBottom: 20 }}>
        {t("Your data is safe. Try again, or go back to the job list.")}
      </p>
      <div className="flex gap-8" style={{ justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          {t("Try again")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.assign(`${BASE_URL}jobs`)}>
          {t("Back to job list")}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void report()}>
          {copied ? t("Copied — send it to your administrator") : t("Report the problem")}
        </button>
      </div>
      {IS_DEV && (
        <details style={{ marginTop: 20, textAlign: "left" }}>
          <summary className="tiny">Developer details (dev builds only)</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{String(error.stack || error)}{componentStack}</pre>
        </details>
      )}
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; info: ErrorInfo | null }> {
  state = { error: null as Error | null, info: null as ErrorInfo | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          componentStack={this.state.info?.componentStack || ""}
          onRetry={() => this.setState({ error: null, info: null })}
        />
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#0d9488",
          borderRadius: 8,
          fontFamily: "Inter, system-ui, sans-serif",
        },
      }}
    >
      <AntApp>
        <SessionGate>
          <StoreProvider>
            <BrowserRouter basename={(import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL || "/"}>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </StoreProvider>
        </SessionGate>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
