# Changelog

All notable changes to **Gigagrid** will be documented in this file.

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
