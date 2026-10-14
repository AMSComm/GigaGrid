import { memo, useEffect, useRef, useState } from "react";

const MIN_WIDTH = 100;
const MIN_HEIGHT = 28;
const EDGE_MARGIN = 4;

const STATIC_CELL_STYLE: React.CSSProperties = {
  boxSizing: "border-box",
  padding: "0 6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%",
  position: "relative",
};

const MODIFIED_DOT_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 2,
  right: 2,
  width: 5,
  height: 5,
  borderRadius: "50%",
  backgroundColor: "#f59e0b",
  pointerEvents: "none",
};

interface CellProps {
  value: string;
  editing: boolean;
  onRequestEdit: () => void;
  onCommit: (value: string) => void;
  onEditEnd: () => void;
  onOverflow?: () => void;
  isModified?: boolean;
}

interface EditingCellProps {
  value: string;
  onCommit: (value: string) => void;
  onEditEnd: () => void;
  onOverflow?: () => void;
}

function EditingCell({ value, onCommit, onEditEnd, onOverflow }: EditingCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const scrollEl = el.closest<HTMLElement>("[data-gigagrid-scroll]");
    const cellRect = el.getBoundingClientRect();
    const scrollRect = scrollEl?.getBoundingClientRect();
    const availableWidth = scrollRect
      ? Math.max(MIN_WIDTH, scrollRect.right - cellRect.left - EDGE_MARGIN)
      : MIN_WIDTH;
    const availableHeight = scrollRect
      ? Math.max(MIN_HEIGHT, scrollRect.bottom - cellRect.top - EDGE_MARGIN)
      : MIN_HEIGHT;
    const columnWidth = el.parentElement?.getBoundingClientRect().width ?? MIN_WIDTH;
    const widthFloor = Math.max(MIN_WIDTH, columnWidth);

    el.style.whiteSpace = "pre";
    el.style.width = "auto";
    el.style.height = "auto";
    const naturalWidth = el.scrollWidth;
    const wantedWidth = Math.min(availableWidth, Math.max(widthFloor, naturalWidth));

    el.style.whiteSpace = "pre-wrap";
    el.style.width = `${wantedWidth}px`;
    el.style.height = "auto";
    const naturalHeight = el.scrollHeight;
    const wantedHeight = Math.min(availableHeight, Math.max(MIN_HEIGHT, naturalHeight));
    el.style.height = `${wantedHeight}px`;

    if (naturalWidth > wantedWidth || naturalHeight > wantedHeight) {
      onOverflow?.();
    }
  }, [draft, onOverflow]);

  function commit() {
    if (draft !== value) onCommit(draft);
    onEditEnd();
  }

  function cancel() {
    setDraft(value);
    onEditEnd();
  }

  return (
    <textarea
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") cancel();
      }}
      style={{
        position: "absolute",
        zIndex: 1,
        boxSizing: "border-box",
        resize: "none",
        font: "inherit",
        color: "var(--fg)",
        background: "var(--bg)",
        border: "1px solid var(--border)",
      }}
    />
  );
}

/** One editable cell: double-click/Enter (parent decides which cell, via
 * `editing`/`onRequestEdit`) to edit, Enter/blur to commit, Escape to
 * cancel. In static (view) mode, renders as a lightweight zero-hook div. */
export const Cell = memo(function Cell({
  value,
  editing,
  onRequestEdit,
  onCommit,
  onEditEnd,
  onOverflow,
  isModified,
}: CellProps) {
  if (editing) {
    return (
      <EditingCell
        value={value}
        onCommit={onCommit}
        onEditEnd={onEditEnd}
        onOverflow={onOverflow}
      />
    );
  }

  return (
    <div
      onDoubleClick={onRequestEdit}
      style={STATIC_CELL_STYLE}
    >
      {isModified && (
        <span
          style={MODIFIED_DOT_STYLE}
          title="Edited under filter"
        />
      )}
      {value}
    </div>
  );
});
