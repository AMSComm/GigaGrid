import { useState, useEffect } from "react";
import { CURRENT_VERSION } from "../utils/updater";
import { getToolbarShortcutLabel } from "../utils/shortcuts";

export interface SelectionInfo {
  rows: number;
  cols: number;
  cells: number;
  numericCount?: number;
  sum?: number;
  loading?: boolean;
}

export interface GridStats {
  totalCols: number;
  cursor: { row: number; col: number } | null;
  selection: SelectionInfo | null;
}

export interface StatusFile {
  path: string;
  row_count: number;
  format: string;
  encoding: string;
  line_ending: string;
}

interface StatusBarProps {
  file: StatusFile;
  stats: GridStats;
  error?: string | null;
  updateAvailable?: boolean;
  onOpenUpdateDialog?: () => void;
  onReopenWithDelimiter?: (delimiter: string) => void;
  onReopenWithEncoding?: (encoding: string) => void;
  onChangeEncoding?: (encoding: string) => void;
  onChangeFormat?: (format: "CSV" | "TSV") => void;
  onChangeLineEnding?: (lineEnding: "LF" | "CRLF") => void;
}

export function StatusBar({
  file,
  stats,
  error,
  updateAvailable,
  onOpenUpdateDialog,
  onReopenWithDelimiter,
  onReopenWithEncoding,
  onChangeEncoding,
  onChangeFormat,
  onChangeLineEnding,
}: StatusBarProps) {
  const [showDelim, setShowDelim] = useState(false);
  const [showEnc, setShowEnc] = useState(false);
  const [showLineEnding, setShowLineEnding] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement)?.closest(".status-popover-anchor")) {
        setShowDelim(false);
        setShowEnc(false);
        setShowLineEnding(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowDelim(false);
        setShowEnc(false);
        setShowLineEnding(false);
      }
    }
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        padding: "2px 8px",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
        lineHeight: "16px",
        flexShrink: 0,
        whiteSpace: "nowrap",
        background: "var(--bg)",
        position: "relative",
        zIndex: 30,
      }}
    >
      <span
        style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, opacity: 0.8 }}
        title={file.path}
      >
        {file.path}
      </span>
      {error && (
        <span
          style={{ color: "var(--danger, #d93025)", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}
          title={error}
        >
          {error}
        </span>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
        <span style={{ opacity: 0.8 }}>{file.row_count.toLocaleString()} rows</span>
        <span style={{ opacity: 0.8 }}>{stats.totalCols} cols</span>

        {/* Format / Delimiter anchor */}
        <span style={{ position: "relative" }} className="status-popover-anchor">
          <span
            role="button"
            tabIndex={0}
            className="status-bar-btn"
            style={{ cursor: "pointer" }}
            data-active={showDelim}
            onClick={() => {
              setShowDelim((v) => !v);
              setShowEnc(false);
              setShowLineEnding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowDelim((v) => !v);
                setShowEnc(false);
                setShowLineEnding(false);
              }
            }}
            title="Click to switch format (CSV/TSV) or reopen with delimiter"
          >
            {file.format}
          </span>
          {showDelim && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                right: 0,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                minWidth: 170,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                padding: 4,
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, padding: "2px 6px", fontWeight: 600 }}>
                Format (Save As)
              </div>
              {[
                ["CSV", "CSV"],
                ["TSV", "TSV"],
              ].map(([label, fmt]) => {
                const isCurrent = file.format === fmt;
                return (
                  <button
                    type="button"
                    key={fmt}
                    className="status-popover-item"
                    data-current={isCurrent}
                    onClick={() => {
                      setShowDelim(false);
                      onChangeFormat?.(fmt as "CSV" | "TSV");
                    }}
                  >
                    <span>{label}</span>
                    {isCurrent && <span style={{ fontSize: 11, color: "var(--primary, #396cd8)" }}>✓</span>}
                  </button>
                );
              })}

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 4,
                  paddingTop: 4,
                  fontSize: 11,
                  opacity: 0.7,
                  paddingLeft: 6,
                  paddingRight: 6,
                  fontWeight: 600,
                }}
              >
                Reopen with Delimiter
              </div>
              {[
                ["Comma", ","],
                ["Tab", "\t"],
                ["Semicolon", ";"],
                ["Pipe", "|"],
              ].map(([label, d]) => (
                <button
                  type="button"
                  key={d}
                  className="status-popover-item"
                  onClick={() => {
                    setShowDelim(false);
                    onReopenWithDelimiter?.(d);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </span>

        {/* Encoding anchor */}
        <span style={{ position: "relative" }} className="status-popover-anchor">
          <span
            role="button"
            tabIndex={0}
            className="status-bar-btn"
            style={{ cursor: "pointer" }}
            data-active={showEnc}
            onClick={() => {
              setShowEnc((v) => !v);
              setShowDelim(false);
              setShowLineEnding(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowEnc((v) => !v);
                setShowDelim(false);
                setShowLineEnding(false);
              }
            }}
            title="Click to switch encoding"
          >
            {file.encoding}
          </span>
          {showEnc && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                right: 0,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                padding: 4,
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, padding: "2px 6px", fontWeight: 600 }}>
                Encoding
              </div>
              {[
                ["Auto-Detect", "auto"],
                ["UTF-8", "utf-8"],
                ["Shift-JIS", "shift_jis"],
                ["EUC-JP", "euc-jp"],
                ["Windows-1252", "windows-1252"],
                ["GB18030", "gb18030"],
                ["Big5", "big5"],
                ["EUC-KR", "euc-kr"],
              ].map(([label, enc]) => {
                const isCurrent =
                  enc === "auto"
                    ? false
                    : file.encoding.toLowerCase().replace(/[-_]/g, "") ===
                      enc.toLowerCase().replace(/[-_]/g, "");
                return (
                  <button
                    type="button"
                    key={enc}
                    className="status-popover-item"
                    data-current={isCurrent}
                    onClick={() => {
                      setShowEnc(false);
                      if (onChangeEncoding) {
                        onChangeEncoding(enc);
                      } else {
                        onReopenWithEncoding?.(enc);
                      }
                    }}
                  >
                    <span>{label}</span>
                    {isCurrent && <span style={{ fontSize: 11, color: "var(--primary, #396cd8)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </span>

        {/* Line Ending anchor */}
        <span style={{ position: "relative" }} className="status-popover-anchor">
          <span
            role="button"
            tabIndex={0}
            className="status-bar-btn"
            style={{ cursor: "pointer" }}
            data-active={showLineEnding}
            onClick={() => {
              setShowLineEnding((v) => !v);
              setShowDelim(false);
              setShowEnc(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setShowLineEnding((v) => !v);
                setShowDelim(false);
                setShowEnc(false);
              }
            }}
            title="Click to switch line ending"
          >
            {file.line_ending}
          </span>
          {showLineEnding && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 6px)",
                right: 0,
                zIndex: 100,
                display: "flex",
                flexDirection: "column",
                minWidth: 160,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
                padding: 4,
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.7, padding: "2px 6px", fontWeight: 600 }}>
                Line Ending
              </div>
              {[
                ["LF (Unix / macOS - \\n)", "LF"],
                ["CRLF (Windows - \\r\\n)", "CRLF"],
              ].map(([label, le]) => {
                const isCurrent = file.line_ending.toUpperCase() === le;
                return (
                  <button
                    type="button"
                    key={le}
                    className="status-popover-item"
                    data-current={isCurrent}
                    onClick={() => {
                      setShowLineEnding(false);
                      onChangeLineEnding?.(le as "LF" | "CRLF");
                    }}
                  >
                    <span>{label}</span>
                    {isCurrent && <span style={{ fontSize: 11, color: "var(--primary, #396cd8)" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </span>

        {stats.cursor && (
          <span style={{ opacity: 0.8 }}>
            cursor: R{stats.cursor.row + 1}, C{stats.cursor.col + 1}
          </span>
        )}
        {stats.selection && stats.selection.cells > 1 && (
          <span style={{ opacity: 0.8 }} title={`${stats.selection.cells.toLocaleString()} cells selected`}>
            selection: {stats.selection.cells.toLocaleString()} cells ({stats.selection.rows.toLocaleString()}R × {stats.selection.cols.toLocaleString()}C)
            {stats.selection.loading && <span> | Sum: …</span>}
            {!stats.selection.loading && stats.selection.numericCount !== undefined && stats.selection.numericCount > 0 && (
              <span>
                {" | "}Count: {stats.selection.numericCount.toLocaleString()} | Sum: {stats.selection.sum!.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </span>
            )}
          </span>
        )}

        <span
          role="button"
          tabIndex={0}
          className="status-bar-btn status-bar-version-btn"
          style={{ cursor: "pointer" }}
          onClick={onOpenUpdateDialog}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpenUpdateDialog?.();
            }
          }}
          title={
            updateAvailable
              ? `Update available! Click or ${getToolbarShortcutLabel("update")} to view (v${CURRENT_VERSION})`
              : `Gigagrid v${CURRENT_VERSION} (${getToolbarShortcutLabel("update")})`
          }
          aria-label={
            updateAvailable
              ? `Update available! Click to view (v${CURRENT_VERSION})`
              : `Gigagrid v${CURRENT_VERSION}`
          }
        >
          <span>v{CURRENT_VERSION}</span>
          {updateAvailable && <span className="status-bar-update-dot" />}
        </span>
      </div>
    </div>
  );
}
