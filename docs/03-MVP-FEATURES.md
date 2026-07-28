# MVP Features Document

## MVP Scope: Core Functionality Only

The MVP focuses on the essential workflow: paste channel URL → browse content → select → download. Everything else is deferred.

---

## Feature List

### F1: Channel URL Input & Validation
**Priority: P0 (Must Have)**

- Text input with clear button
- Paste detection (Ctrl+V auto-trigger is future)
- URL validation (must match YouTube channel URL patterns):
  - `https://youtube.com/@handle`
  - `https://youtube.com/channel/UC...`
  - `https://youtube.com/c/customname`
  - Shortened `youtu.be` is NOT supported (channels only)
- Invalid URL shows inline error message
- Loading state while fetching

**Acceptance Criteria:**
- User pastes a valid channel URL → channel data starts loading
- User pastes invalid URL → red border + error message ("Invalid YouTube channel URL")
- User pastes non-channel YouTube URL → error message ("Please enter a channel URL, not a video/playlist URL")
- Empty input → disabled fetch button

---

### F2: Channel Overview Display
**Priority: P0 (Must Have)**

- Channel avatar (thumbnail)
- Channel name
- Subscriber count (formatted: 1.2M, 50K, etc.)
- Total video count
- Channel description (collapsible, max 3 lines truncated)
- Verified badge if applicable

**Acceptance Criteria:**
- All fields populate within 5 seconds on a good connection
- Description truncates at 3 lines with "Show more" link
- Avatar loads with blur placeholder
- Channel not found → error state with retry button

---

### F3: Content Tabs
**Priority: P0 (Must Have)**

Tab navigation for channel content:
- **Videos** (default tab)
- **Shorts**
- **Streams** (live streams archive)
- **Playlists**

**Acceptance Criteria:**
- Tabs are clearly visible at top of content area
- Clicking tab fetches and displays that content type
- Active tab is visually distinct (underline + highlighted)
- Loading spinner per tab
- Empty state ("No videos found") for tabs with no content

---

### F4: Video/Shorts/Streams Grid View
**Priority: P0 (Must Have)**

Card-based display of individual items:
- Thumbnail with duration overlay
- Video title (1 line, ellipsis overflow)
- View count (formatted)
- Upload date (relative: "2 days ago", "3 weeks ago")
- Duration in MM:SS or HH:MM:SS format
- Selection checkbox (top-right corner of card)

**Layout:**
- Responsive grid: 1 column (mobile) → 2 → 3 → 4 (desktop 1400px+)
- Cards have consistent aspect ratio (16:9)
- Hover effect: slight lift + shadow

**Acceptance Criteria:**
- Grid renders 50 items initially, lazy loads more on scroll
- Each card shows thumbnail, title, views, date, duration
- Checkbox is clearly visible and clickable
- Clicking card (not checkbox) could be future preview action
- Thumbnails load progressively

---

### F5: Playlists View
**Priority: P0 (Must Have)**

- Playlist cards with playlist thumbnail (collage or first video thumbnail)
- Playlist title
- Video count
- Expand/collapse to show playlist contents
- Inside playlist: same card format as video grid
- Entire playlist selectable (single checkbox on playlist card)
- Individual videos within playlist also selectable

**Acceptance Criteria:**
- Playlist expansion is animated
- Selecting playlist checks all contained videos
- Unchecking all videos in playlist unchecks the playlist
- Shows "Playlist is empty" for empty playlists

---

### F6: Multi-Select & Select All
**Priority: P0 (Must Have)**

- "Select All" toggle in tab header bar
- Individual item checkboxes
- Selection counter badge: "24 items selected"
- Preserve selection across tab switches (select in Videos, switch to Shorts, switch back - selection remains)
- Clear selection button

**Acceptance Criteria:**
- Select All in Videos tab selects only videos (not shorts/streams)
- Selection count updates in real-time
- Selection persists when scrolling (infinite scroll)
- Selecting items across tabs cumulates correctly

---

### F7: Download Dialog
**Priority: P0 (Must Have)**

Modal dialog triggered when user clicks "Download Selected" (with ≥1 item selected):
- **Format Selection:**
  - Video + Audio (merged): resolution dropdown (2160p, 1440p, 1080p, 720p, 480p, 360p)
  - Audio Only: format dropdown (MP3, M4A, FLAC, Opus, WAV) + quality dropdown
  - Video Only (no audio): advanced option
- **Output Settings:**
  - Download directory selector (opens native folder picker)
  - Filename template text field with preview
  - Organization: flat folder / subfolder by playlist / subfolder by date
