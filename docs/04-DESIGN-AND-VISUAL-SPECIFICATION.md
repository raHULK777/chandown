# Design & Visual Specification

## 1. Design Philosophy

**Modern, utilitarian, and fast.** The app should feel like a native Windows tool - responsive at 60fps, visually clean, with purposeful use of space. No decorative excess. Every pixel serves the user's goal: find content and download it.

Design influences: GitHub Desktop, Spotify Desktop, Fluent Design 2 (but applied tastefully, not literally).

---

## 2. Layout Architecture

### 2.1 Main Window Structure

```
┌──────────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Title Bar (custom, frameless)                        │  │
│  │  App Name   │  [Search...]        │  —  □  ✕           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌─────────┐  ┌────────────────────────────────────────┐     │
│  │ Sidebar  │  │  Content Area                         │     │
│  │          │  │                                        │     │
│  │  Home    │  │  ┌─── Channel Header ─────────────┐    │     │
│  │          │  │  │ ┌────┐  Channel Name          │    │     │
│  │  Channels│  │  │ │Ava │  1.2M subs · 500 videos│    │     │
│  │          │  │  │ └────┘  Description here...   │    │     │
│  │  Queue   │  │  └──────────────────────────────┘    │     │
│  │          │  │                                        │     │
│  │  History │  │  ┌─── Content Tabs ──────────────┐    │     │
│  │          │  │  │ Videos │ Shorts │ Streams │ Playlists│     │
│  │  Settings│  │  └──────────────────────────────┘    │     │
│  │          │  │                                        │     │
│  │          │  │  ┌─── Selection Header ──────────┐    │     │
│  │          │  │  │ □ Select All   24 selected     │    │     │
│  │          │  │  │ Sort: Latest ▼         [Download] │    │     │
│  │          │  │  └──────────────────────────────┘    │     │
│  │          │  │                                        │     │
│  │          │  │  ┌─── Content Grid ──────────────┐    │     │
│  │          │  │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │    │     │
│  │          │  │  │ │Card│ │Card│ │Card│ │Card│  │    │     │
│  │          │  │  │ └────┘ └────┘ └────┘ └────┘  │    │     │
│  │          │  │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │    │     │
│  │          │  │  │ │Card│ │Card│ │Card│ │Card│  │    │     │
│  │          │  │  │ └────┘ └────┘ └────┘ └────┘  │    │     │
│  │          │  │  │ ...infinite scroll...          │    │     │
│  │          │  │  └──────────────────────────────┘    │     │
│  │          │  │                                        │     │
│  └─────────┘  └────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Status Bar (optional) - Downloads: 3 active, 12 queued │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Window Specifications

| Property | Value |
|----------|-------|
| Default size | 1280 x 800 |
| Minimum size | 900 x 600 |
| Default position | Centered on primary monitor |
| Title bar | Custom frameless (native title bar hidden) |
| Resizable | Yes, with minimum constraints |
| Multiple windows | No (single-window architecture for MVP) |

---

## 3. Color System

Leveraging shadcn/ui's CSS variable-based theming for instant light/dark mode switching.

### 3.1 Light Theme

```
--background:         #FFFFFF
--foreground:         #0A0A0B
--card:               #FFFFFF
--card-foreground:    #0A0A0B
--popover:            #FFFFFF
--popover-foreground: #0A0A0B
--primary:            #2563EB (Blue 600)
--primary-foreground: #FFFFFF
--secondary:          #F1F5F9 (Slate 100)
--secondary-foreground:#1E293B (Slate 800)
--muted:              #F1F5F9
--muted-foreground:   #64748B (Slate 500)
--accent:             #F1F5F9
--accent-foreground:  #1E293B
--destructive:        #EF4444 (Red 500)
--destructive-foreground:#FFFFFF
--border:             #E2E8F0 (Slate 200)
--input:              #E2E8F0
--ring:               #2563EB

Sidebar:             #F8FAFC (Slate 50)
Sidebar foreground:  #334155 (Slate 700)
Sidebar active:      #EFF6FF (Blue 50)
Sidebar border:      #E2E8F0

