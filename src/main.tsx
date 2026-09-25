import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    console.error("[GigaGrid Global Error]:", event.error || event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[GigaGrid Global Unhandled Rejection]:", event.reason);
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="GigaGrid encountered an unexpected error">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
