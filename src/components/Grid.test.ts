import { describe, expect, it } from "vitest";
import {
  CELL_HORIZONTAL_PADDING,
  computeCellBackground,
  computeDomRowTop,
  computeGutterWidth,
  computeScrollMetrics,
  computeWindow,
  DEFAULT_COL_WIDTH,
  fetchRowsInChunks,
  getLongestLine,
  MAX_AUTOFIT_COL_WIDTH,
  MAX_SCROLL_CONTAINER_HEIGHT,
  measureTextWidth,
  MIN_COL_WIDTH,
  MIN_GUTTER_WIDTH,
  physicalToVirtualScrollTop,
  virtualToPhysicalScrollTop,
  computeAutoFitColWidth,
  computeHeaderCellHighlight,
  computeSelectAllBounds,
} from "./Grid";

describe("computeGutterWidth", () => {
  it("returns MIN_GUTTER_WIDTH for empty or small row counts", () => {
    expect(computeGutterWidth(0)).toBe(MIN_GUTTER_WIDTH);
    expect(computeGutterWidth(-5)).toBe(MIN_GUTTER_WIDTH);
    expect(computeGutterWidth(10)).toBe(MIN_GUTTER_WIDTH);
    expect(computeGutterWidth(50)).toBe(MIN_GUTTER_WIDTH);
    expect(computeGutterWidth(999)).toBe(MIN_GUTTER_WIDTH);
  });

  it("scales dynamically for large datasets to prevent header misalignment", () => {
    // 5-digit row counts: e.g. 50,000 rows
    expect(computeGutterWidth(50000)).toBeGreaterThanOrEqual(60);
    // 6-digit row counts: e.g. 200k, 500k rows
    expect(computeGutterWidth(200000)).toBe(76);
    expect(computeGutterWidth(500000)).toBe(76);
    // 7-digit row counts: 1,000,000 rows
    expect(computeGutterWidth(1000000)).toBe(86);
    // 8-digit row counts: 10,000,000 rows
    expect(computeGutterWidth(10000000)).toBe(96);
  });
});

describe("computeWindow", () => {
  it("returns empty range for an empty file", () => {
    expect(computeWindow(0, 28, 600, 0, 10)).toEqual({ start: 0, count: 0 });
  });

  it("clips the start at 0 when scrolled near the top", () => {
    const r = computeWindow(0, 28, 560, 1000, 10);
    expect(r.start).toBe(0);
    expect(r.count).toBeGreaterThan(0);
  });

  it("clips the end at totalRows when scrolled near the bottom", () => {
    const totalRows = 100;
    const r = computeWindow(100 * 28, 28, 560, totalRows, 10);
    expect(r.start + r.count).toBeLessThanOrEqual(totalRows);
  });

  it("includes an overscan buffer around the visible rows", () => {
    // scrollTop=280 -> visible rows start at row 10 (280/28); overscan=5
    // means the fetched window should start at row 5, not row 10.
    const r = computeWindow(280, 28, 280, 1000, 5);
    expect(r.start).toBe(5);
  });

  it("is a pure function — same inputs always give the same output", () => {
    const a = computeWindow(560, 28, 600, 5000, 10);
    const b = computeWindow(560, 28, 600, 5000, 10);
    expect(a).toEqual(b);
  });
});

describe("fetchRowsInChunks", () => {
  function makeCountingFetcher() {
    const calls: Array<{ start: number; count: number }> = [];
    const fetchChunk = async (start: number, count: number) => {
      calls.push({ start, count });
      return Array.from({ length: count }, (_, i) => [`r${start + i}`]);
    };
    return { calls, fetchChunk };
  }

  it("makes a single call when count fits in one chunk", async () => {
    const { calls, fetchChunk } = makeCountingFetcher();
    const rows = await fetchRowsInChunks(10, 33, 5000, fetchChunk);
    expect(calls).toEqual([{ start: 10, count: 33 }]);
    expect(rows.length).toBe(33);
    expect(rows[0]).toEqual(["r10"]);
    expect(rows[32]).toEqual(["r42"]);
  });

  it("splits a selection spanning multiple chunk boundaries with no gaps or overlaps", async () => {
    const { calls, fetchChunk } = makeCountingFetcher();
    const rows = await fetchRowsInChunks(0, 12345, 5000, fetchChunk);
    expect(calls).toEqual([
      { start: 0, count: 5000 },
      { start: 5000, count: 5000 },
      { start: 10000, count: 2345 },
    ]);
    expect(rows.length).toBe(12345);
    // every row must be present exactly once, in order — this is exactly
    // the failure mode reported against a real ~200k-row selection (whole
    // rows silently blank when fetched in one giant call)
    for (let r = 0; r < rows.length; r++) {
      expect(rows[r]).toEqual([`r${r}`]);
    }
  });

  it("makes no calls and returns no rows for an empty selection", async () => {
    const { calls, fetchChunk } = makeCountingFetcher();
    const rows = await fetchRowsInChunks(0, 0, 5000, fetchChunk);
    expect(calls).toEqual([]);
    expect(rows).toEqual([]);
  });
});

