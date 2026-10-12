import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconSearch, IconHash, IconFilter, IconRefresh } from "../icons";
import { getToolbarShortcutLabel } from "../utils/shortcuts";

export interface FilterRule {
  id: number;
  col: number | null; // null = All Columns, or 0-based column index
  query: string;
  enabled: boolean;
}

interface ToolbarProps {
  tabId: number;
  totalCols: number;
  visible: boolean;
  showFilter: boolean;
  onToggleFilter: () => void;
  onCloseFilter: () => void;
  showGoto: boolean;
  onToggleGoto: () => void;
  onCloseGoto: () => void;
  onNavigate: (row: number, col?: number) => void;
  onToggleSearch: () => void;
  viewActive: boolean;
  filterActive?: boolean;
  hasFilterEdits?: boolean;
  freezeHeader?: boolean;
  onFilterChange: (active: boolean, rowCount: number) => void;
  onError?: (message: string | null) => void;
}

export function Toolbar({
  tabId,
  totalCols,
  visible,
  showFilter,
  onToggleFilter,
  onCloseFilter,
  showGoto,
  onToggleGoto,
  onCloseGoto,
  onNavigate,
  onToggleSearch,
  viewActive: _viewActive,
  filterActive,
  hasFilterEdits,
  freezeHeader,
  onFilterChange,
  onError,
}: ToolbarProps) {
  const [gotoRow, setGotoRow] = useState("");
  const [gotoCol, setGotoCol] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);

  const nextRuleId = useRef(2);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([
    { id: 1, col: null, query: "", enabled: true },
  ]);
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (showFilter && !target?.closest(".filter-popover-anchor")) {
        onCloseFilter();
      }
      if (showGoto && !target?.closest(".goto-popover-anchor")) {
        onCloseGoto();
      }
    }
    if (showFilter || showGoto) {
      window.addEventListener("click", onDocClick);
    }
    return () => {
      window.removeEventListener("click", onDocClick);
    };
  }, [showFilter, showGoto, onCloseFilter, onCloseGoto]);

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

  function applyFilters() {
    if (isFiltering) return;
    const activeCriteria = filterRules
      .filter((r) => r.enabled && r.query.trim().length > 0)
      .map((r) => ({ col: r.col, query: r.query.trim() }));

    setIsFiltering(true);
    onError?.(null);
    invoke<number>("set_filters", { tabId, filters: activeCriteria, freezeHeader: freezeHeader ?? true })
      .then((rowCount) => {
        setIsFiltering(false);
        setAppliedCount(activeCriteria.length);
        onFilterChange(activeCriteria.length > 0, rowCount);
        onCloseFilter();
      })
      .catch((err) => {
        setIsFiltering(false);
        const msg = typeof err === "string" ? err : (err?.message || "Failed to apply filter");
        onError?.(msg);
      });
  }

  function reapplyFilters() {
    if (isFiltering) return;
    const activeCriteria = filterRules
      .filter((r) => r.enabled && r.query.trim().length > 0)
      .map((r) => ({ col: r.col, query: r.query.trim() }));

    setIsFiltering(true);
    onError?.(null);
    invoke<number>("set_filters", { tabId, filters: activeCriteria, freezeHeader: freezeHeader ?? true })
      .then((rowCount) => {
        setIsFiltering(false);
        setAppliedCount(activeCriteria.length);
        onFilterChange(activeCriteria.length > 0, rowCount);
      })
      .catch((err) => {
        setIsFiltering(false);
        const msg = typeof err === "string" ? err : (err?.message || "Failed to re-apply filter");
        onError?.(msg);
      });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && !e.altKey && e.shiftKey && e.key.toLowerCase() === "r") {
        if (filterActive && hasFilterEdits) {
          e.preventDefault();
          reapplyFilters();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filterActive, hasFilterEdits, filterRules, tabId]);

  function clearAllFilters() {
    if (isFiltering) return;
    setIsFiltering(true);
    onError?.(null);
    invoke<number>("set_filters", { tabId, filters: [], freezeHeader: freezeHeader ?? true })
      .then((rowCount) => {
        setIsFiltering(false);
        setFilterRules([{ id: nextRuleId.current++, col: null, query: "", enabled: true }]);
        setAppliedCount(0);
        onFilterChange(false, rowCount);
        onCloseFilter();
      })
      .catch((err) => {
        setIsFiltering(false);
        const msg = typeof err === "string" ? err : (err?.message || "Failed to clear filters");
        onError?.(msg);
      });
  }

  function updateRule(id: number, patch: Partial<FilterRule>) {
    setFilterRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function addRule() {
    setFilterRules((prev) => [
      ...prev,
      { id: nextRuleId.current++, col: null, query: "", enabled: true },
    ]);
  }

  function removeRule(id: number) {
    setFilterRules((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      return remaining.length > 0
        ? remaining
        : [{ id: nextRuleId.current++, col: null, query: "", enabled: true }];
    });
  }

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

      {/* Filter Popover Anchor */}
      <div style={{ position: "relative" }} className="filter-popover-anchor">
        <button
          className="icon-btn"
          data-action="filter"
          data-active={showFilter || appliedCount > 0}
          title={
            appliedCount > 0
              ? `Filters (${appliedCount} active) (${getToolbarShortcutLabel("filter")})`
              : `Filters (${getToolbarShortcutLabel("filter")})`
          }
          aria-label={`Filters (${getToolbarShortcutLabel("filter")})`}
          onClick={onToggleFilter}
        >
          <IconFilter />
        </button>
        {showFilter && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              width: 325,
              maxWidth: "min(345px, calc(100vw - 24px))",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
              padding: 10,
              gap: 8,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <span>Filter Criteria</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {appliedCount > 0 && (
                  <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                    {appliedCount} active
                  </span>
                )}
                <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 400 }}>
                  {getToolbarShortcutLabel("filter")}
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {filterRules.map((rule, idx) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    opacity: rule.enabled ? 1 : 0.55,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
                    title={rule.enabled ? "Disable this condition" : "Enable this condition"}
                    aria-label={rule.enabled ? `Disable condition ${idx + 1}` : `Enable condition ${idx + 1}`}
                    style={{
                      cursor: "pointer",
                      width: 15,
                      height: 15,
                      accentColor: "var(--primary, #396cd8)",
                      flexShrink: 0,
                      margin: 0,
                    }}
                  />
                  <select
                    value={rule.col === null ? "all" : String(rule.col)}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        col: e.target.value === "all" ? null : parseInt(e.target.value, 10),
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
                    title={!rule.enabled ? "Condition disabled (check box to enable)" : undefined}
                    style={{
                      width: 95,
                      flexShrink: 0,
                      fontSize: 12,
                      padding: "3px 4px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--fg)",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="all">All Columns</option>
                    {Array.from({ length: totalCols }, (_, c) => (
                      <option key={c} value={String(c)}>
                        Col {c + 1}
                      </option>
                    ))}
                  </select>
                  <input
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={idx === 0}
                    placeholder="Contains…"
                    value={rule.query}
                    onChange={(e) => updateRule(rule.id, { query: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (e.nativeEvent.isComposing || (e as unknown as { isComposing?: boolean }).isComposing) {
                          return;
                        }
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
                    title={!rule.enabled ? "Condition disabled (check box to enable)" : undefined}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 12,
                      padding: "3px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--bg)",
                      color: "var(--fg)",
                      boxSizing: "border-box",
                    }}
                  />
                  {filterRules.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 22, height: 22, fontSize: 14, flexShrink: 0 }}
                      title="Remove condition"
                      aria-label={`Remove condition ${idx + 1}`}
                      onClick={() => removeRule(rule.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
                paddingTop: 6,
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={addRule}
                disabled={isFiltering}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  cursor: isFiltering ? "not-allowed" : "pointer",
                  opacity: isFiltering ? 0.6 : 1,
                  background: "transparent",
                  border: "1px dashed var(--border)",
                  borderRadius: 4,
                  color: "var(--fg)",
                }}
              >
                + Add condition
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                {appliedCount > 0 && (
                  <button
                    type="button"
                    disabled={isFiltering}
                    onClick={clearAllFilters}
                    style={{
                      fontSize: 12,
                      padding: "3px 8px",
                      cursor: isFiltering ? "not-allowed" : "pointer",
                      opacity: isFiltering ? 0.6 : 1,
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      color: "var(--danger, #d93025)",
                    }}
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  disabled={isFiltering}
                  onClick={applyFilters}
                  style={{
                    fontSize: 12,
                    padding: "3px 12px",
                    cursor: isFiltering ? "not-allowed" : "pointer",
                    opacity: isFiltering ? 0.7 : 1,
                    background: "var(--primary, #396cd8)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {isFiltering ? "Applying…" : appliedCount > 0 ? "Re-apply" : "Apply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="icon-btn"
        data-action="reapply-filter"
        disabled={!filterActive || !hasFilterEdits || isFiltering}
        style={{
          opacity: filterActive && hasFilterEdits && !isFiltering ? 1 : 0.4,
          cursor: filterActive && hasFilterEdits && !isFiltering ? "pointer" : "not-allowed",
          color: filterActive && hasFilterEdits && !isFiltering ? "var(--primary, #396cd8)" : undefined,
        }}
        title={
          isFiltering
            ? "Applying filter…"
            : filterActive && hasFilterEdits
            ? `Re-apply filter (${getToolbarShortcutLabel("reapplyFilter")})`
            : "Re-apply filter (no modified cells)"
        }
        aria-label={`Re-apply filter (${getToolbarShortcutLabel("reapplyFilter")})`}
        onClick={reapplyFilters}
      >
        <IconRefresh />
      </button>

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
