# ClipDown

Local-first YouTube downloader for clippers, researchers, and archivists.

Built with [Tauri v2](https://v2.tauri.app) (Rust) + React 19 — no Python runtime needed.

---

## Features

| Feature | Status |
|---------|--------|
| Browse channel content (videos, shorts, streams, playlists) | ✅ |
| Download with format/resolution selection | ✅ |
| Audio-only extraction (MP3, M4A, FLAC, Opus, WAV) | ✅ |
| Video container selection (MP4, MKV, WebM, AVI) | ✅ |
| Multi-select and bulk download | ✅ |
| Real-time download progress (speed, ETA, percentage) | ✅ |
| Configurable concurrent downloads (1-10) | ✅ |
| Download queue with pause/resume/cancel | ✅ |
| Download history with play file / open folder | ✅ |
| Frameless custom title bar with window controls | ✅ |
| Dark / Light / System theme | ✅ |
| YouTube cookie authentication (Firefox auto-detect + cookies.txt) | ✅ |
| Auto-download and in-app management of yt-dlp & FFmpeg | ✅ |
| Search within channel videos | ✅ |
| Pagination (20 items per page) | ✅ |
| Playlist contents auto-expand on download | ✅ |
| Settings persistence across restarts | ✅ |
| Sidebar navigation with dedicated pages | ✅ |
| Skeleton loading states and channel URL validation | ✅ |
| Lazy-loading of shorts/streams content tabs | ✅ |

---

## Installation

### Option 1: NSIS Installer (recommended)

Download the latest `.exe` installer from the [Releases](https://github.com/YOUR_USERNAME/channel-downloader/releases) page:

```
Channel-Downloader_x64-setup.exe
```

Run it — it installs per-user (no admin required) and adds a Start Menu shortcut.

### Option 2: Portable Standalone

Download the standalone executable from the [Releases](https://github.com/YOUR_USERNAME/channel-downloader/releases) page:

```
app.exe
```

Place it anywhere and run. The app stores its data (downloaded tools, settings) in `%LOCALAPPDATA%\com.clipdown.app\`.

> **Note:** On first run, the app will prompt you to install yt-dlp and FFmpeg via the Settings page.

---

## How to Use

### 1. Fetch a Channel

1. Copy a YouTube channel URL — supports these formats:
   - `https://youtube.com/@handle`
   - `https://youtube.com/channel/UC...`
   - `https://youtube.com/c/customname`
2. Paste it into the input field at the top of the Home page
3. Press **Fetch** or hit Enter

### 2. Browse Content

- Switch between **Videos**, **Shorts**, **Streams**, and **Playlists** tabs
- Use the **search bar** to filter by title
- Navigate pages with the **pagination controls**
- Hover over a card to reveal the **selection checkbox**

### 3. Select & Download

- Click checkbox on individual items, or use **Select All** in the tab header
- Click **Download Selected** (visible when 1+ items are selected)
- Choose format, resolution/quality, container (for video), and output folder
- Click **Download Now** to start

### 4. Manage Downloads

- Go to the **Queue** page to monitor progress, pause, resume, or cancel
- Completed items get a **Play** button (opens in default media player) and **Open Folder** button
- Use the **History** page to revisit completed downloads

### 5. Settings

- **Appearance**: Light, Dark, or System theme
- **YouTube Authentication**: Point to a cookies.txt file exported from your browser, or Firefox is auto-detected for cookie-based auth
- **Download Location**: Choose a default output folder
- **Tools**: Check, install, or update yt-dlp and FFmpeg

---

## FAQ

### Q: Do I need Python installed?
**No.** yt-dlp is a standalone executable that the app downloads automatically. FFmpeg is also bundled.

### Q: How do I download age-restricted or private videos?
Export cookies from your browser as a Netscape-format `cookies.txt` file, then set the path in **Settings → YouTube Authentication**.

Firefox users: the app can auto-detect Firefox cookies without manual export (Firefox must be installed).

> Chrome, Edge, Brave, and other Chromium browsers **cannot** be used for cookie export on modern Windows — they use app-bound encryption that yt-dlp cannot decrypt.

### Q: Why is the progress bar stuck at 0%?
If the progress bar appears stuck at 0%, try the latest release. Older builds had this issue — progress now updates in real-time with speed and ETA displayed for each active download.

### Q: Where are downloads saved?
Default: your `Downloads` folder. You can change this in **Settings → Download Location** or per-session in the download dialog.

### Q: Can I close the app while downloading?
Downloads will be cancelled. There is no background agent — the download process runs inside the app.

### Q: Is this a YouTube API client?
No. The app uses `yt-dlp`, which extracts public metadata from YouTube's web interface — no API key required.

### Q: Windows only?
Yes, the MVP is Windows-only (uses WebView2, which ships with Windows 10/11). Cross-platform support is planned.

### Q: What about viruses / antivirus false positives?
Some antivirus software may flag `yt-dlp.exe` because it downloads content from the internet. This is a false positive. Both yt-dlp and the app itself are open source — inspect the code and build from source if you're concerned.

---

## Build from Source

### Prerequisites

- **Rust** (latest stable): https://rustup.rs
- **Node.js** 20+: https://nodejs.org
- **pnpm**: `npm install -g pnpm`
- **Visual Studio 2022 Build Tools** with these workloads:
  - `Microsoft.VisualStudio.Workload.VCTools`
  - `Microsoft.VisualStudio.Component.Windows10SDK.20348`

The `.vsconfig` file in the repo root includes the required components — if you use Visual Studio Installer, it can import this configuration.

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/clipdown.git
cd clipdown

# Install frontend dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production (produces NSIS installer + standalone exe)
pnpm tauri build
```

The production build will be at:
- Installer: `src-tauri/target/release/bundle/nsis/ClipDown_0.1.0_x64-setup.exe`
- Standalone: `src-tauri/target/release/clipdown.exe`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Tauri v2](https://v2.tauri.app) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Icons | Lucide React |
| State | Zustand + TanStack Query |
| Backend | Rust (Tokio async) |
| Download Engine | yt-dlp CLI |
| Media Processing | FFmpeg |
| Packaging | NSIS Installer |

### Why this stack?

- **Tauri v2** over Electron: 10-25x smaller installer (5-15 MB vs 120-250 MB), 60-75% less RAM, uses system WebView2
- **shadcn/ui** over MUI/Ant: zero runtime deps, full code ownership, 50 KB gzipped
- **yt-dlp CLI** over Python API: no Python runtime bundling, auto-updates independently, reliable JSON output

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Tauri Shell                        │
│  ┌───────────────────────────────────────────────┐  │
│  │           Frontend (WebView2)                 │  │
│  │  React UI  ← IPC (invoke/events) →  Rust Core │  │
│  └───────────────────────────────────────────────┘  │
│                    │                                 │
│         ┌──────────┴──────────┐                      │
│         ▼                     ▼                       │
│   yt-dlp.exe            ffmpeg.exe                    │
│   (download engine)      (media processing)           │
└─────────────────────────────────────────────────────┘
```

All system operations (process spawning, file I/O, download management) happen in the Rust backend. The frontend communicates via Tauri's IPC layer with restricted capabilities.

---

## Security

A full security audit is available at [`docs/05-SECURITY-AUDIT.md`](docs/05-SECURITY-AUDIT.md). Key points:

- Frontend has constrained capabilities via Tauri permissions
- All subprocesses are spawned with `CREATE_NO_WINDOW` (no console popups)
- URL validation is performed in both frontend and Rust backend
- Output paths are sanitized against traversal attacks
- Cookies file path is stored in sandboxed localStorage (never logged)
- CSP restricts script execution to same-origin only

---

## Roadmap

- [x] Live download progress with speed and ETA
- [x] Auto-detect yt-dlp/FFmpeg on launch
- [ ] Sort controls (by date, views, duration)
- [ ] First-run setup wizard
- [ ] Queue and history persistence (SQLite)
- [ ] Auto-update mechanism
- [ ] Cross-platform support (Linux, macOS)

---

## License

MIT

---

## Disclaimer

ClipDown is an independent project and is **not affiliated with, authorized, maintained, sponsored, or endorsed by YouTube or Google**. Use in accordance with YouTube's Terms of Service.
