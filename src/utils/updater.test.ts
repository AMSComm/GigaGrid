import { describe, it, expect } from "vitest";
import { compareVersions } from "./updater";

describe("compareVersions", () => {
  it("returns 0 for identical versions", () => {
    expect(compareVersions("0.3.0", "0.3.0")).toBe(0);
    expect(compareVersions("v0.3.0", "0.3.0")).toBe(0);
    expect(compareVersions("0.3.0", "v0.3.0")).toBe(0);
  });

  it("identifies newer versions correctly", () => {
    expect(compareVersions("0.3.1", "0.3.0")).toBe(1);
    expect(compareVersions("0.4.0", "0.3.9")).toBe(1);
    expect(compareVersions("1.0.0", "0.9.9")).toBe(1);
    expect(compareVersions("v0.3.1", "v0.3.0")).toBe(1);
  });

  it("identifies older versions correctly", () => {
    expect(compareVersions("0.2.9", "0.3.0")).toBe(-1);
    expect(compareVersions("0.1.0", "0.2.0")).toBe(-1);
    expect(compareVersions("v0.2.0", "v0.3.0")).toBe(-1);
  });

  it("handles different segment lengths", () => {
    expect(compareVersions("0.3.0.1", "0.3.0")).toBe(1);
    expect(compareVersions("0.3", "0.3.0")).toBe(0);
  });
});
