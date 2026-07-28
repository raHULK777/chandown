# Implementation Plan

## Phase 0: Project Scaffolding (1-2 days)

### 0.1 Environment Setup
- Install Rust toolchain (rustup + cargo)
- Install Node.js 20+ and npm/pnpm
- Install Tauri CLI: `cargo install tauri-cli`
- Install WebView2 (pre-installed on Win 10/11)
- Verify yt-dlp and ffmpeg are available

### 0.2 Initialize Project
- `npm create tauri-app@latest` with React + TypeScript + Vite template
- Configure Tauri v2 with Windows-specific settings
- Set up `tauri.conf.json` with app name, identifier, window config
- Add `shell` plugin for process spawning
- Add `sql` plugin for SQLite

### 0.3 Configure Frontend Toolchain
- Add Tailwind CSS v4
- Install shadcn/ui via CLI: `npx shadcn@latest init`
- Install TanStack Router: `npm install @tanstack/react-router`
- Install TanStack Query: `npm install @tanstack/react-query`
- Install Zustand: `npm install zustand`
- Set up file-based routing structure
- Configure path aliases (`@/`)

### 0.4 Bundle External Tools
- Download yt-dlp.exe, ffmpeg.exe, ffprobe.exe
- Place in `src-tauri/binaries/`
- Configure Tauri to bundle them as resources

### 0.5 Build Scripts
- Set up development workflow: `pnpm tauri dev`
- Configure production build: `pnpm tauri build`
- Set up NSIS installer configuration

---

## Phase 1: Core Infrastructure (3-4 days)

### 1.1 Rust Backend: System Commands
- Implement `check_tools` command (verify yt-dlp, ffmpeg presence)
- Implement `update_ytdlp` command (spawn `yt-dlp -U`)
- Implement `get_download_path` (read/set default download directory)
- Implement path validation and sanitization

### 1.2 Rust Backend: Process Management
- Implement `ProcessManager` struct wrapping `std::process::Command`
- Windows Job Object integration for process tree cleanup
- Stdout/stderr streaming via Tauri events
- Timeout and cancellation support
- Error classification (network, auth, format, etc.)

### 1.3 Rust Backend: SQLite Database
- Create schema for:
  - `download_history` (id, url, title, status, timestamp, filepath, size)
  - `settings` (key, value pairs)
  - `queue` (persistent download queue)
- Implement CRUD operations via Tauri SQL plugin

### 1.4 Frontend: Basic Shell
- Set up TanStack Router with root layout
- Implement sidebar navigation structure
- Create theme provider (light/dark/system)
- Build responsive layout (sidebar + header + content area)
- Implement window controls (minimize, maximize, close) for frameless mode

### 1.5 Frontend: State Management
- Set up Zustand stores:
  - `useDownloadStore` (queue, active downloads, history)
  - `useSettingsStore` (preferences, paths, theme)
  - `useChannelStore` (fetched channel data)
- Set up TanStack Query client with default options

---

## Phase 2: Channel Browsing (4-5 days)

### 2.1 Rust Backend: Channel Data Extraction
- Implement `fetch_channel_info` command:
  - Spawn `yt-dlp --dump-json --flat-playlist "CHANNEL_URL/videos" --playlist-end N`
  - Parse JSONL output
  - Return structured channel data (name, avatar, subscriber count, video count, description)
- Implement `fetch_channel_videos` command:
  - Tab support: videos, shorts, streams
  - Pagination support (playlist-end, playlist-start params)
  - Return video list with metadata (title, duration, views, date, thumbnail)
- Implement `fetch_channel_playlists` command:
  - Spawn `yt-dlp --dump-json --flat-playlist "CHANNEL_URL/playlists"`
  - Parse and return playlist data

### 2.2 Rust Backend: Detailed Metadata
- Implement `fetch_video_info` for individual video details
- Return formats ladder (quality + codec + filesize)
- Return subtitles, chapters, thumbnails when requested

### 2.3 Frontend: Channel Search/Input
- URL input component with validation (YouTube URL regex)
- Channel info card with avatar, name, stats
- Loading skeleton states
- Error states (invalid URL, channel not found, private, etc.)

### 2.4 Frontend: Video Gallery
- Grid view with video cards (thumbnail, title, duration, views, date)
- List view as alternative
- Sort controls (date, views, duration)
- Filter controls (search within channel)
- Tab navigation: Videos | Shorts | Streams | Playlists
- Pagination / infinite scroll
- Select individual videos (checkbox) or "Select All"