describe("virtual scroll scaling (handling > 1 million rows)", () => {
  it("remains unscaled when dataset height is within MAX_SCROLL_CONTAINER_HEIGHT", () => {
    // 50,000 rows * 28px = 1,400,000px <= 15,000,000px
    const metrics = computeScrollMetrics(50000, 28, 600);
    expect(metrics.isScaled).toBe(false);
    expect(metrics.scale).toBe(1);
    expect(metrics.modelHeight).toBe(1400000);
    expect(metrics.containerHeight).toBe(1400000);
    expect(metrics.maxPhysicalScroll).toBe(1399400);
    expect(metrics.maxVirtualScroll).toBe(1399400);

    // Physical to virtual mapping is 1:1
    expect(physicalToVirtualScrollTop(500, metrics)).toBe(500);
    expect(virtualToPhysicalScrollTop(500, metrics)).toBe(500);
  });

  it("handles edge cases (zero/negative dimensions) safely without crashing", () => {
    const zeroRows = computeScrollMetrics(0, 28, 600);
    expect(zeroRows.isScaled).toBe(false);
    expect(zeroRows.containerHeight).toBe(0);
    expect(zeroRows.scale).toBe(1);
    expect(physicalToVirtualScrollTop(100, zeroRows)).toBe(0);
    expect(virtualToPhysicalScrollTop(100, zeroRows)).toBe(0);

    const zeroViewport = computeScrollMetrics(1000, 28, 0);
    expect(zeroViewport.isScaled).toBe(false);
    expect(zeroViewport.maxPhysicalScroll).toBe(0);
  });

  it("enables scaling and caps container height when theoretical height exceeds MAX_SCROLL_CONTAINER_HEIGHT", () => {
    // 2,000,000 rows * 28px = 56,000,000px (> 15,000,000px and exceeds browser ~33.5M px limit)
    const totalRows = 2000000;
    const rowHeight = 28;
    const viewportHeight = 800;
    const metrics = computeScrollMetrics(totalRows, rowHeight, viewportHeight);

    expect(metrics.isScaled).toBe(true);
    expect(metrics.modelHeight).toBe(56000000);
    // Container height is safely clamped to MAX_SCROLL_CONTAINER_HEIGHT (15,000,000)
    expect(metrics.containerHeight).toBe(MAX_SCROLL_CONTAINER_HEIGHT);
    expect(metrics.containerHeight).toBeLessThanOrEqual(33554400); // within browser DOM limit

    // Max physical scroll
    expect(metrics.maxPhysicalScroll).toBe(15000000 - 800);
    // Max virtual scroll
    expect(metrics.maxVirtualScroll).toBe(56000000 - 800);
    expect(metrics.scale).toBeCloseTo(55999200 / 14999200, 5);
  });

  it("maps physical scroll positions to virtual positions across full range (0 to bottom)", () => {
    const totalRows = 2000000;
    const rowHeight = 28;
    const viewportHeight = 800;
    const metrics = computeScrollMetrics(totalRows, rowHeight, viewportHeight);

    // Top of file
    expect(physicalToVirtualScrollTop(0, metrics)).toBe(0);

    // Bottom of file (scroll thumb dragged all the way down)
    const virtualBottom = physicalToVirtualScrollTop(metrics.maxPhysicalScroll, metrics);
    expect(virtualBottom).toBe(metrics.maxVirtualScroll);

    // Window computed at bottom includes the final rows up to row 2,000,000
    const windowAtBottom = computeWindow(virtualBottom, rowHeight, viewportHeight, totalRows, 10);
    expect(windowAtBottom.start + windowAtBottom.count).toBe(totalRows);

    // Midpoint mapping
    const halfPhysical = metrics.maxPhysicalScroll / 2;
    const halfVirtual = physicalToVirtualScrollTop(halfPhysical, metrics);
    expect(halfVirtual).toBeCloseTo(metrics.maxVirtualScroll / 2, 0);
  });

  it("roundtrips between virtual and physical coordinates accurately", () => {
    const totalRows = 3000000; // 3 million rows
    const metrics = computeScrollMetrics(totalRows, 28, 700);

    // Test multiple target virtual scroll points
    const targetVirtuals = [0, 1000000, 25000000, 50000000, metrics.maxVirtualScroll];
    for (const v of targetVirtuals) {
      const physical = virtualToPhysicalScrollTop(v, metrics);
      expect(physical).toBeGreaterThanOrEqual(0);
      expect(physical).toBeLessThanOrEqual(metrics.maxPhysicalScroll);

      const roundtripVirtual = physicalToVirtualScrollTop(physical, metrics);
      expect(roundtripVirtual).toBeCloseTo(v, 2);
    }
  });

  it("computes DOM row top positions correctly in both unscaled and scaled modes", () => {
    // Unscaled: domRowTop is strictly offset * rowHeight
    expect(computeDomRowTop(10, 28, 100, 100, false)).toBe(280);

    // Scaled mode: positioned relative to viewport's current physical scroll
    const rowHeight = 28;
    const physicalScrollTop = 5000000;
    const virtualScrollTop = 20000000;
    // Row whose virtual position is exactly at virtualScrollTop + 56px (2 rows down)
    const targetRowOffset = Math.floor(virtualScrollTop / rowHeight) + 2;
    const domTop = computeDomRowTop(targetRowOffset, rowHeight, physicalScrollTop, virtualScrollTop, true);

    // In viewport space, distance from physicalScrollTop should match the virtual delta
    const deltaY = targetRowOffset * rowHeight - virtualScrollTop;
    expect(domTop - physicalScrollTop).toBe(deltaY);

    // Bottom row at max physical scroll sits flush with container bottom
    const metrics = computeScrollMetrics(2000000, 28, 800);
    const lastRowOffset = 2000000 - 1;
    const lastRowDomTop = computeDomRowTop(
      lastRowOffset,
      28,
      metrics.maxPhysicalScroll,
      metrics.maxVirtualScroll,
      metrics.isScaled,
    );
    expect(lastRowDomTop + 28).toBe(metrics.containerHeight);
  });

  it("allows jumping to rows > 1 million via virtualToPhysicalScrollTop", () => {
    // User reported: scrolling stops around ~1M rows.
    // Verify that navigating to row 1,800,000 works seamlessly:
    const totalRows = 2000000;
    const rowHeight = 28;
    const viewportHeight = 800;
    const metrics = computeScrollMetrics(totalRows, rowHeight, viewportHeight);

    const targetRow = 1800000;
    const targetVirtualScroll = targetRow * rowHeight;
    const physicalScroll = virtualToPhysicalScrollTop(targetVirtualScroll, metrics);

    // Physical scroll is within container bounds
    expect(physicalScroll).toBeGreaterThan(0);
    expect(physicalScroll).toBeLessThanOrEqual(metrics.maxPhysicalScroll);

    // Browser receives physical scroll and onScroll maps back to virtual range around row 1,800,000
    const resolvedVirtual = physicalToVirtualScrollTop(physicalScroll, metrics);
    const window = computeWindow(resolvedVirtual, rowHeight, viewportHeight, totalRows, 10);
    expect(window.start).toBeLessThanOrEqual(targetRow);
    expect(window.start + window.count).toBeGreaterThan(targetRow);
  });

  it("accounts for topCover (sticky header/frozen row) so the last row is never clipped", () => {
    // When sticky header consumes 28px in normal flow:
    const totalRows = 2000000;
    const rowHeight = 28;
    const viewportHeight = 800;
    const topCover = 28; // showGridChrome = true

    const metrics = computeScrollMetrics(totalRows, rowHeight, viewportHeight, topCover);
    expect(metrics.topCover).toBe(28);
    // Container height is capped at 15M
    expect(metrics.containerHeight).toBe(MAX_SCROLL_CONTAINER_HEIGHT);
    // Max physical scroll includes topCover
    expect(metrics.maxPhysicalScroll).toBe(topCover + MAX_SCROLL_CONTAINER_HEIGHT - viewportHeight);
    // Max virtual scroll includes topCover
    expect(metrics.maxVirtualScroll).toBe(topCover + totalRows * rowHeight - viewportHeight);

    // When scrolled to bottom:
    const physicalScrollTop = metrics.maxPhysicalScroll;
    const virtualScrollTop = physicalToVirtualScrollTop(physicalScrollTop, metrics);
    expect(virtualScrollTop).toBe(metrics.maxVirtualScroll);

    // Compute DOM position for the very last row (row 2,000,000, offset 1,999,999)
    const lastRowOffset = totalRows - 1;
    const domTop = computeDomRowTop(
      lastRowOffset,
      rowHeight,
      physicalScrollTop,
      virtualScrollTop,
      metrics.isScaled,
    );

    // Inside the scroll container, spacer div sits at topCover.
    // Visual Y on screen = (topCover + domTop) - physicalScrollTop.
    const visualY = topCover + domTop - physicalScrollTop;
    const visualBottom = visualY + rowHeight;

    // The bottom edge of the last row must align EXACTLY with the viewport bottom (800px)
    expect(visualBottom).toBe(viewportHeight);

    // Also check with freezeHeader enabled (topCover = 56px, 2 sticky bars)
    const freezeTopCover = 56;
    const freezeScrollableRows = totalRows - 1;
    const freezeMetrics = computeScrollMetrics(freezeScrollableRows, rowHeight, viewportHeight, freezeTopCover);
    const freezeLastRowOffset = freezeScrollableRows - 1;
    const freezeDomTop = computeDomRowTop(
      freezeLastRowOffset,
      rowHeight,
      freezeMetrics.maxPhysicalScroll,
      freezeMetrics.maxVirtualScroll,
      freezeMetrics.isScaled,
    );
    const freezeVisualY = freezeTopCover + freezeDomTop - freezeMetrics.maxPhysicalScroll;
    const freezeVisualBottom = freezeVisualY + rowHeight;
    expect(freezeVisualBottom).toBe(viewportHeight);
  });
});

