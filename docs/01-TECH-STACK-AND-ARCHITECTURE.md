# Tech Stack & Architecture Document

## 1. Executive Summary

A modern, responsive Windows desktop application for browsing and downloading YouTube channel content. The app accepts a channel URL, fetches all available data (videos, playlists, shorts, streams), presents it in a clean UI for selection, and handles bulk/concurrent downloads with progress tracking.

## 2. Technology Stack

### Application Framework: Tauri v2

**Why Tauri over Electron:**
| Metric | Tauri v2 | Electron 34+ |
|--------|----------|-------------|
| Installer size (production) | 5-15 MB | 120-250 MB |
| Idle RAM usage | 30-80 MB | 150-400 MB |
| Cold startup | 200-500 ms | 1,000-2,000 ms |
| Bundle vs user machine | Uses OS WebView2 (pre-installed Win 10/11) | Ships entire Chromium |

Tauri's Rust backend handles all system-level operations (process spawning, file I/O, SQLite), while the UI runs in the native WebView2. This is the architecture used by production apps like Ironcall (29MB binary, 0.1s startup).

### Frontend: React 19 + TypeScript + Vite

- **React 19**: Latest stable with concurrent rendering, improved hooks, and server components support
- **TypeScript 5.x**: Full type safety across the entire stack
- **Vite 8**: Next-gen bundler with instant HMR and Rust-based Rolldown

### UI Component Library: shadcn/ui + Tailwind CSS v4

- **shadcn/ui**: Copy-paste model (zero runtime deps), 50+ components built on Radix UI primitives. Proven in production dashboards. Bundle impact: ~50KB gzipped vs Material UI's 100KB+ or Ant Design's 500KB+
- **Tailwind CSS v4**: Utility-first, CSS-variable-based theming for instant dark/light mode
- **Lucide React**: 1,000+ consistent SVG icons

### Routing & Data: TanStack Ecosystem

- **TanStack Router v1**: Type-safe, file-based routing with automatic code splitting. 100% type inference for routes, params, and search params
- **TanStack Query v5**: Server state management, caching, deduplication, background refetching for YouTube data
- **TanStack Table v8**: Headless table with sorting, filtering, pagination for video/playlist lists

### State Management: Zustand

Lightweight (1KB) global state for download queue, settings, and UI state. Proven in Tauri production apps.

### Download Engine: yt-dlp (CLI)

**Why CLI over Python API:**
- Avoids bundling a Python runtime (saves ~30-50MB)
- yt-dlp CLI is the primary, most-tested interface
- `--dump-json` provides structured, parseable output
- Rust backend spawns as subprocess, manages lifecycle via Windows Job Objects
- Auto-updates itself via `yt-dlp -U` (no app redeploy needed)

### Media Processing: FFmpeg

Bundled as a portable binary. Required for:
- Merging best video + best audio streams (YouTube separates them above 720p)
- Audio extraction (MP3, M4A, FLAC, WAV, Opus)
- Format conversion
- Thumbnail processing

### Local Database: SQLite (via Tauri plugin)

- Download history and status
- User preferences/settings
- Download queue persistence across sessions
- Channel cache (avoid refetching metadata)

### Packaging: Tauri Bundler (NSIS for Windows)