### 2.5 Frontend: Playlists Section
- Playlist cards with thumbnail, title, video count
- Expandable to show playlist contents
- Select entire playlists for download

---

## Phase 3: Download Engine (4-5 days)

### 3.1 Rust Backend: Download Manager
- Implement `DownloadManager` with:
  - Configurable concurrency (1-10 simultaneous downloads)
  - Queue with priority ordering
  - Per-download progress tracking
  - Pause/resume/cancel per item
  - Speed limiting (global and per-download)
  - Retry logic with exponential backoff

### 3.2 Rust Backend: Download Execution
- Implement `start_download` command:
  - Accept download manifest (url, format selection, output path, options)
  - Build yt-dlp argument list
  - Spawn process under Job Object
  - Stream progress via Tauri events (bytes, speed, ETA, percentage)
  - Handle completion (success, error, cancelled)

### 3.3 Rust Backend: Format Selection
- Parse yt-dlp format list into structured format options
- Group by video quality, audio quality, codec
- Implement format selection logic for best quality combinations

### 3.4 Frontend: Download Dialog
- Format selector: resolution dropdown, codec selection, audio-only toggle
- Output path selector
- Filename template preview
- Quality/size estimate display
- "Add to Queue" / "Download Now" buttons

### 3.5 Frontend: Queue Management
- Queue view with ordered list of pending items
- Active download cards with real-time progress bars
- Speed display, ETA, file size
- Pause/resume/cancel controls per item
- Drag-to-reorder queue items
- "Pause All" / "Resume All" controls

### 3.6 Frontend: Download History
- History view with completed downloads
- Status indicators (completed, failed, cancelled)
- Open file / Open folder actions
- Retry failed downloads
- Clear history option

---

## Phase 4: Polish & Advanced Features (3-4 days)

### 4.1 Auto-Update System
- Tauri updater plugin integration
- Check for updates on startup
- Background download with progress
- Install on restart

### 4.2 yt-dlp Auto-Update
- Check yt-dlp version on startup
- Update silently in background
- Notify user if restart needed

### 4.3 Settings Panel
- Default download directory
- Download concurrency limit
- Default format preferences (video quality, container, codec)
- Theme selection (light/dark/system)
- yt-dlp update configuration
- Cookie file import for authenticated content
- Language settings

### 4.4 Clipboard Monitoring (Optional)
- Watch clipboard for YouTube URLs
- Auto-fill channel URL when copied
- Notification toast on detection

### 4.5 Notifications
- Download complete notification (toast + system notification)
- Error notifications
- Queue complete notification
- Update available notification

### 4.6 Keyboard Shortcuts
- Ctrl+V: Paste URL
- Ctrl+Enter: Fetch channel
- Ctrl+D: Download selected
- Escape: Cancel/dismiss
- Ctrl+,: Open settings

---

## Phase 5: Testing & Release (2-3 days)

### 5.1 Testing
- Unit tests for Rust backend (process management, queue logic, DB operations)
- Frontend component tests (Vitest + Testing Library)
- Integration tests (Tauri test harness)
- Manual testing: various channel sizes (10 to 10,000+ videos)
- Error condition testing (no network, invalid URLs, rate limits, age-restricted)

### 5.2 Build & Package
- Configure NSIS installer with:
  - Custom icon and metadata
  - Desktop shortcut option
  - Start menu entry
  - Uninstaller
- Test portable build
- Verify code signing workflow (optional for MVP)

### 5.3 Release
- Set up GitHub Releases workflow
- Automate build via GitHub Actions
- Generate SHA256 checksums
- Publish release with changelog

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 0: Scaffolding | 1-2 days | Runable dev environment, project skeleton |
| Phase 1: Core Infrastructure | 3-4 days | Backend commands, UI shell, state management |
| Phase 2: Channel Browsing | 4-5 days | Channel data display, selection UI |
| Phase 3: Download Engine | 4-5 days | Working downloads with queue management |
| Phase 4: Polish | 3-4 days | Settings, updates, notifications, shortcuts |
| Phase 5: Testing & Release | 2-3 days | Stable release build |

**Total estimated time: 17-23 days** for a solo developer working full-time.
