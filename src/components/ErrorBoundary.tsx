import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GigaGrid ErrorBoundary caught an error]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleCopy = async () => {
    const { error, errorInfo } = this.state;
    const details = [
      `GigaGrid Error Report:`,
      `Message: ${error?.message || "Unknown error"}`,
      `Stack: ${error?.stack || "No stack"}`,
      `Component Stack: ${errorInfo?.componentStack || "No component stack"}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
    ].join("\n\n");

    try {
      await navigator.clipboard.writeText(details);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      console.warn("Failed to copy to clipboard");
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle = "Something went wrong in GigaGrid" } = this.props;
      const { error, copied, showDetails } = this.state;

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            minHeight: "300px",
            backgroundColor: "var(--bg)",
            color: "var(--fg)",
            padding: "24px",
            boxSizing: "border-box",
            userSelect: "none",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              borderRadius: "8px",
              border: "1px solid #ef444455",
              backgroundColor: "var(--input-bg)",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.4)",
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  backgroundColor: "#ef444420",
                  color: "#ef4444",
                  fontSize: "20px",
                  fontWeight: "bold",
                  flexShrink: 0,
                }}
              >
                ⚠
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>{fallbackTitle}</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", opacity: 0.7 }}>
                  Your CSV/TSV data on disk remains safe. You can recover or reload.
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div
              style={{
                marginTop: "16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--bg)",
                padding: "10px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#f87171",
                wordBreak: "break-word",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              {error?.message || "Unknown runtime error"}
            </div>

            {/* Expandable Technical Details */}
            <div style={{ marginTop: "12px" }}>
              <button
                type="button"
                onClick={this.toggleDetails}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: "11px",
                  opacity: 0.7,
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                {showDetails ? "▼ Hide technical details" : "▶ Show technical details & stack"}
              </button>

              {showDetails && (
                <pre
                  style={{
                    marginTop: "8px",
                    maxHeight: "140px",
                    overflow: "auto",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    backgroundColor: "rgba(0,0,0,0.3)",
                    padding: "8px",
                    fontFamily: "monospace",
                    fontSize: "10px",
                    opacity: 0.8,
                    userSelect: "text",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {error?.stack}
                </pre>
              )}
            </div>

            {/* Actions */}
            <div
              style={{
                marginTop: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={this.handleCopy}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  backgroundColor: "var(--bg)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                }}
              >
                {copied ? "✓ Copied" : "Copy Error"}
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  cursor: "pointer",
                  backgroundColor: "var(--bg)",
                  color: "var(--fg)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                }}
              >
                Dismiss
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: "var(--primary)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                }}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
