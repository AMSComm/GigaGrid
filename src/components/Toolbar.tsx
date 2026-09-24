import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconSearch, IconHash, IconFilter } from "../icons";

export interface FilterRule {
  id: number;
  col: number | null; // null = All Columns, or 0-based column index
  query: string;
}

interface ToolbarProps {
  tabId: number;
  totalCols: number;
  visible: boolean;
  onNavigate: (row: number, col?: number) => void;
  onToggleSearch: () => void;
  viewActive: boolean;
  onFilterChange: (active: boolean, rowCount: number) => void;
}

export function Toolbar({
  tabId,
  totalCols,
  visible,
  onNavigate,
  onToggleSearch,
  viewActive: _viewActive,
  onFilterChange,
}: ToolbarProps) {
  const [showGoto, setShowGoto] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [gotoRow, setGotoRow] = useState("");
  const [gotoCol, setGotoCol] = useState("");

  const nextRuleId = useRef(2);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([
    { id: 1, col: null, query: "" },
  ]);
  const [appliedCount, setAppliedCount] = useState(0);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(".filter-popover-anchor")) {
        setShowFilter(false);
      }
      if (!target?.closest(".goto-popover-anchor")) {
        setShowGoto(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowFilter(false);
        setShowGoto(false);
      }
    }
    if (showFilter || showGoto) {
      window.addEventListener("click", onDocClick);
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showFilter, showGoto]);

  function submitGoto(e: React.FormEvent) {
    e.preventDefault();
    const row = parseInt(gotoRow, 10);
    if (Number.isNaN(row)) return;
    const col = gotoCol ? parseInt(gotoCol, 10) : undefined;
    invoke("goto", { tabId, row }).then(() => {
      onNavigate(row, col);
      setShowGoto(false);
    });
  }

  function applyFilters() {
    const activeCriteria = filterRules
      .filter((r) => r.query.trim().length > 0)
      .map((r) => ({ col: r.col, query: r.query.trim() }));

    invoke<number>("set_filters", { tabId, filters: activeCriteria }).then((rowCount) => {
      setAppliedCount(activeCriteria.length);
      onFilterChange(activeCriteria.length > 0, rowCount);
      setShowFilter(false);
    });
  }

  function clearAllFilters() {
    invoke<number>("set_filters", { tabId, filters: [] }).then((rowCount) => {
      setFilterRules([{ id: nextRuleId.current++, col: null, query: "" }]);
      setAppliedCount(0);
      onFilterChange(false, rowCount);
      setShowFilter(false);
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
      { id: nextRuleId.current++, col: null, query: "" },
    ]);
  }

  function removeRule(id: number) {
    setFilterRules((prev) => {
      const remaining = prev.filter((r) => r.id !== id);
      return remaining.length > 0
        ? remaining
        : [{ id: nextRuleId.current++, col: null, query: "" }];
    });
  }

  return (
    <>
      {/* Filter Popover Anchor */}
      <div style={{ position: "relative" }} className="filter-popover-anchor">
        <button
          className="icon-btn"
          data-active={showFilter || appliedCount > 0}
          title={appliedCount > 0 ? `Filters (${appliedCount} active)` : "Filters"}
          onClick={() => {
            setShowFilter((v) => !v);
            setShowGoto(false);
          }}
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
              width: 300,
              maxWidth: "min(320px, calc(100vw - 24px))",
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
              {appliedCount > 0 && (
                <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 400 }}>
                  {appliedCount} active
                </span>
              )}
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
                <div key={rule.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={rule.col === null ? "all" : String(rule.col)}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        col: e.target.value === "all" ? null : parseInt(e.target.value, 10),
                      })
                    }
                    style={{
                      width: 100,
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
                        e.preventDefault();
                        applyFilters();
                      }
                    }}
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
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  cursor: "pointer",
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
                    onClick={clearAllFilters}
                    style={{
                      fontSize: 12,
                      padding: "3px 8px",
                      cursor: "pointer",
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
                  onClick={applyFilters}
                  style={{
                    fontSize: 12,
                    padding: "3px 12px",
                    cursor: "pointer",
                    background: "var(--primary, #396cd8)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        className="icon-btn"
        data-active={visible}
        title="Search (Cmd/Ctrl+F)"
        onClick={onToggleSearch}
      >
        <IconSearch />
      </button>

      <div style={{ position: "relative" }} className="goto-popover-anchor">
        <button
          className="icon-btn"
          data-active={showGoto}
          title="Go to row/col"
          onClick={() => {
            setShowGoto((v) => !v);
            setShowFilter(false);
          }}
        >
          <IconHash />
        </button>
        {showGoto && (
          <form
            onSubmit={submitGoto}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowGoto(false);
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
