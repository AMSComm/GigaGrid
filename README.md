# ⚡ Gigagrid

<p align="center">
  <img src="./public/icon.png" width="96" height="96" alt="Gigagrid Icon" style="border-radius: 16px;" />
</p>

<h3 align="center">High-Performance Desktop CSV &amp; Tabular Data Workspace</h3>

<p align="center">
  <strong>Native Desktop (macOS, Windows, Linux) built with Tauri v2 + Rust Core + React 19</strong><br/>
  Ultra-fast, space-optimized viewer and editor engineered for GB-scale tabular datasets (5–20GB+ / tens of millions of rows).
</p>

<p align="center">
  <a href="https://github.com/AMSComm/GigaGrid/releases"><img src="https://img.shields.io/badge/Release-v0.3.1-396cd8?style=flat-square" alt="Version 0.3.1" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-10b981?style=flat-square" alt="License MIT" /></a>
  <img src="https://img.shields.io/badge/Desktop-Tauri_v2-22c55e?style=flat-square&logo=tauri" alt="Tauri v2" />
  <img src="https://img.shields.io/badge/Core-Rust_ByteOffset-f97316?style=flat-square&logo=rust" alt="Rust Core" />
  <img src="https://img.shields.io/badge/Tests-31%2F31_Passed-06b6d4?style=flat-square" alt="Tests 31/31" />
</p>

---

## 💡 Why Gigagrid?

Traditional spreadsheet applications and Electron-based CSV editors crash with Out-Of-Memory (OOM) errors or freeze when loading files larger than a few hundred megabytes. **Gigagrid** is built from the ground up to handle massive tabular files effortlessly:

| Metric / Feature | Microsoft Excel | Heavy CSV Plugins / Electron | ⚡ Gigagrid |
|:---|:---:|:---:|:---:|
| **File Size Limit** | 1,048,576 rows (~100MB) | 1GB - 2GB (Frequent OOM Crash) | **20GB+ / Tens of Millions of Rows** |
| **Memory Footprint** | ~500MB - 2GB+ | ~800MB - 3GB+ | **< 45MB** (Seek-on-demand) |
| **Open Time (5GB CSV)** | Cannot open / Hangs | ~45s - 180s (Full parse) | **< 0.25s** (Byte-offset row index) |
| **Scrolling & Navigation** | Laggy on large sheets | High CPU throttle | **Virtualized DOM + Rust Fast Seek** |
| **Data Safety** | Silent format corruption risks | Overwrites file on edit | **In-Memory Edits; Raw file untouched until Save** |
| **Cross-Platform** | Windows/macOS (Subscription) | Heavy bundled runtime | **Native macOS (.dmg), Windows (.msi/.exe), Linux (.deb)** |

---

## 📸 Key Features Showcase

### 1. Instant GB-Scale File Viewing (Byte-Offset Row Indexing)
Opens multi-gigabyte CSV and TSV files instantly without loading the full content into RAM. It builds a lightweight byte-offset index and seeks data on-the-fly as you scroll through millions of rows.

<p align="center">
  <img src="./docs/demo.gif" alt="Gigagrid Demo" width="100%" style="border-radius: 8px; border: 1px solid var(--border);" />
</p>

### 2. Multi-Tab Workspace & Drag-and-Drop
- **Multi-Tab Navigation**: Open and switch between up to 10 independent GB-scale files simultaneously with adaptive tab sizing and quick shortcuts (`Cmd/Ctrl + 1-9`, `Cmd/Ctrl + W`).
- **Drag-and-Drop Import**: Drag CSV or TSV files directly into the window with an animated drop zone overlay.

### 3. In-Place Cell Editing & Complete Undo/Redo
- Edit cells directly in the grid; overflowing content auto-scrolls smoothly into view.
- Complete undo/redo history (`Cmd/Ctrl + Z`, `Cmd/Ctrl + Shift + Z`), including one-step undo for massive block pastes.
- Raw file remains completely untouched on disk until you explicitly press Save (`Cmd/Ctrl + S`).

### 4. Floating Find & Replace Panel & Go to Row/Col
- Compact floating search overlay (`Cmd/Ctrl + F`) with auto-text selection, forward/backward navigation, and match counter.
- Single and batch Find & Replace with immediate grid synchronization.
- Jump directly to any row or column coordinate via the Go To tool.