describe("computeCellBackground", () => {
  it("returns undefined for non-frozen, unselected cell", () => {
    expect(computeCellBackground(false, false)).toBeUndefined();
  });

  it("returns selection rgba for non-frozen, selected cell", () => {
    expect(computeCellBackground(true, false)).toBe("rgba(70,130,255,0.25)");
  });

  it("returns var(--bg) for frozen, unselected cell to keep it opaque", () => {
    expect(computeCellBackground(false, true)).toBe("var(--bg)");
  });

  it("returns layered gradient and var(--bg) for frozen, selected cell so highlight is visible and opaque", () => {
    expect(computeCellBackground(true, true)).toBe(
      "linear-gradient(rgba(70,130,255,0.25), rgba(70,130,255,0.25)) var(--bg)",
    );
  });
});

describe("computeHeaderCellHighlight", () => {
  it("returns empty object when unselected", () => {
    expect(computeHeaderCellHighlight(false)).toEqual({});
    expect(computeHeaderCellHighlight(false, "var(--bg)")).toEqual({});
  });

  it("returns background, color, and fontWeight when selected with default base background", () => {
    expect(computeHeaderCellHighlight(true)).toEqual({
      background:
        "linear-gradient(var(--header-highlight-bg, rgba(57, 108, 216, 0.18)), var(--header-highlight-bg, rgba(57, 108, 216, 0.18))) var(--header-bg)",
      color: "var(--header-highlight-fg, var(--primary, #396cd8))",
      fontWeight: 600,
    });
  });

  it("supports custom base background for frozen columns", () => {
    expect(computeHeaderCellHighlight(true, "var(--bg)")).toEqual({
      background:
        "linear-gradient(var(--header-highlight-bg, rgba(57, 108, 216, 0.18)), var(--header-highlight-bg, rgba(57, 108, 216, 0.18))) var(--bg)",
      color: "var(--header-highlight-fg, var(--primary, #396cd8))",
      fontWeight: 600,
    });
  });
});

