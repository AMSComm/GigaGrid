import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconSearch, IconHash, IconFilter, IconRefresh } from "../icons";
import { getToolbarShortcutLabel } from "../utils/shortcuts";

interface ToolbarProps {
  tabId: number;
  totalCols: number;
  visible: boolean;
  showGoto: boolean;
  onToggleGoto: () => void;
  onCloseGoto: () => void;
  onNavigate: (row: number, col?: number) => void;
  onToggleSearch: () => void;
  viewActive: boolean;
  filterActive?: boolean;
  activeFilterCount?: number;
  hasFilterEdits?: boolean;
  onClearAllFilters?: () => void;
  onReapplyFilters?: () => void;
  onError?: (message: string | null) => void;
}

export function Toolbar({
  tabId,
  visible,
  showGoto,
  onToggleGoto,
  onCloseGoto,
  onNavigate,
  onToggleSearch,
  filterActive,
  activeFilterCount = 0,
  hasFilterEdits,
  onClearAllFilters,
  onReapplyFilters,
}: ToolbarProps) {
  const [gotoRow, setGotoRow] = useState("");
  const [gotoCol, setGotoCol] = useState("");

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (showGoto && !target?.closest(".goto-popover-anchor")) {
        onCloseGoto();
      }
    }
    if (showGoto) {
      window.addEventListener("click", onDocClick);
    }
    return () => {
      window.removeEventListener("click", onDocClick);
    };
  }, [showGoto, onCloseGoto]);

  function submitGoto(e: React.FormEvent) {
    e.preventDefault();
    const row = parseInt(gotoRow, 10);
    if (Number.isNaN(row)) return;
    const col = gotoCol ? parseInt(gotoCol, 10) : undefined;
    invoke("goto", { tabId, row }).then(() => {
      onNavigate(row, col);
      onCloseGoto();
    });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && !e.altKey && e.shiftKey && e.key.toLowerCase() === "r") {
        if (filterActive && hasFilterEdits) {
          e.preventDefault();
          onReapplyFilters?.();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filterActive, hasFilterEdits, onReapplyFilters]);

  return (
    <>
      <button
        className="icon-btn"
        data-action="search"
        data-active={visible}
        title={`Search (${getToolbarShortcutLabel("search")})`}
        aria-label={`Search (${getToolbarShortcutLabel("search")})`}
        onClick={onToggleSearch}
      >
        <IconSearch />
      </button>

      {/* Global Filter Indicator / Clear All */}
      <div style={{ position: "relative" }} className="filter-popover-anchor">
        <button
          className="icon-btn"
          data-action="filter"
          data-active={activeFilterCount > 0}
          title={
            activeFilterCount > 0
              ? `Filters active on ${activeFilterCount} column(s). Click to clear all filters.`
              : "No column filters active (click funnel on column header to filter)"
          }
          aria-label={
            activeFilterCount > 0
              ? `Filters active on ${activeFilterCount} column(s). Click to clear all filters.`
              : "No column filters active"
          }
          onClick={() => {
            if (activeFilterCount > 0) {
              onClearAllFilters?.();
            }
          }}
          style={{ position: "relative" }}
        >
          <IconFilter />
          {activeFilterCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                background: "var(--primary, #396cd8)",
                color: "#fff",
                borderRadius: "50%",
                width: 13,
                height: 13,
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {filterActive && (
        <button
          type="button"
          className="icon-btn"
          data-action="reapply-filter"
          disabled={!hasFilterEdits}
          style={{
            opacity: hasFilterEdits ? 1 : 0.4,
            cursor: hasFilterEdits ? "pointer" : "not-allowed",
            color: hasFilterEdits ? "var(--primary, #396cd8)" : undefined,
          }}
          title={
            hasFilterEdits
              ? `Re-apply filter (${getToolbarShortcutLabel("reapplyFilter")})`
              : "Re-apply filter (no modified cells)"
          }
          aria-label={`Re-apply filter (${getToolbarShortcutLabel("reapplyFilter")})`}
          onClick={onReapplyFilters}
        >
          <IconRefresh />
        </button>
      )}

      <div style={{ position: "relative" }} className="goto-popover-anchor">
        <button
          className="icon-btn"
          data-action="goto"
          data-active={showGoto}
          title={`Go to row/col (${getToolbarShortcutLabel("goto")})`}
          aria-label={`Go to row/col (${getToolbarShortcutLabel("goto")})`}
          onClick={onToggleGoto}
        >
          <IconHash />
        </button>
        {showGoto && (
          <form
            onSubmit={submitGoto}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCloseGoto();
            }}
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 10,
              display: "flex",
              gap: 4,
              padding: 6,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              placeholder="Row"
              value={gotoRow}
              onChange={(e) => setGotoRow(e.currentTarget.value)}
              style={{ width: 70 }}
            />
            <input
              placeholder="Col"
              value={gotoCol}
              onChange={(e) => setGotoCol(e.currentTarget.value)}
              style={{ width: 50 }}
            />
            <button type="submit">Go</button>
          </form>
        )}
      </div>
    </>
  );
}