Card hover:          #F8FAFC (Slate 50)
Selection highlight: #EFF6FF (Blue 50)
Success:             #22C55E (Green 500)
Warning:             #F59E0B (Amber 500)
Error:               #EF4444 (Red 500)
```

### 3.2 Dark Theme

```
--background:         #09090B
--foreground:         #FAFAFA
--card:               #18181B (Zinc 900)
--card-foreground:    #FAFAFA
--popover:            #18181B
--popover-foreground: #FAFAFA
--primary:            #3B82F6 (Blue 500)
--primary-foreground: #FFFFFF
--secondary:          #27272A (Zinc 800)
--secondary-foreground:#FAFAFA
--muted:              #27272A
--muted-foreground:   #A1A1AA (Zinc 400)
--accent:             #27272A
--accent-foreground:  #FAFAFA
--destructive:        #7F1D1D (Red 900)
--destructive-foreground:#FAFAFA
--border:             #27272A (Zinc 800)
--input:              #27272A
--ring:               #3B82F6

Sidebar:             #111113 (Zinc 950)
Sidebar foreground:  #A1A1AA (Zinc 400)
Sidebar active:      #1E3A5F (Blue 950)
Sidebar border:      #27272A

Card hover:          #1A1A1E
Selection highlight: #1E3A5F
Success:             #16A34A (Green 600)
Warning:             #D97706 (Amber 600)
Error:               #DC2626 (Red 600)
```

---

## 4. Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| App title (title bar) | Inter | 13px | 600 |
| Channel name | Inter | 24px | 700 |
| Section headers | Inter | 16px | 600 |
| Tab labels | Inter | 14px | 500 |
| Card title | Inter | 13px | 500 |
| Card metadata | Inter | 11px | 400 |
| Body text | Inter | 13px | 400 |
| Button text | Inter | 13px | 500 |
| Badge/label | Inter | 11px | 500 |
| Code/monospace | JetBrains Mono | 12px | 400 |

Fallback: system-ui stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)

---

## 5. Component Specifications

### 5.1 Sidebar

```
Width: 220px (collapsed: 56px)
Background: --sidebar (light: Slate 50, dark: Zinc 950)
Items:
  Home         → icon: House
  Channels     → icon: Tv (active view)
  Queue        → icon: ListChecks (badge: active download count)
  History      → icon: Clock
  Settings     → icon: Settings

States:
  Default:     text --sidebar-foreground, no background
  Hover:       background --accent (10% opacity)
  Active:      background --sidebar-active, text --foreground, left border 2px --primary
  Selected:    same as Active
```

### 5.2 Channel Header Card

```
Layout:     Horizontal flex, 16px gap
Avatar:     72x72px rounded-full, object-cover
Name:       Font 24px, weight 700
Stats:      Row of formatted stats with dots separator:
            "1.2M subscribers · 500 videos · 50 playlists"
Description: Max 3 lines, truncate with "Show more" link
            Line height: 1.5
            Color: --muted-foreground
```

### 5.3 Content Tabs

```
Style:      Underline-style tabs (shadcn/ui Tabs variant)
Active:     Text --foreground + 2px underline --primary
Inactive:   Text --muted-foreground
Hover:      Text --foreground
Gap between tabs: 24px
Padding:    8px 0px
Tab content padding: 16px 0px
```

### 5.4 Video Card (Grid View)

```
Dimensions:   Aspect ratio 16:9 for thumbnail area
Card width:   Fluid grid: minmax(240px, 1fr)
              
┌─────────────────────┐
│ ┌─────────────────┐ │
│ │   Thumbnail     │ │  → object-cover, rounded-md
│ │     16:9        │ │  → Duration badge: bottom-right
│ │                 │ │  → Bottom gradient overlay
│ └─────────────────┘ │
│ Title text here...   │  → 1 line, truncate
│                      │
│ 1.2M views · 2d ago  │  → muted-foreground, 11px
│                      │
│ ☐ (checkbox, top-    │  → Checkbox: top-left of card
│    right of card)    │     absolute positioned
└─────────────────────┘