- Windows NSIS installer
- Auto-updater via GitHub Releases (checks latest release, downloads binary)
- Bundles yt-dlp.exe and ffmpeg.exe in `resources/`

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Tauri Shell                        │
│  ┌───────────────────────────────────────────────┐  │
│  │           Frontend (WebView2)                 │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │  React   │ │ TanStack │ │  shadcn/ui   │  │  │
│  │  │  Components│ │ Router  │ │  Components  │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ TanStack │ │  Zustand │ │  Tailwind    │  │  │
│  │  │  Query   │ │  Stores  │ │  CSS v4      │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │ IPC (invoke/events)            │
│  ┌──────────────────▼────────────────────────────┐  │
│  │           Rust Backend (Tauri Core)            │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Command  │ │ Process  │ │  SQLite DB   │  │  │
│  │  │ Handlers │ │ Manager  │ │  (via plugin)│  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Download │ │ File     │ │  Auto-Update │  │  │
│  │  │ Queue    │ │ System   │ │  Manager     │  │  │
│  │  └──────────┘ └──────────┘ └──────────────┘  │  │
│  └──────────────────┬────────────────────────────┘  │
│                     │                               │
│  ┌──────────────────▼────────────────────────────┐  │
│  │           Subprocess Management                 │  │
│  │  ┌────────────────┐  ┌────────────────────┐   │  │
│  │  │  yt-dlp.exe    │  │  ffmpeg.exe        │   │  │
│  │  │  (via Job Object)│  │  (via Job Object)  │   │  │
│  │  └────────────────┘  └────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## 4. Data Flow

### Channel Data Fetching
```
User pastes channel URL → Frontend validates → IPC invoke to Rust
→ Rust spawns yt-dlp with --dump-json --flat-playlist
→ Parses JSONL output → Returns structured channel data
→ Frontend renders via TanStack Query cache
```

### Download Flow
```
User selects items → Frontend builds download manifest
→ IPC invoke to Rust queue manager → Rust validates paths
→ Spawns yt-dlp per item (with concurrency limit)
→ Progress reported back via Tauri events → Frontend updates UI
→ Completion triggers SQLite history write
```

## 5. Key Design Decisions

### Why yt-dlp CLI over Python API
1. No Python runtime bundling (saves ~50MB)
2. Auto-update via `yt-dlp -U` independent of app updates
3. Rust process management is more reliable with Job Objects
4. CLI output is stable JSON; yt-dlp Python API's `extract_info` return is not guaranteed JSON-serializable

### Why Tauri over Electron
1. 10-25x smaller installer (5-15MB vs 120-250MB)
2. 60-75% less RAM (30-80MB vs 150-400MB)
3. Better security model (capability-based permissions)
4. WebView2 is pre-installed on Win 10/11 (98% penetration)
5. Sidecar/shell plugin for managing external processes

### Why shadcn/ui over MUI/Ant Design
1. Zero runtime dependencies (copy-paste model)
2. 50KB gzipped vs 100KB+ (MUI) / 500KB+ (Ant Design)
3. Full code ownership - customize every pixel
4. Native Tailwind CSS v4 integration
5. Superior dark mode via CSS variables

## 6. Security Considerations

- All yt-dlp processes spawned via Windows Job Objects for clean cleanup
- Download paths validated against path traversal attacks
- Capability-based Tauri permissions: only required APIs exposed
- CSP strict: `script-src 'self'`, no `unsafe-eval`
- Cookies.txt support for authenticated content (no credential storage)
- All IPC inputs validated at Rust layer before processing

## 7. Project Structure

```
channel-downloader/
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── commands/      # IPC command handlers
│   │   │   ├── channel.rs # Channel data fetching
│   │   │   ├── download.rs# Download management
│   │   │   ├── settings.rs# Settings operations
│   │   │   └── system.rs  # Tool checks, updates
│   │   ├── models/        # Data structures
│   │   ├── process/       # yt-dlp/ffmpeg process management
│   │   ├── queue/         # Download queue engine
│   │   ├── db/            # SQLite operations
│   │   └── updater/       # Auto-update logic
│   ├── binaries/          # Bundled yt-dlp.exe, ffmpeg.exe
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                   # React frontend
│   ├── routes/            # TanStack Router file-based routes
│   ├── components/        # React components
│   │   ├── ui/            # shadcn/ui generated components
│   │   ├── channel/       # Channel-specific components
│   │   ├── download/      # Download-related components
│   │   └── layout/        # App layout components
│   ├── hooks/             # Custom React hooks
│   ├── stores/            # Zustand stores
│   ├── lib/               # Utilities
│   ├── types/             # TypeScript type definitions
│   └── styles/            # Global CSS
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```