- **Item summary:** list of items to be downloaded
- **Action buttons:** "Add to Queue" | "Download Now" | Cancel

**Acceptance Criteria:**
- Format options match what yt-dlp reports as available
- File size estimate shown per format
- "Download Now" starts immediately; "Add to Queue" enqueues
- Download directory defaults to user's Downloads folder
- Path is validated as writable before starting

---

### F8: Download Queue
**Priority: P0 (Must Have)**

- Queue view showing all items (pending, active, completed, failed)
- Per-item progress: progress bar, percentage, speed, ETA, file size
- Status badges: Downloading, Queued, Completed, Failed, Cancelled
- Per-item controls: Pause, Resume, Cancel
- Global controls: Pause All, Resume All, Cancel All, Clear Completed
- Queue order: items processed in FIFO order

**Concurrency:**
- Default: 3 simultaneous downloads
- Configurable in settings (1-10)

**Acceptance Criteria:**
- Progress updates at least every 500ms
- ETA and speed update in real-time
- Paused item can be resumed from where it stopped (yt-dlp supports this)
- Failed item shows error message (retryable vs permanent)
- Queue persists across app restart (saved to SQLite)

---

### F9: Download History
**Priority: P1 (Should Have)**

- History view with table of completed downloads
- Columns: Title, Type (Video/Audio), Quality, File Size, Date, Status
- Click to open file in system default player
- Right-click: Open File Location, Remove from History, Retry
- Search within history
- Clear all history option

**Acceptance Criteria:**
- History is persisted in SQLite
- Shows last 1000 items by default
- Search filters as user types (debounced 300ms)
- "Open File Location" opens Explorer at the file

---

### F10: Settings Panel
**Priority: P1 (Should Have)**

- **General:**
  - Default download directory
  - Maximum concurrent downloads (slider: 1-10)
  - Theme: Light / Dark / System (dropdown)
- **Downloads:**
  - Default video quality
  - Default audio format
  - Subtitle download preference (none / all / selected languages)
  - Speed limit (unlimited / custom in KB/s)
- **Tools:**
  - yt-dlp version display + "Check for Updates" button
  - FFmpeg version display
  - Health check: verify both tools are accessible
- **About:**
  - App version
  - GitHub link

**Acceptance Criteria:**
- Settings persist across restarts (SQLite)
- Theme change takes effect immediately
- Download directory defaults to `~/Downloads/ChannelDownloader/`
- Health check runs on settings page load

---

### F11: Search Within Channel
**Priority: P1 (Should Have)**

- Search input in channel header area
- Filters current tab content by title match
- Real-time filtering (no additional API calls)
- Case-insensitive search
- "No results" state when filter yields zero matches

---

### F12: Sort Controls
**Priority: P1 (Should Have)**

For Videos, Shorts, Streams tabs:
- Sort by: Date (newest/oldest), Views (most/least), Duration (longest/shortest)
- Sort indicator on active sort column

---

### F13: First-Run Setup
**Priority: P1 (Should Have)**

On first launch:
- Check for yt-dlp and ffmpeg
- If either is missing, show setup wizard:
  - Progress bar for downloading missing tools
  - Tool selection: "Full" (download both) or "Lite" (use system-installed)
- After verification, show welcome screen with quick start guide
- All subsequent launches skip setup

---

## Out of Scope for MVP

| Feature | Reason |
|---------|--------|
| Video preview/playback in-app | Complex, adds media pipeline; user can play files externally |
| Browser extension integration | Requires separate extension packaging + maintenance |
| Cookie manager for auth content | MVP uses cookies.txt import; full manager is V2 |
| Batch URL paste (50 URLs) | MVP is channel-first; batch is V2 |
| SponsorBlock integration | Post-MVP enhancement |
| YouTube comments extraction | Niche use case; V2 feature |
| Playlist download from non-channel URLs | Channel-first focus; V2 |
| Linux/macOS support | Windows MVP only; cross-platform in V2 |
| Mobile companion | Tauri v2 supports mobile, but out of scope for MVP |
| Theme customization beyond light/dark | Pre-set themes only; custom theme builder is V2 |
| Multi-language support | English-only MVP; i18n in V2 |
| Analytics/usage stats | Not applicable for local-first tool |

## MVP Success Criteria

1. User can paste a YouTube channel URL and see all content within 5 seconds
2. User can select individual items or entire categories
3. Downloads complete successfully with real-time progress
4. Queue handles 50+ items without performance degradation
5. History persistently tracks all downloads
6. App launches and operates without Python or other external runtime dependencies
7. Installer is under 20MB
8. Crash-free rate > 99.5% during normal use
