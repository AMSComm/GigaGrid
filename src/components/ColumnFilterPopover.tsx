import { useEffect, useId, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { IconArrowDown, IconArrowUp, IconClose, IconRefresh, IconSearch } from "../icons";
import {
  CONDITION_OPTIONS,
  type ColumnFilter,
  type ConditionType,
  type DistinctValuesResult,
} from "../utils/filterRules";

interface ColumnFilterPopoverProps {
  tabId: number;
  col: number;
  colName?: string;
  anchor: { x: number; y: number };
  currentFilter?: ColumnFilter;
  onApply: (filter: ColumnFilter) => void;
  onClear: () => void;
  onSort: (descending: boolean) => void;
  onClose: () => void;
}

export function ColumnFilterPopover({
  tabId,
  col,
  colName,
  anchor,
  currentFilter,
  onApply,
  onClear,
  onSort,
  onClose,
}: ColumnFilterPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const conditionSelectId = useId();
  const conditionValueInputId = useId();

  // Sort state / actions
  const [condition, setCondition] = useState<ConditionType>(currentFilter?.condition ?? "none");
  const [conditionValue, setConditionValue] = useState<string>(currentFilter?.conditionValue ?? "");

  // Distinct values state
  const [loadingValues, setLoadingValues] = useState(true);
  const [distinctResult, setDistinctResult] = useState<DistinctValuesResult | null>(null);
  const [selectedValues, setSelectedValues] = useState<Set<string>>(() => {
    if (currentFilter?.selectedValues) {
      return new Set(currentFilter.selectedValues);
    }
    return new Set<string>(); // will initialize when distinctResult loads
  });
  const [hasCustomValueSelection, setHasCustomValueSelection] = useState<boolean>(
    Boolean(currentFilter?.selectedValues !== undefined),
  );
  const [valuesSearch, setValuesSearch] = useState("");

  // Load distinct values on mount
  useEffect(() => {
    let active = true;
    invoke<DistinctValuesResult>("get_column_distinct_values", { tabId, col, limit: 1000 })
      .then((res) => {
        if (!active) return;
        setDistinctResult(res);
        setLoadingValues(false);
        if (!currentFilter?.selectedValues && !res.exceededLimit) {
          // Default: all values selected
          setSelectedValues(new Set(res.values));
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error("Failed to load column distinct values:", err);
        setLoadingValues(false);
      });

    return () => {
      active = false;
    };
  }, [tabId, col, currentFilter?.selectedValues]);

  // Click outside and escape key handling
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const selectedConditionMeta = useMemo(
    () => CONDITION_OPTIONS.find((c) => c.value === condition),
    [condition],
  );

  const filteredValuesList = useMemo(() => {
    if (!distinctResult?.values) return [];
    if (!valuesSearch.trim()) return distinctResult.values;
    const q = valuesSearch.toLowerCase();
    return distinctResult.values.filter((v) => v.toLowerCase().includes(q));
  }, [distinctResult, valuesSearch]);

  const toggleValue = (val: string) => {
    setHasCustomValueSelection(true);
    setSelectedValues((prev) => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setHasCustomValueSelection(true);
    setSelectedValues((prev) => {
      const next = new Set(prev);
      for (const v of filteredValuesList) {
        next.add(v);
      }
      return next;
    });
  };

  const clearAllFiltered = () => {
    setHasCustomValueSelection(true);
    setSelectedValues((prev) => {
      const next = new Set(prev);
      for (const v of filteredValuesList) {
        next.delete(v);
      }
      return next;
    });
  };

  const handleApply = () => {
    const isCondActive = condition !== "none";
    let finalSelectedValues: string[] | undefined = undefined;

    if (hasCustomValueSelection && distinctResult && !distinctResult.exceededLimit) {
      // If all values are selected, we can omit selectedValues (None) for efficiency
      if (selectedValues.size !== distinctResult.values.length) {
        finalSelectedValues = Array.from(selectedValues);
      }
    }

    const newFilter: ColumnFilter = {
      col,
      condition: isCondActive ? condition : undefined,
      conditionValue: isCondActive && selectedConditionMeta?.requiresValue ? conditionValue : undefined,
      selectedValues: finalSelectedValues,
    };

    onApply(newFilter);
    onClose();
  };

  // Adjust anchor position so popover stays on screen
  const popoverWidth = 280;
  const left = Math.max(10, Math.min(anchor.x, window.innerWidth - popoverWidth - 16));
  const top = Math.min(anchor.y, window.innerHeight - 420);

  return (
    <div
      ref={containerRef}
      className="column-filter-popover"
      style={{
        position: "fixed",
        top,
        left,
        width: popoverWidth,
        maxHeight: "calc(100vh - 40px)",
        background: "var(--bg, #ffffff)",
        color: "var(--fg, #1f2937)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.16)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Title Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          background: "var(--hover, rgba(0,0,0,0.03))",
          fontWeight: 600,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Filter: Col {col + 1} {colName ? `(${colName})` : ""}
        </span>
        <button
          className="icon-btn"
          onClick={onClose}
          style={{ width: 20, height: 20, padding: 2 }}
          title="Close (Esc)"
          aria-label="Close filter"
        >
          <IconClose />
        </button>
      </div>

      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {/* Block 1: Sort */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Sort
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="column-filter-sort-btn"
              onClick={() => {
                onSort(false);
                onClose();
              }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "5px 8px",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 4,
                background: "var(--bg, #fff)",
                color: "var(--fg, inherit)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <IconArrowUp /> Sort A → Z
            </button>
            <button
              type="button"
              className="column-filter-sort-btn"
              onClick={() => {
                onSort(true);
                onClose();
              }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "5px 8px",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: 4,
                background: "var(--bg, #fff)",
                color: "var(--fg, inherit)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <IconArrowDown /> Sort Z → A
            </button>
          </div>
        </div>

        {/* Block 2: Filter by Condition */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            htmlFor={conditionSelectId}
            style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px" }}
          >
            Filter by condition
          </label>
          <select
            id={conditionSelectId}
            value={condition}
            onChange={(e) => setCondition(e.target.value as ConditionType)}
            style={{
              width: "100%",
              padding: "4px 6px",
              borderRadius: 4,
              border: "1px solid var(--border, #e5e7eb)",
              background: "var(--bg, #fff)",
              color: "var(--fg, inherit)",
              fontSize: 12,
            }}
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {selectedConditionMeta?.requiresValue && (
            <input
              id={conditionValueInputId}
              type="text"
              placeholder="Value or pattern…"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleApply();
              }}
              style={{
                width: "100%",
                padding: "4px 6px",
                borderRadius: 4,
                border: "1px solid var(--border, #e5e7eb)",
                background: "var(--bg, #fff)",
                color: "var(--fg, inherit)",
                fontSize: 12,
                boxSizing: "border-box",
              }}
            />
          )}
        </div>

        {/* Block 3: Filter by Values */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Filter by values
          </div>

          {loadingValues && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", color: "var(--fg)", opacity: 0.6 }}>
              <IconRefresh className="spin-icon" />
              <span>Scanning distinct values…</span>
            </div>
          )}

          {!loadingValues && distinctResult?.exceededLimit && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 4,
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                color: "#b45309",
                fontSize: 11,
                lineHeight: "15px",
              }}
            >
              Over 1,000 unique values. Use <strong>Filter by condition</strong> above to filter this column.
            </div>
          )}

          {!loadingValues && !distinctResult?.exceededLimit && distinctResult && (
            <>
              {/* Values search input */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search values…"
                  value={valuesSearch}
                  onChange={(e) => setValuesSearch(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "3px 6px 3px 24px",
                    borderRadius: 4,
                    border: "1px solid var(--border, #e5e7eb)",
                    background: "var(--bg, #fff)",
                    color: "var(--fg, inherit)",
                    fontSize: 11,
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ position: "absolute", left: 6, top: 4, opacity: 0.5, pointerEvents: "none" }}>
                  <IconSearch />
                </span>
              </div>

              {/* Action links */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--primary, #396cd8)",
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAllFiltered}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--danger, #d93025)",
                    cursor: "pointer",
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Clear
                </button>
              </div>

              {/* Values list */}
              <div
                style={{
                  maxHeight: 140,
                  overflowY: "auto",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 4,
                  padding: "2px 4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {filteredValuesList.length === 0 ? (
                  <div style={{ padding: "8px", textAlign: "center", opacity: 0.5, fontSize: 11 }}>
                    No matching values
                  </div>
                ) : (
                  filteredValuesList.map((val) => {
                    const isChecked = selectedValues.has(val);
                    return (
                      <label
                        key={val}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "2px 4px",
                          borderRadius: 3,
                          cursor: "pointer",
                          userSelect: "none",
                          background: isChecked ? undefined : "rgba(0,0,0,0.02)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleValue(val)}
                          style={{
                            width: 14,
                            height: 14,
                            cursor: "pointer",
                            accentColor: "var(--primary, #396cd8)",
                            margin: 0,
                          }}
                        />
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontStyle: val === "(Blanks)" ? "italic" : undefined,
                            opacity: val === "(Blanks)" ? 0.6 : 1,
                          }}
                        >
                          {val}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderTop: "1px solid var(--border, #e5e7eb)",
          background: "var(--hover, rgba(0,0,0,0.02))",
        }}
      >
        <button
          type="button"
          onClick={() => {
            onClear();
            onClose();
          }}
          style={{
            border: "1px solid var(--border, #e5e7eb)",
            background: "transparent",
            color: "var(--danger, #d93025)",
            padding: "4px 8px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          Clear Filter
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              background: "transparent",
              color: "var(--fg, inherit)",
              padding: "4px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              border: "none",
              background: "var(--primary, #396cd8)",
              color: "#fff",
              padding: "4px 14px",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
