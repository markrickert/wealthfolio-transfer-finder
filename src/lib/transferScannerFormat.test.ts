import { describe, expect, it } from "vitest";
import { scanProgressPercent } from "./transferScannerFormat";

describe("scanProgressPercent", () => {
  it("keeps fetching within its small share even when it has the most items", () => {
    expect(scanProgressPercent({ stage: "fetching", current: 2541, total: 2541 })).toBe(5);
  });

  it("starts each stage where the previous stage's share ends", () => {
    expect(scanProgressPercent({ stage: "checking-pairs", current: 0, total: 446 })).toBe(5);
    expect(scanProgressPercent({ stage: "matching", current: 0, total: 200 })).toBe(15);
  });

  it("gives matching most of the bar", () => {
    expect(scanProgressPercent({ stage: "matching", current: 100, total: 200 })).toBe(57.5);
    expect(scanProgressPercent({ stage: "matching", current: 200, total: 200 })).toBe(100);
  });

  it("treats an empty stage as not yet started", () => {
    expect(scanProgressPercent({ stage: "checking-pairs", current: 0, total: 0 })).toBe(5);
  });
});