Border:      1px --border, rounded-lg (8px)
Padding:     0 (thumbnail flush top) + 10px below for text
Background:  --card
Shadow:      none (flat design) - subtle on hover
Hover:       transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08)
             dark: 0 4px 12px rgba(0,0,0,0.3)
Transition:  150ms ease

Duration badge:
  Background: rgba(0,0,0,0.80)
  Color: white
  Text: 11px, 500 weight
  Position: bottom-right, margin: 6px
  Border-radius: 4px
  Padding: 1px 6px

Selection checkbox:
  Position: absolute, top: 8px, left: 8px
  Visible on hover always; visible on selected cards always
  Size: 18px
  Background on selected card: subtle blue overlay on thumbnail
```

### 5.5 Selection Header

```
Positioned between tabs and content grid.

Layout: flex, justify-between, items-center
Height: 40px

Left side:
  □ Select All checkbox  |  "24 items selected" (when > 0)

Right side:
  Sort: Latest ▼  (dropdown trigger)
  [Download Selected] button (primary variant, disabled when 0 selected)
```

### 5.6 Download Queue Item

```
┌──────────────────────────────────────────────────────────────┐
│ Video Title That Might Be Long So It Truncates...            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│ └──────────────────────────────────────────────────────────┘ │
│ 45% · 12.5 MB / 28.1 MB · 2.3 MB/s · ETA 14s    [⏸] [✕]   │
│ Format: 1080p MP4 · Output: D:\Downloads\                     │
└──────────────────────────────────────────────────────────────┘

Padding:    12px
Background: --card
Border:     1px --border, rounded-lg
Gap:        8px between rows
Progress bar height: 6px, rounded-full, --primary color
Status text: 11px, muted-foreground
Controls:   Pause (circle), Cancel (X) - icon buttons

States:
  Queued:    No progress bar, "Waiting..." text
  Downloading: Animated progress bar, live stats
  Paused:    Progress bar frozen, "Paused" badge
  Completed: Full progress bar, green checkmark, file size final
  Failed:    Red progress bar at current %, error message
  Cancelled: Grey progress bar, "Cancelled" text
```

### 5.7 Download Dialog (Modal)

```
Width:      480px
Title:      "Download 24 items"
Description:"Select format and output options"

Section 1: Format
  Radio group:
    ● Video + Audio (recommended)
      └── Resolution: [1080p ▼]  Codec: [H.264 ▼]
    ○ Audio Only
      └── Format: [MP3 ▼]  Quality: [192 kbps ▼]

Section 2: Output
  Output folder: D:\Downloads\ChannelName\  [Browse]
  └── native Windows folder picker dialog
  Organize by: [Flat ▼] (Flat, Playlist, Date)

Section 3: Summary
  "24 videos · ~2.4 GB total · Will download to D:\Downloads\"

Footer:
  [Cancel] [Add to Queue] [Download Now]
  └── Primary button: Download Now
  └── Secondary: Add to Queue
  └── Ghost: Cancel
```

### 5.8 Settings Panel

```
Categories on left (vertical tabs):
  General | Downloads | Tools | About

Selected category content on right.

General:
  Download directory: [D:\Downloads\] [Browse]
  Max concurrent downloads: [3] [━━━━●━━━━]  (slider 1-10)
  Theme: [Light ▼]

Downloads:
  Default video quality: [1080p ▼]
  Default audio format: [MP3 ▼]
  Auto-download subtitles: [No ▼]
  Speed limit: [Unlimited ▼] → [500] KB/s (shown when Custom selected)

Tools:
  yt-dlp: v2026.07.01 ✅  [Update]
  FFmpeg: v7.0 ✅

About:
  App: ChanDown v0.1.0
  GitHub: [link]
  License: MIT
