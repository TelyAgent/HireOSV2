import { StrictMode, Component, type ReactNode, type ErrorInfo } from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { StoreProvider } from "./store/StoreContext";
import { API_BASE_URL } from "./lib/apiBase";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConfigProvider theme={{ token: { colorPrimary: "#0d9488", borderRadius: 6, fontFamily: "inherit" } }}>
      <StoreProvider>
        <BrowserRouter basename={API_BASE_URL}>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </StoreProvider>
    </ConfigProvider>
  </StrictMode>,
);
