## Objective
- Build a production-ready Windows desktop app that takes a YouTube channel URL, fetches all channel data (videos, playlists, shorts, streams), and enables selective or bulk downloading.

## Important Details
- **Stack**: Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui-style components + Zustand + TanStack Query
- **Download engine**: yt-dlp CLI spawned from Rust (no Python runtime bundled); FFmpeg bundled for media merging
- **Window**: 1280x800 frameless (`decorations: false`), min 900x600, NSIS installer; header has custom drag region + minimize/maximize/close buttons via `@tauri-apps/api/window`
- **Only Windows target** for MVP; dev environment uses MSVC via VS 2022 Build Tools
- yt-dlp is auto-downloaded on first use via `ensure_ytdlp` command (PowerShell `Invoke-WebRequest`) to `%LOCALAPPDATA%\com.channeldownloader.app\bin\`
- All yt-dlp/taskkill processes use `CREATE_NO_WINDOW` flag to suppress console popups
- Download worker spawns yt-dlp directly from the `start_download` command handler via `tokio::spawn` (not from `.setup()` — that panics with "no reactor running")
- All icons replaced with `lucide-react` components; emoji removed throughout UI

## Work State
### Completed
- Fix: removed `tauri-plugin-updater` (required config that wasn't present, panicked on launch)
- Fix: added `data-tauri-drag-region` → replaced with `getCurrentWindow().startDragging()` on mousedown
- Fix: yt-dlp auto-download via `ensure_ytdlp` to app local data dir + `ProcessManager::download_ytdlp()` using PowerShell
- Fix: removed `--flat-playlist` from `fetch_channel_info` so yt-dlp returns full channel metadata (`channel_id`, `channel`, `channel_url`, `channel_follower_count`)
- Fix: `extract_videos`/`extract_playlists` now handle both `"entries"` array format AND flat single-entry JSON; added `playlist_channel`/`playlist_channel_id` fallbacks
- Fix: download background worker moved from `.setup()` into `start_download` command handler, fixing "no reactor running" panic
- Fix: all process spawns (yt-dlp, taskkill, where, powershell) use `CREATE_NO_WINDOW` to hide console windows
- Fix: progress parsed from `child.stdout` (not `child.stderr`) — yt-dlp 2026.07.04 writes everything to stdout
- Fix: download dialog defaults to `%USERPROFILE%\Downloads` via `@tauri-apps/api/path` `downloadDir()` + Browse button opens folder picker via `@tauri-apps/plugin-dialog`
- Added `file_path` field to `DownloadItem`; captured from yt-dlp `[download] Destination:` / `[Merger]` lines via regex
- Added Play button (opens file), Open Folder button on completed downloads in Queue page AND History page
- Replaced all emoji buttons with `lucide-react` icons (Minus, Square, X, Sun/Moon/Monitor, Play/Pause, FolderOpen, ExternalLink, Trash2, Film, Clock)
- Added `InstallYtdlpButton` component inline with yt-dlp error on Home page
- Added "Check" button alongside "Install"/"Update" on Settings page
- Built and verified: `npx tauri build` produces NSIS installer (~5MB) + `app.exe` (~20MB); app launches without crash
- Rust test suite: 29 tests pass (10 channel, 6 process, 11 queue, 2 other)

### Active
- Download progress bar stays at 0% then jumps to 100% — stdout parsing via BufReader::lines() may still have an issue (tokio::select timeout, line buffering, or regex mismatch)
- No automatic detection of existing yt-dlp on first launch; user must visit Settings or get an error to trigger `ensure_ytdlp`

### Next Move
1. Debug download progress: investigate stdout pipe reading — test if `BufReader::lines()` is receiving yt-dlp lines; try `--progress-template json` or read raw bytes instead of lines
2. Run `ensure_ytdlp` automatically on app startup (in `.setup()`) so yt-dlp is ready before user navigates
3. Add per-video thumbnail previews in video/shows/streams tabs
4. Add ability to sort/filter videos by date or duration

## Relevant Files
- `src-tauri/src/commands/download.rs` – download worker, progress parsing via regex on stdout (fixed from stderr), CREATE_NO_WINDOW, file_path capture
- `src-tauri/src/commands/channel.rs` – yt-dlp fetch commands, extract helpers (non-flat for channel info, flat-capable for video/playlist listing), 10 unit tests
- `src-tauri/src/process/manager.rs` – find_tool_path, download_ytdlp, CREATE_NO_WINDOW on all subprocesses
- `src-tauri/src/queue/manager.rs` – add_item, get_item, update_item_status, update_item_progress, update_item_path
- `src-tauri/src/models/download.rs` – DownloadItem with file_path field
- `src/components/queue/queue-page.tsx` – polling + Tauri events for progress, Play/Folder buttons with lucide-react icons
- `src/components/history/history-page.tsx` – polling, Play/Folder buttons for completed items
- `src/components/layout/header.tsx` – frameless window controls (minimize/maximize/close) + drag via `window.startDragging()`
- `src/components/layout/home-page.tsx` – InstallYtdlpButton inline with yt-dlp error
- `src/components/settings/settings-page.tsx` – Check + Install/Update buttons for yt-dlp
- `src/components/download/download-dialog.tsx` – format selection modal; output_path defaults to `downloadDir()`, Browse button via `@tauri-apps/plugin-dialog`
- `src-tauri/src/lib.rs` – managed state setup, command registration