describe("computeSelectAllBounds", () => {
  it("returns null for non-positive row count or column count", () => {
    expect(computeSelectAllBounds(0, 5)).toBeNull();
    expect(computeSelectAllBounds(10, 0)).toBeNull();
    expect(computeSelectAllBounds(-1, 5)).toBeNull();
    expect(computeSelectAllBounds(10, -2)).toBeNull();
  });

  it("computes bounds covering the entire grid (0 to rowCount - 1, 0 to colCount - 1)", () => {
    expect(computeSelectAllBounds(1, 1)).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 0, col: 0 },
    });

    expect(computeSelectAllBounds(100, 10)).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 99, col: 9 },
    });

    expect(computeSelectAllBounds(1000000, 26)).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 999999, col: 25 },
    });
  });
});

describe("getLongestLine", () => {
  it("returns the original string if single-line", () => {
    expect(getLongestLine("simple text")).toBe("simple text");
  });

  it("returns the longest line from a multiline string", () => {
    const multi = "short\nthis is a longer line\ntiny";
    expect(getLongestLine(multi)).toBe("this is a longer line");
  });

  it("handles empty strings", () => {
    expect(getLongestLine("")).toBe("");
  });
});

describe("measureTextWidth", () => {
  it("returns 0 for empty string", () => {
    expect(measureTextWidth("")).toBe(0);
  });

  it("estimates positive width for text", () => {
    const w = measureTextWidth("sample");
    expect(w).toBeGreaterThan(0);
  });

  it("gives wider width for longer text", () => {
    expect(measureTextWidth("short")).toBeLessThan(measureTextWidth("much longer text string here"));
  });
});

