import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./store/StoreContext";
import "./index.css";

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
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            background: "#fee2e2",
            color: "#7f1d1d",
            minHeight: "100vh",
          }}
        >
          <h2>Error</h2>
          <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          <pre>{this.state.info?.componentStack || ""}</pre>
        </div>
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
        <StoreProvider>
          <BrowserRouter basename={(import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL || "/"}>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </BrowserRouter>
        </StoreProvider>
      </AntApp>
    </ConfigProvider>
  </StrictMode>,
);
