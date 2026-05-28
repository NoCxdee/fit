<div align="center">
  <img src="public/fit_new_logo.png" width="96" alt="Fit Logo" />

  # Fit
  *The Ultra-Lightweight - Agentic Development Workspace*

  [![License](https://img.shields.io/badge/License-MIT-success?style=flat-square)](LICENSE)
  [![RAM](https://img.shields.io/badge/RAM-~10_MB-blue?style=flat-square)](https://tauri.app/)
  [![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey?style=flat-square)](#)
  [![Framework](https://img.shields.io/badge/Built_with-Tauri_2.0-orange?style=flat-square)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-19.0-61dafb?style=flat-square)](https://react.dev/)

  ⭐ If you like this workspace, star it on GitHub!

  [Overview](#overview) • [Key Features](#key-features) • [Why 10MB RAM?](#why-10mb-ram) • [Architecture](#architecture) • [Getting Started](#getting-started) • [Tech Stack](#tech-stack)
</div>

---

Fit is an ultra-lightweight, high-performance development and terminal workspace inspired by the clean, warm-charcoal aesthetics of Warp. Designed for modern developers who value speed, aesthetics, and minimalist resource usage, Fit combines a beautiful, responsive desktop shell with local git version control, live port previews, a high-performance terminal grid, and a full-featured code editor.


---

## Why 10MB RAM?

Typical modern development tools (such as Electron-based IDEs like VS Code, Cursor, or Slack) pack entire copies of Chromium and Node.js. This architecture leads to heavy startup footprints that easily consume 300MB to 500MB+ of system memory even when idle.

Fit takes a completely different path:
* **Native OS Rendering:** By utilizing **Tauri 2.0**, Fit drops Chromium entirely. It renders the frontend using the host operating system's native Webview (WebView2 on Windows, WebKit on macOS/Linux), sharing system assets and minimizing overhead.
* **Rust-Engineered Core:** The backend is written in Rust, utilizing a low-overhead, asynchronous PTY manager (`portable-pty` + `tokio`).
* **Advanced Size Optimizations:** The production release configuration is optimized specifically for minimum size and maximum memory efficiency:
  ```toml
  [profile.release]
  panic = "abort"      # Aborts on panic to eliminate stack unwinding code
  codegen-units = 1    # Enables maximum inter-procedural optimization
  lto = true           # Link-Time Optimization across all crates
  opt-level = "s"      # Optimizes binary specifically for size
  strip = true         # Strips all debug symbols and tables from the binary
  ```

The result is a fully integrated IDE experience that launches instantly and hovers at **literally ~10 MB of RAM** during baseline operation.

---

## Key Features

### 🖥️ Integrated Terminal Grid
* **Multi-Shell Support:** Spawns and manages native shells on Windows (PowerShell, Cmd, Git Bash, WSL) and Linux/macOS.
* **Hardware Acceleration:** Powered by `xterm.js` with hardware-accelerated **WebGL rendering** for zero-latency typing and scrollback.
* **Smart Splits:** Drag, resize, and split terminal panels horizontally or vertically inside resizable panels to build your layout.

### 📝 CodeMirror 6 Editor
* **Modern Syntaxes:** Built-in syntax highlighting support for Javascript/TS, HTML, CSS, JSON, Python, Rust, and Markdown.
* **State Syncing:** Real-time file state monitoring with visual tab state handling and unsaved-state indicators.
* **Integrated Keymaps:** Fully supports standard editor shortcuts, tab indentations, and `Ctrl+S` auto-saves back to disk.

### 🌿 Native Source Control (Git)
* **Real-time Status Polling:** Background polling automatically updates modified, added, and untracked file listings.
* **Diff Viewer:** High-fidelity side-by-side comparison of local modifications.
* **One-Click Actions:** Stage, unstage, commit, discard, and sync modifications (fetch, pull, push) using a dedicated Git sidebar.

### 🌐 Live Preview & Port Scanner
* **Embedded Previews:** Run live development servers in a dedicated browser pane directly alongside code and terminals.
* **Smart Detection:** Automatically scans local open ports to locate running development servers and maps them to frameworks (Next.js, Vite, Astro, Angular, Python, Jupyter).

### 🎨 Warp-Inspired Aesthetics
* **Warm Canvas Tone:** Dressed in a cozy `#2b2622` near-charcoal canvas—softer and more comfortable for long sessions than pure black.
* **Micro-Animations:** A beautiful, physics-based particle loader that renders interactive particles responsive to mouse coordinates on the welcome screen.
* **Inter & Instrument Serif Typography:** Clear Inter body text paired with Instrument Serif italics for an editorial, premium feel.

---

## Tech Stack

| Layer | Technologies | Role |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Vite | User interface, layout, and component system |
| **Text Editing** | CodeMirror 6 | Editor component, syntax highlighting, and state listeners |
| **Terminal Core** | XTerm.js, WebGL Addon, Fit Addon | Emulation, hardware-accelerated rendering, and auto-resize |
| **State & Layout** | React Context + `useReducer`, `react-resizable-panels` | Zero-dependency state engine, draggable panels |
| **App Backend** | Rust, Tauri 2.0 | File I/O, Dialog plugins, IPC routing, OS bindings |
| **Terminal PTY** | `portable-pty`, `tokio` | Native terminal spawning and multi-threaded streams |

---

## Getting Started

### Prerequisites

To build and run Fit from source, you need:
* **Node.js** (v20 or higher)
* **Rust & Cargo** (v1.77 or higher)
* **Git** (installed and registered in system PATH)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/fit.git
   cd fit
   ```

2. Install npm dependencies:
   ```bash
   npm install
   ```

### Development

Run the frontend in Web mode (Vite Dev Server):
```bash
npm run dev
```

Run the application as a Tauri Desktop app:
```bash
npm run tauri dev
```

> [!NOTE]
> When running `tauri dev`, Rust compiles the backend in debug mode, which contains logs and symbols. The footprint in debug mode will be larger; to verify the ~10MB RAM footprint, build a production release.

### Building for Production

Compile and bundle the optimized desktop executable:
```bash
npm run build
# followed by:
npm run tauri build
```

The production installer will be located in the `src-tauri/target/release/bundle/` directory.

---

> [!IMPORTANT]
> **Shell Configuration on Windows:** If your terminal fails to spawn a specific shell (e.g. Git Bash), verify that the executable path matches the standard paths (`C:\Program Files\Git\bin\bash.exe`) or is fully registered in your system `PATH`.