describe("computeAutoFitColWidth", () => {
  const fakeMeasure = (text: string) => text.length * 8;

  it("respects MIN_COL_WIDTH for empty or very short content", () => {
    const rows = [[""], ["a"], ["b"]];
    const width = computeAutoFitColWidth(0, rows, fakeMeasure, undefined);
    expect(width).toBe(MIN_COL_WIDTH);
  });

  it("applies CELL_HORIZONTAL_PADDING when computing cell width", () => {
    const rows = [["abc"]]; // 3 chars * 8 = 24
    const width = computeAutoFitColWidth(0, rows, fakeMeasure);
    expect(width).toBe(24 + CELL_HORIZONTAL_PADDING);
  });

  it("expands based on data cell contents", () => {
    const rows = [
      ["short", "val"],
      ["medium length text", "val"],
      ["this is a very long string that needs wide column", "val"],
    ];
    // Longest text is 49 chars -> 49 * 8 = 392 + 24 (padding) = 416
    const width = computeAutoFitColWidth(0, rows, fakeMeasure);
    expect(width).toBe(416);
    expect(width).toBeGreaterThan(DEFAULT_COL_WIDTH);
  });

  it("takes header text into account", () => {
    const rows = [["val1"], ["val2"]];
    const header = "Super Long Column Title Name";
    // Header is 28 chars -> 28 * 8 = 224 + 24 = 248
    const width = computeAutoFitColWidth(0, rows, fakeMeasure, header);
    expect(width).toBe(248);
  });

  it("takes chrome column number into account", () => {
    const rows: string[][] = [];
    // Column 999 -> chrome label "1000" -> 4 * 8 = 32 + 24 = 56
    const width = computeAutoFitColWidth(999, rows, fakeMeasure);
    expect(width).toBeGreaterThanOrEqual(MIN_COL_WIDTH);
  });

  it("caps column width at MAX_AUTOFIT_COL_WIDTH", () => {
    const hugeText = "A".repeat(500);
    const rows = [[hugeText]];
    const width = computeAutoFitColWidth(0, rows, fakeMeasure);
    expect(width).toBe(MAX_AUTOFIT_COL_WIDTH);
  });

  it("handles multiline cell values by sizing to the longest line", () => {
    const multiline = "line1\nsuper long second line in this cell\nline3";
    const rows = [[multiline]];
    const width = computeAutoFitColWidth(0, rows, fakeMeasure);
    // Longest line is "super long second line in this cell" (35 chars) -> 35 * 8 = 280 + 24 = 304
    expect(width).toBe(304);
  });

  it("safely ignores ragged rows that are shorter than colIndex", () => {
    const rows = [
      ["only one col"],
      ["col0", "col1", "col2 with long text"],
    ];
    const width = computeAutoFitColWidth(2, rows, fakeMeasure);
    expect(width).toBeGreaterThan(MIN_COL_WIDTH);
  });
});