### 5. Column Freezing & Ragged Row Detection
- **Freeze N Columns**: Keep key identifier columns pinned to the left during horizontal scrolling.
- **Ragged Row Flagging**: Automatically flags malformed rows with mismatched column counts to catch syntax issues early.

### 6. Auto Delimiter Sniffing & Multi-Encoding Conversion
- Sniffs comma, tab, semicolon, and pipe delimiters automatically, with manual override support.
- Live switching between encodings (UTF-8, Shift-JIS, Windows-1252, etc.) and line endings (CRLF / LF) directly from the status bar.

---

## 📥 Download & Installation

Download official pre-built packages from [GitHub Releases](https://github.com/AMSComm/GigaGrid/releases):

- **macOS:** `Gigagrid-universal.dmg` (Universal Binary for Apple Silicon & Intel)
- **Windows:** `Gigagrid_x64-setup.exe` / `Gigagrid_x64.msi`
- **Linux:** `gigagrid_amd64.deb` / `Gigagrid.AppImage`

> 🔄 **In-App Auto-Update:** Built-in updater automatically notifies you of new releases, displays detailed changelogs, tracks download progress, and relaunches the app in one click. Check manually anytime via the **Toolbar Download Icon (⬇️)**.

---

## 🛠️ Local Development

### Prerequisites
- **Node.js:** v22+
- **Rust & Cargo:** stable toolchain (`rustup default stable`)

### Ubuntu / Debian System Dependencies
```bash
sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf xdg-utils
```

### Setup & Run
```bash
# Clone the repository
git clone https://github.com/AMSComm/GigaGrid.git
cd GigaGrid

# Install frontend dependencies
npm install

# 1. Run web frontend in dev mode
npm run dev

# 2. Run native desktop app (Tauri v2)
npm run tauri dev

# 3. Run automated tests
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut (Win/Linux) | Shortcut (macOS) | Action |
|:---|:---|:---|
| `Ctrl + O` | `Cmd + O` | **Open File** dialog |
| `Ctrl + S` | `Cmd + S` | **Save active document** |
| `Ctrl + W` | `Cmd + W` | **Close active tab** |
| `Ctrl + 1 .. 9` | `Cmd + 1 .. 9` | **Switch to tab 1 through 9** |
| `Ctrl + F` | `Cmd + F` | **Toggle Floating Find & Replace Panel** |
| `Enter` | `Enter` | **Enter inline cell edit mode** |
| `Escape` | `Escape` | **Cancel cell edit / dismiss panel** |
| `Ctrl + Z` | `Cmd + Z` | **Undo last edit or paste** |
| `Ctrl + Shift + Z` | `Cmd + Shift + Z` | **Redo edit** |
| `Arrow Keys` | `Arrow Keys` | **Navigate between cells** |
| `Shift + Arrow Keys` | `Shift + Arrow Keys` | **Multi-cell range selection** |

---

## 🏗️ Architecture & Project Structure

```
gigagrid/
├── .github/workflows/
│   ├── release.yml             # Multi-platform CI/CD & Universal Desktop release automation
│   ├── sync-release-notes.yml  # On-demand GitHub Release notes sync from CHANGELOG.md
│   └── ci.yml                  # PR and branch validation pipeline
├── src/                        # React 19 Frontend Grid Workspace
│   ├── components/             # Virtualized Grid, Cell, Toolbar, SearchPanel, StatusBar, UpdateDialog
│   ├── utils/                  # In-app updater, version comparison, helpers
│   ├── icons.tsx               # Minimal hand-drawn SVG icon set (zero external dependency)
│   └── settings.ts             # Theme, freeze columns, and recent files persistence
├── src-tauri/                  # Tauri v2 Native Desktop Rust Subsystem
│   ├── src/                    # Byte-offset indexer, seek engine, delimiter/encoding sniffer
│   ├── capabilities/           # Desktop capability and permission definitions
│   └── tauri.conf.json         # Desktop window geometry, file associations & updater config
├── docs/                       # Hero GIF demo and visual assets
├── CHANGELOG.md                # Standardized Keep a Changelog documentation
└── LICENSE                     # MIT License
```

---

## 📄 License & Author

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

Developed and maintained by **[AM Software](https://amsoftware.com.vn)**. Copyright © 2026 **AM Software**. All rights reserved.