```

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Desktop XL | ≥1400px | 4-column grid, sidebar expanded |
| Desktop | ≥1024px | 3-column grid, sidebar expanded |
| Tablet landscape | ≥768px | 2-column grid, sidebar collapsed (icons only) |
| Tablet portrait | ≥480px | 2-column grid, sidebar hidden (hamburger menu) |
| Mobile | <480px | 1-column grid, sidebar as overlay drawer |

_MVP targets Desktop (1280x800) primarily. Responsive is for future-proofing._

---

## 7. Animations & Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Page transitions | Fade + slide up | 200ms | ease-out |
| Modal open | Scale (0.95→1) + fade | 200ms | ease-out |
| Modal close | Scale (1→0.95) + fade | 150ms | ease-in |
| Card hover | TranslateY(-2px) + shadow | 150ms | ease-out |
| Sidebar item | Background color | 100ms | ease |
| Tab switch | Content crossfade | 150ms | ease |
| Progress bar | Width transition | 300ms | ease |
| Toast appear | Slide down from top | 300ms | spring |
| Checkbox | Scale + color | 100ms | ease |

---

## 8. Icons

Using **Lucide React** icon set (1,000+ consistent icons, tree-shakeable).

| Component | Icon |
|-----------|------|
| Home nav | `House` |
| Channels nav | `Tv` |
| Queue nav | `ListChecks` |
| History nav | `Clock` |
| Settings nav | `Settings` |
| Download | `Download` |
| Pause | `PauseCircle` |
| Resume | `PlayCircle` |
| Cancel | `XCircle` |
| Retry | `RotateCw` |
| Folder | `FolderOpen` |
| Search | `Search` |
| Sort | `ArrowUpDown` |
| Check | `CheckCircle2` |
| Error | `AlertCircle` |
| Warning | `AlertTriangle` |
| More menu | `MoreHorizontal` |
| External link | `ExternalLink` |

---

## 9. States

Every interactive component must define these states:

| State | Description |
|-------|-------------|
| Default | Normal unpressed state |
| Hover | Mouse cursor over element |
| Active | Mouse button pressed on element |
| Focus | Keyboard-focus indicator (ring) |
| Disabled | Non-interactive (greyed out) |
| Loading | Content being fetched (skeleton/pulse) |
| Error | Failed state with message |
| Empty | No data to display (illustration + text) |
| Selected | Item chosen for action |

### Loading States
- **Channel fetch**: Full-page skeleton with avatar placeholder, text lines pulsing
- **Tab content**: Grid of skeleton cards (grey rectangle + lines) with pulse animation
- **Single action**: Inline spinner next to the action button

### Error States
- **Network error**: "Could not reach YouTube. [Retry]" with illustration
- **Invalid URL**: Inline red message below input
- **Channel not found**: "This channel doesn't exist or is unavailable"
- **Download failed**: Per-item red badge with error detail in queue
- **Disk full**: "Not enough disk space" with current free space

### Empty States
- **No videos**: "No videos found on this channel"
- **Empty queue**: "Your download queue is empty. Browse a channel to add items."
- **No history**: "No downloads yet. Your history will appear here."
- **No results**: "No results matching your search."

---

## 10. Accessibility

- All interactive elements keyboard-navigable (Tab order)
- Focus visible: 2px ring in --ring color
- All icons have `aria-hidden="true"` + text equivalents
- Color contrast meets WCAG AA minimum (4.5:1 for text)
- Form inputs have associated labels (visible or sr-only)
- Role attributes on custom interactive elements
- Reduced motion: respect `prefers-reduced-motion` → disable all animations
- Status messages announced via `aria-live="polite"` regions
- Download progress announced as it changes

---

## 11. First-Run Experience

### 11.1 Tool Setup Screen
```
┌──────────────────────────────────────────────────────────┐
│                    Setting Up Tools                       │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ✓ yt-dlp  v2026.07.01  [Already installed]       │  │
│  │  ⏳ FFmpeg  Downloading...  ████████░░░░ 65%      │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  Checking system requirements...                          │
│  Tools will be installed to: AppData/Local/ChannelDL      │
│                                                           │
│  [Skip this step]  [Continue when ready]                  │
└──────────────────────────────────────────────────────────┘
```

### 11.2 Welcome Screen (first-launch only, after tools check)
```
┌──────────────────────────────────────────────────────────┐
│                    Welcome to ChanDown                    │
│                                                           │
│  1. Paste a YouTube channel URL                          │
│  2. Browse videos, shorts, streams, playlists            │
│  3. Select what you want and download                    │
│                                                           │
│  [Get Started]                                            │
└──────────────────────────────────────────────────────────┘
```
