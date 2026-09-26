# Changelog

All notable changes to **Gigagrid** will be documented in this file.

## [v0.5.0] - 2026-09-26

### 🚀 Features & Enhancements
- **Keyboard Shortcuts on Toolbar Buttons**: Added visual shortcut badges to functional toolbar buttons (`⌘O` / `Ctrl+O`, `⌘S` / `Ctrl+S`, `⌘F` / `Ctrl+F`, `⇧⌘F` / `Ctrl+Shift+F`, `⌘L` / `F5`, `⌘Z` / `Ctrl+Z`, `⇧⌘Z` / `Ctrl+Shift+Z`, `⌘N` / `Ctrl+N`) for immediate discoverability and high-efficiency keyboard workflows.
- **Global Keybindings Expansion**: Implemented global shortcuts for jumping to rows/columns (`Cmd/Ctrl + L` / `F5`), opening the multi-criteria filter popover (`Cmd/Ctrl + Shift + F`), toggling and stepping through search results (`Cmd/Ctrl + G` / `Cmd/Ctrl + Shift + G`), and quick tab cycling.
- **Toolbar Layout Reorganization**: Reorganized toolbar into distinct functional groups (History/Undo, Data Tools & Inspection, File Management) separated by subtle vertical dividers, moving file actions (`New`, `Open`, `Save`) cleanly to the right side of the toolbar.
- **Status Bar Version & Updater Anchor**: Relocated the "Check for Updates" version badge from the top toolbar to the bottom-right status bar, streamlining the primary workspace header while keeping update status accessible.

---

## [v0.4.4] - 2026-09-26

### 🐛 Bug Fixes
- **Sticky Chrome TopCover in Virtual Scroll Bounds**: Fixed an issue where the very last row in massive datasets (e.g. 2,000,000 rows) was cut off and could not be scrolled completely into view. Included the height of sticky column headers and frozen rows (`topCover`) into both physical and virtual scroll boundary computations, ensuring the last row sits 100% flush at the bottom of the viewport with zero clipping.
- **Frozen Header Container DOM Stabilization**: Ensured the frozen header bar container remains stable in the DOM with placeholders while row 0 loads asynchronously, eliminating layout jitter and preserving exact scroll coordinates from initial render.

---

## [v0.4.3] - 2026-09-25

### 🐛 Bug Fixes
- **Virtual Scroll Height Scaling (>1M Rows)**: Overcame the browser's hard DOM element height limit (~33.55M px) via virtual scroll stretching and height scaling. Gigagrid can now smoothly scroll, jump, and navigate through millions of rows all the way to the end without hitting container ceilings.
- **Scroll Position Mapping**: Linearly maps physical container scroll positions to virtual row coordinates, ensuring `scrollToRow`, arrow-key navigation, and search result jumping work across datasets of any scale.
- **Error Boundary & Crash Resilience**: Added a root React `ErrorBoundary` and global error handling to safeguard against unexpected runtime or IPC errors, preventing white-screen crashes.

---

## [v0.4.2] - 2026-09-24

### 🐛 Bug Fixes
- **Dynamic Row Gutter Sizing**: Scaled the row-number gutter width dynamically according to total dataset rows (`rowCount`), preventing line numbers on large datasets (hundreds of thousands or millions of rows) from expanding and causing horizontal misalignment between column headers and data rows.
- **Unified Fixed Gutter Dimensions**: Pinned `width`, `minWidth`, and `maxWidth` across the top-left header corner, frozen row, and all virtualized rows to ensure pixel-perfect vertical alignment at any scroll depth.

---

## [v0.4.1] - 2026-09-24

### 🐛 Bug Fixes
- **Filter Popover Alignment & Overflow**: Aligned the multi-criteria filter popover to the right edge expanding towards the left (`right: 0`), preventing viewport boundary overflow and eliminating unwanted horizontal and vertical window-level scrollbars.
- **Responsive Sizing**: Adjusted filter criteria column selection width (`100px`) and search input (`minWidth: 0, flex: 1`) with bounds capping (`maxWidth: min(320px, calc(100vw - 24px))`) to ensure clean rendering across all window resolutions.
- **Window Scroll Guard**: Pinned `overflow: hidden` on root `html, body` to maintain strict desktop application viewport boundaries.

---

## [v0.4.0] - 2026-09-24

### 🚀 Features & Enhancements
- **Multi-Criteria Filter Popover**: Replaced the single inline filter text input with a dedicated Filter button and Popover dropdown. Supports filtering by a specific column or all columns, combined with AND logic and case-insensitive matching.
- **Selection Statistics (Count & Sum)**: Enhanced status bar selection readout displaying selected cells, rows, and columns, with automatic calculation of Count and Sum for numeric cells.
- **High-Performance Hybrid Calculation**: Zero-latency instant JavaScript calculation for visible/cached rows, and debounced asynchronous Rust core evaluation (`get_selection_stats`) for large/GB-scale selections without UI lag.

---

## [v0.3.1] - 2026-09-23

