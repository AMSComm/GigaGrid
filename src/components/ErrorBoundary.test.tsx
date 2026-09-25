import { describe, it, expect } from "vitest";
import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";

describe("GigaGrid ErrorBoundary Component", () => {
  it("correctly captures errors via getDerivedStateFromError", () => {
    const error = new Error("GigaGrid test crash");
    const state = ErrorBoundary.getDerivedStateFromError(error);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(error);
  });

  it("initializes without errors", () => {
    const boundary = new ErrorBoundary({ children: "Child" });
    expect(boundary.state.hasError).toBe(false);
    expect(boundary.state.error).toBeNull();
    expect(boundary.state.errorInfo).toBeNull();
  });

  it("renders children when no error exists", () => {
    const child = <div id="grid-child">Grid Content</div>;
    const boundary = new ErrorBoundary({ children: child });
    const rendered = boundary.render();
    expect(rendered).toBe(child);
  });

  it("renders fallback UI when error state is active", () => {
    const child = <div>Hidden Grid</div>;
    const boundary = new ErrorBoundary({
      children: child,
      fallbackTitle: "Grid crashed",
    });
    boundary.state = {
      hasError: true,
      error: new Error("Out of memory on massive CSV"),
      errorInfo: { componentStack: "at Grid" },
      copied: false,
      showDetails: false,
    };

    const rendered = boundary.render() as React.ReactElement<{ style?: React.CSSProperties }>;
    expect(rendered).not.toBe(child);
    expect(rendered).toBeDefined();
  });
});