### ⚙️ Architecture & Standardization
- **Modern Package Management**: Migrated from npm to `pnpm 11.0.9` with deterministic lockfile.
- **Core Ecosystem Upgrade**: Upgraded React to `^19.2.8` (React 19.3 runtime), Tauri core to `^2.11.1`, and `@tauri-apps/plugin-updater` to `^2.12.0`.
- **High-Speed Linting**: Integrated Oxlint (`^1.81.0`) with automated validation steps across local scripts and GitHub Actions workflows.
- **CI/CD Alignment**: Synchronized GitHub Actions release and quality workflows with frozen lockfile support and automated release notes synchronization.
- **Licensing & Identity**: Standardized MIT License attribution to AM Software.

---

## [v0.3.0] - 2026-09-22

### 🚀 Features & Enhancements
- **Drag-and-Drop File Opening**: Drag any CSV/TSV file directly onto the window with visual drop zone feedback.
- **Linux Platform Support**: Full native packaging for Ubuntu/Debian (`.deb`) and AppImage.

### ⚡ Performance & Byte-Offset Indexing
- **Instant GB File Seeking**: Zero-memory full-load with O(1) row lookups.
- **Multi-Tab Architecture**: Open and switch between multiple large files seamlessly (up to 10 tabs).

### 🛠️ Maintenance & Branding
- **AM Software Ownership**: Updated repository metadata, author attribution, and documentation.

---

## [v0.2.3] - 2026-09-18

### 🚀 Features & Enhancements
- **Tab Open Shortcut (`Cmd/Ctrl + O`)**: Fast native file picker shortcut for opening CSV/TSV documents.
- **TSV Detection & Switching**: Enhanced tab-separated values support with automatic delimiter switching.
- **Status Bar Popovers**: Improved interaction and visual alignment for format, encoding, and line-ending selectors.

### 🧪 Testing & Reliability
- **Selector Stability**: Restored visual-check test selectors and mocked dialog handling for automated UI tests.

---

## [v0.2.2] - 2026-09-17

### 🚀 Features & Enhancements
- **Keyboard Shortcuts**: Added `Cmd/Ctrl + W` to close active tabs and `Cmd/Ctrl + S` to save.
- **Encoding & Line Ending Conversion**: Live switching and conversion between UTF-8, Shift-JIS, Windows-1252, CRLF, and LF.

---

## [v0.2.1] - 2026-09-15

### 🎨 Visual & Identity
- **Adaptive Tab Sizing**: Flexible tab widths with automatic label truncation and smart close button visibility.
- **Floating Find & Replace Panel**: Compact overlay at the top-right corner with auto-select on open (`Cmd/Ctrl + F`).
- **Tab Focus Guard**: Automatically focuses existing tab when attempting to reopen an already active file path.

---

## [v0.2.0] - 2026-09-12

### 🚀 Features & Enhancements
- **Column Freezing**: Freeze N leading columns for persistent row headers during horizontal scrolling.
- **Ragged Row Flagging**: Automatically flags malformed rows with mismatched column counts.
- **Recent Files Quick List**: Easily reopen recently accessed files.
- **4-Way Delimiter Sniffer**: Automatic detection of comma, tab, semicolon, and pipe delimiters.

### 🎨 Visual & Identity
- **Refined Toolbar Groups**: Reorganized toolbar into distinct functional groups with improved icons.
- **Status Bar Error Notifications**: Moved error banners into the non-intrusive bottom status bar.

---

## [v0.1.4] - 2026-09-11

### 🚀 Features & Enhancements
- **Full-Text Find & Replace**: Instant search with forward/backward navigation and single/batch replace.
- **Context Menu Cell Operations**: Insert and delete rows/columns directly from the right-click context menu.

---

## [v0.1.3] - 2026-09-11

### 🔒 Security & Auto-Update
- **Signed Auto-Update Keypair**: Regenerated updater keypair and verification flow.

---

## [v0.1.2] - 2026-09-11

### 🐛 Bug Fixes & Stability
- **Cell Auto-Scroll Precision**: Resolved cell auto-scroll offset under header/gutter boundaries.
- **Scrollbar Interaction**: Prevented edit box from prematurely closing during scrollbar drag.

---

## [v0.1.1] - 2026-09-10

### 🐛 Bug Fixes & Cross-Platform Stability
- **Cross-Platform Event Handling**: Gated macOS-specific `RunEvent::Opened` to fix Windows and Linux compilation.
- **Multi-Tab Backend**: Completed multi-document state engine in Rust.

---

## [v0.1.0] - 2026-09-10

### 🚀 Initial Desktop Release
- **Byte-Offset Virtualized CSV Viewer**: Instant GB-scale tabular viewing without loading entire files into RAM.
- **In-Place Cell Editing**: Fast inline editing with full Undo/Redo stack.
- **Multi-Cell Selection**: Range selection and TSV clipboard copy/paste compatible with Excel and Google Sheets.
- **Multi-Platform Support**: Packaged for macOS, Windows, and Linux via Tauri v2.
