# Security Audit: ChanDown

**Date:** 2026-07-28  
**App Version:** 0.1.0  
**Platform:** Windows (Tauri v2)  
**Audit Scope:** All Rust backend code, React/TypeScript frontend, Tauri configuration, dependencies, build pipeline, and runtime deployment model.

---

## Table of Contents

1. [Methodology](#1-methodology)
2. [Threat Model Overview](#2-threat-model-overview)
3. [Findings by Category](#3-findings-by-category)
   - 3.1 Architecture & Trust Boundaries
   - 3.2 Input Validation & Sanitization
   - 3.3 Command Injection (yt-dlp Subprocess)
   - 3.4 Path Traversal & File System Access
   - 3.5 Cookie / Authentication Handling
   - 3.6 Process Spawning & Management
   - 3.7 Tauri Capabilities & Permissions
   - 3.8 Data at Rest & in Transit
   - 3.9 Dependency & Supply Chain Security
   - 3.10 Network Request Security
   - 3.11 Error Handling & Information Disclosure
   - 3.12 CSP & Frontend Hardening
4. [Feature-by-Feature Rating Matrix](#4-feature-by-feature-rating-matrix)
5. [Risk Register](#5-risk-register)
6. [Recommendations Summary](#6-recommendations-summary)
7. [Severity Reference](#7-severity-reference)

---

## 1. Methodology

This audit was conducted against the following frameworks:

- **Tauri v2 official security documentation** (capabilities, permissions, IPC patterns, lifecycle threats)
- **OWASP Top 10 for Desktop Applications**
- **CWE mappings** for common vulnerability classes
- **yt-dlp security advisories** (GHSA-69qj-pvh9-c5wg, GHSA-g3gw-q23r-pgqm, GHSA-hjq6-52gw-2g7p, GHSA-45hg-7f49-5h56)
- **NIST SP 800-53** security controls for desktop software

**Rating Scale:**

| Rating | Definition |
|--------|------------|
| **CRITICAL** | Direct RCE, credential theft, or system compromise. Must fix before production. |
| **HIGH** | Significant vulnerability with realistic exploit path. Should fix before production. |
| **MEDIUM** | Moderate risk; requires specific conditions. Plan to fix post-MVP. |
| **LOW** | Minor hardening opportunity. Acceptable for MVP but address later. |
| **INFO** | Not a vulnerability but worth documenting for awareness. |

---

## 2. Threat Model Overview

### Actors
- **End User (Victim):** Downloads and runs the app on Windows
- **YouTube / Video Host (Attacker-Controlled Content):** Can control video metadata (title, description, uploader, thumbnail URLs, subtitles)
- **Malicious Website:** Can redirect yt-dlp's generic extractor to a malicious URL via HTTP redirect
- **Local Attacker (Same Machine):** Can read localStorage, intercept Tauri IPC, or modify app files
- **Network Attacker:** On dev network, can attack Vite dev server; on production, can MITM yt-dlp downloads (if HTTPS not enforced)

### Trust Boundaries
```
┌──────────────────────────────────────────────────┐
│  Frontend (WebView)                              │
│  - React / TypeScript                            │
│  - Zustand stores (localStorage)                 │
│  - Untrusted: user input, yt-dlp JSON output     │
│  - Low privilege: constrained by Tauri IPC       │
└──────────────┬───────────────────────────────────┘
               │ IPC (invoke / events)
               │ Serialized JSON
               ▼
┌──────────────────────────────────────────────────┐
│  Rust Backend (Core)                              │
│  - Tauri commands (17 handlers)                   │
│  - Subprocess spawn (yt-dlp, taskkill, powershell)│
│  - File system read/write                        │
│  - Full system access (no sandbox)                │
└──────────────┬───────────────────────────────────┘
               │ Subprocess
               ▼
┌──────────────────────────────────────────────────┐
│  yt-dlp (Python CLI)                              │
│  - Downloads from YouTube/other sites             │
│  - Parses attacker-controlled metadata            │
│  - Known CVEs for command injection               │
└──────────────────────────────────────────────────┘
```

### Critical Assumptions
1. **The Rust backend is fully trusted** — Tauri's security model assumes core Rust code has complete system access.
2. **The frontend should not be trusted** — WebView compromise (XSS, malicious extension, etc.) must be contained by capabilities.
3. **yt-dlp is the largest attack surface** — It parses network data, runs as a subprocess, and has a history of command injection CVEs.

---

## 3. Findings by Category

### 3.1 Architecture & Trust Boundaries

| ID | Finding | Rating |
|----|---------|--------|
| A-01 | **All commands enabled for all windows** — 17 commands registered without per-command capability restriction. Any WebView in the app can invoke any command. | MEDIUM |
| A-02 | **No IPC validation layer** — No Isolation pattern or input validation middleware between frontend and backend. All validation happens inside individual command handlers (or not at all). | MEDIUM |
| A-03 | **Settings state is global mutable HashMap** — `SettingsState` uses `std::sync::Mutex<HashMap<String, String>>` with no schema validation. Any command can call `update_setting` with arbitrary keys/values. | LOW |
| A-04 | **Single-window architecture** — All content (home, queue, history, settings) rendered in one WebView. Compromise of any page equals full frontend compromise. | INFO |

**Recommendations:**
- (A-01) Add command-level capability restrictions via `AppManifest::commands` in `lib.rs` to limit which windows/contexts can invoke sensitive commands like `update_setting`, `ensure_ytdlp`, `ensure_ffmpeg`.
- (A-02) Consider the [Isolation pattern](https://v2.tauri.app/security/lifecycle/#isolation-pattern) for production: a small, auditable iframe that validates IPC messages before they reach the Core.
- (A-03) Replace `HashMap<String, String>` with a typed settings struct and validate keys/values in `update_setting`.
- (A-04) Split sensitive UI (settings) into a separate webview with reduced capabilities.

---

### 3.2 Input Validation & Sanitization

| ID | Finding | Rating |
|----|---------|--------|
| IV-01 | **No URL validation in Rust commands** — `fetch_channel_info`, `fetch_channel_videos`, `fetch_channel_playlists`, `fetch_playlist_videos`, `fetch_video_info`, and `start_download` all accept user-supplied URLs with no validation in Rust. Frontend-only regex validation (`^https?://(www\.)?youtube\.com/(@\|channel/\|c/\|user/)`) is bypassable. | HIGH |
| IV-02 | **yt-dlp arguments directly concatenated** — `call_ytdlp()` builds argument vectors from user-supplied URLs. If a URL contains flags (e.g., `--exec`, `-o`, `--config-location`), yt-dlp could interpret them as options. | CRITICAL |
| IV-03 | **Output path unsanitized in `run_download`** — The `output_path` from `DownloadRequest` is used directly in `format!(r#"{}\%(title)s ..."#, output)`. A malicious path like `C:\Users\malicious\..\Windows\System32` could write outside intended directory. | HIGH |
| IV-04 | **Subfolder name has basic sanitization** — `sanitize()` function in `download-dialog.tsx` strips `<>:"/\|?*` from playlist subfolder names. This is correct but only applied in the frontend. | MEDIUM |
| IV-05 | **No origin validation for yt-dlp URLs** — `fetch_playlist_videos` and other commands do not verify URLs point to expected domains. An attacker who controls the channel data could inject arbitrary URLs. | HIGH |

**Recommendations:**
- (IV-01) **BLOCKER FOR MVP.** Add Rust-side validation for all URL parameters entering Tauri commands. Parse URLs and verify host/scheme against allowlist (`youtube.com`, `youtu.be`).
- (IV-02) **CRITICAL.** Ensure user-supplied URLs are passed as positional arguments (not options) to yt-dlp. yt-dlp treats everything after the first non-option argument as a URL, but a URL starting with `--` could be misinterpreted. Prepend `--` to signal end of options, or validate URL doesn't start with `--`.
- (IV-03) Validate `output_path` in the Rust `start_download` handler: ensure it points to an allowed directory (user's Downloads, desktop, or user-selected path). Reject paths containing `..`.
- (IV-04) Move subfolder sanitization to the Rust backend as defense-in-depth.
- (IV-05) Validate `playlist_url` and `video_url` in Rust commands against an allowlist of known video platforms, or at minimum verify they parse as valid HTTPS URLs.

---

### 3.3 Command Injection (yt-dlp Subprocess)

| ID | Finding | Rating |
|----|---------|--------|
| CI-01 | **No `--exec` flag used** — Mitigated by design. The app does not pass `--exec` to yt-dlp, avoiding the most exploited yt-dlp command injection vector. | LOW |
| CI-02 | **yt-dlp output template with `%(title)s`** — The output template `%(title)s [\%(id)s].%(ext)s` uses `%(title)s` which is a safe printf-style conversion. yt-dlp does not execute shell commands from output templates. | INFO |
| CI-03 | **PowerShell `Invoke-WebRequest` URL is hardcoded** — `download_ytdlp()` and `download_ffmpeg()` construct PowerShell commands with hardcoded HTTPS URLs. No user input enters the PowerShell command string. | LOW |
| CI-04 | **URL could be interpreted as yt-dlp flag** — If a user-supplied URL starts with `--` (e.g., `--exec echo pwned`), yt-dlp could interpret it as a flag depending on argument ordering and yt-dlp version. | CRITICAL |
| CI-05 | **`taskkill /F /PID` uses PID from trusted source** — The PID is obtained from `child.id()` which returns the OS-assigned PID. No user input enters the `taskkill` command. | INFO |

**Recommendations:**
- (CI-04) **CRITICAL FIX.** Before passing URLs to yt-dlp, prefix the argument list with `--` (end-of-options marker) or validate that the URL doesn't start with `--`. The code currently passes the URL as the last argument: `args.push(url.clone())` — but if URL starts with `--`, yt-dlp may interpret it as an option depending on parsing context. Modern yt-dlp treats positional args after `-f` as URLs, but to be safe, reject URLs starting with `-` or ensure `--` precedes the URL.
- (CI-02) Keep output template as `%(title)s` (not `%(title)j` or `%(title)S`) — the `s` conversion is safe for file output. Never switch to `--exec` for post-processing.

---

### 3.4 Path Traversal & File System Access

| ID | Finding | Rating |
|----|---------|--------|
| PT-01 | **Output path not validated in `run_download`** — The output path from `DownloadRequest` is used directly in yt-dlp's `-o` flag. Path traversal via `..` is possible if not validated. | HIGH |
| PT-02 | **No directory allowlist for file writes** — Any writeable path can be used as output destination. The app only verifies the directory exists in the frontend (no-op). | MEDIUM |
| PT-03 | **FFmpeg extraction writes to app-local-data dir** — `download_ffmpeg()` extracts a zip archive to `bin/` directory inside the app's local data folder. The extracted content is from a hardcoded HTTPS URL. | LOW |
| PT-04 | **`file_path` from yt-dlp stdout used directly** — The `dest_re` regex extracts file paths from yt-dlp's output lines and stores them in download items. These paths are later passed to `open()` (shell plugin) in the frontend queue/history pages. | MEDIUM |
| PT-05 | **`open()` from shell plugin on user-facing paths** — Queue and history pages call `open(filePath)` via `@tauri-apps/plugin-shell`. If an attacker controls the file_path in a download item, they could open arbitrary files/executables. | MEDIUM |

**Recommendations:**
- (PT-01) **HIGH PRIORITY.** In `start_download`, validate `output_path`: (1) canonicalize with `std::fs::canonicalize`, (2) ensure it doesn't escape expected base directories, (3) reject paths containing `..`.
- (PT-02) Consider restricting writeable directories via `fs` plugin scopes in capabilities.
- (PT-04/PT-05) Validate file paths before passing to `open()`. Only allow opening files that actually exist in the user's download directory or subdirectories. Check that the path doesn't contain `..` or start with system directories.

---

### 3.5 Cookie / Authentication Handling

| ID | Finding | Rating |
|----|---------|--------|
| CH-01 | **Cookies file path stored in localStorage** — `cookiesFile` path is persisted in plaintext via Zustand `persist` middleware. Anyone with local machine access can read it. | MEDIUM |
| CH-02 | **Cookies file path stored in Rust memory** — `SettingsState` holds the cookies file path in a `HashMap<String, String>`. Never written to disk or logged. | LOW |
| CH-03 | **No validation of cookies file contents** — The path is passed directly to yt-dlp's `--cookies` flag. No verification that the file exists, is readable, or contains valid cookie data. | MEDIUM |
| CH-04 | **Firefox auto-detection reads directory existence only** — `get_cookies_args()` checks if `%APPDATA%\Mozilla\Firefox` exists. It does NOT read cookie contents. | INFO |
| CH-05 | **Cookies file used in `--cookies` flag** — yt-dlp's `--cookies` flag reads a Netscape-format cookies file. This exposes YouTube session cookies to the yt-dlp subprocess. If yt-dlp is compromised, cookies could leak. | MEDIUM |

**Recommendations:**
- (CH-01) At minimum, localStorage access is sandboxed per-origin in the WebView and not accessible to other apps. This is acceptable for MVP. For higher security, use the Rust backend to manage cookie paths without exposing them to the frontend.
- (CH-03) Validate the cookies file exists and is readable in the `get_cookie_flags()` function. Return an error or warning if the file cannot be accessed.
- (CH-05) See CI recommendations: keep yt-dlp updated to latest version to mitigate any future cookie-extraction vulnerabilities.
- Document in the app UI: "YouTube cookies are passed to yt-dlp for authentication. Only use cookies from accounts you trust."

---

### 3.6 Process Spawning & Management

| ID | Finding | Rating |
|----|---------|--------|
| PS-01 | **`CREATE_NO_WINDOW` on all spawns** — All subprocesses use `creation_flags(CREATE_NO_WINDOW)` to suppress console windows. Best practice followed. | INFO |
| PS-02 | **`taskkill /F` forcefully terminates processes** — Cancel/pause use `taskkill /F /PID <pid>` which force-kills the process tree. Could orphan child processes if yt-dlp spawns sub-processes. | LOW |
| PS-03 | **Process tracking via `HashMap<String, u32>`** — PIDs stored in shared state, used for cancellation. No timeout or zombie-process cleanup. If a download crashes or is killed externally, PID stays in map. | LOW |
| PS-04 | **Stdout parsing is best-effort** — `BufReader::lines()` reads yt-dlp progress from stdout. Regex-based parsing could fail on malformed output, but this is best-effort parsing, not a security boundary. | INFO |
| PS-05 | **yt-dlp self-update via `-U` flag** — `update_ytdlp` runs `yt-dlp -U` which auto-updates the binary. This downloads a new executable from the internet and replaces the current one. | MEDIUM |

**Recommendations:**
- (PS-03) Add periodic cleanup for stale PIDs (e.g., check if process still exists before attempting to kill).
- (PS-05) The auto-update downloads a signed binary from GitHub releases. This is the canonical update mechanism for yt-dlp and is reasonably trustworthy. Document that the app auto-updates yt-dlp.

---

### 3.7 Tauri Capabilities & Permissions

| ID | Finding | Rating |
|----|---------|--------|
| CP-01 | **Overly broad `shell:default` permission** — Grants `allow-execute`, `allow-spawn`, `allow-open`, `allow-stdin-write`, and `allow-kill`. The app only needs `allow-open` for playing videos and opening folders. The other shell permissions are unused but available if frontend is compromised. | HIGH |
| CP-02 | **`fs:default` grants broad read/write access** — `fs:default` enables read/write to `$APPDATA`, `$APPLOCALDATA`, `$APPCONFIG`, `$APPCACHE`, `$APPLOG` — all app-specific directories. The app does not use the `fs` plugin directly (it uses dialog and Rust-side file ops), so this capability is unnecessary. | MEDIUM |
| CP-03 | **`process:default` grants exit/restart** — `process:default` includes `allow-exit` and `allow-restart`. These are low-risk but unnecessary if not used. | LOW |
| CP-04 | **`dialog:default` grants message/save/open** — All dialog types are enabled. The app only uses `open` (folder picker). | LOW |
| CP-05 | **Window permissions correctly scoped** — Previously fixed: `allow-minimize`, `allow-close`, `allow-toggle-maximize`, `allow-start-dragging` now explicitly granted. | INFO |
| CP-06 | **No scope restrictions on any permission** — No `allow`/`deny` scope objects used anywhere. All permissions are granted globally. | MEDIUM |

**Recommendations:**
- (CP-01) **HIGH PRIORITY.** Replace `"shell:default"` with only `"shell:allow-open"`. Remove `"shell:allow-execute"`, `"shell:allow-spawn"`, `"shell:allow-stdin-write"`, `"shell:allow-kill"` unless explicitly needed. The app spawns yt-dlp and taskkill from Rust code, not from the frontend shell plugin.
- (CP-02) Remove `"fs:default"`, `"fs:allow-read"`, `"fs:allow-write"` if the app's Rust backend handles file operations directly (it does — via `std::fs` and `tauri::path`).
- (CP-06) Add scope restrictions where possible. For example, restrict `shell:allow-open` to only allow `$DOWNLOAD/**` and `$DESKTOP/**` patterns rather than any path.

---

### 3.8 Data at Rest & in Transit

| ID | Finding | Rating |
|----|---------|--------|
| DR-01 | **Settings in localStorage (unencrypted)** — Zustand persist middleware stores settings including `cookiesFile` path in `localStorage`. Accessible to any JavaScript running in the WebView. | MEDIUM |
| DR-02 | **Download queue in memory only** — No persistence of download history or queue state. Acceptable for MVP. | INFO |
| DR-03 | **SQLite plugin registered but unused** — `tauri_plugin_sql::Builder::default().build()` is initialized but `db::init()` does nothing. If DB is used later, careful attention needed for SQL injection. | INFO |
| DR-04 | **All IPC traffic is serialized JSON** — Tauri IPC uses the WebView's postMessage mechanism. Communication is internal to the process (no network exposure in production). | INFO |
| DR-05 | **Dev server binds to localhost:5173** — Vite dev server is accessible to localhost only. If exposed to network (e.g., via `--host`), would allow arbitrary frontend code injection. | LOW |
| DR-06 | **No application-level encryption** — Cookies file paths, download locations, and all user data are stored without encryption. Acceptable for a desktop app running under the user's account. | INFO |

**Recommendations:**
- (DR-01) For MVP this is acceptable — localStorage is sandboxed by the OS WebView. Consider encrypting sensitive values (cookies file path) before storing in localStorage if threat model includes local malware reading WebView storage.
- (DR-05) Ensure dev server is never started with `--host` or exposed to the network. Add a note to the README.

---

### 3.9 Dependency & Supply Chain Security

| ID | Finding | Rating |
|----|---------|--------|
| SC-01 | **pnpm lockfile present** — `pnpm-lock.yaml` ensures reproducible Node.js dependency resolution. | INFO |
| SC-02 | **Cargo.lock present** — `Cargo.lock` ensures reproducible Rust dependency resolution. | INFO |
| SC-03 | **`cargo audit` / `npm audit` not run** — No automated vulnerability scanning in build pipeline. | MEDIUM |
| SC-04 | **`tauri-plugin-updater` in `package.json` but not in `Cargo.toml`** — The npm package `@tauri-apps/plugin-updater` is listed as a dependency but the Rust plugin is not in `Cargo.toml` and not registered in `lib.rs`. Dead dependency that could become outdated. | LOW |
| SC-05 | **yt-dlp downloaded from GitHub releases** — Downloaded via PowerShell `Invoke-WebRequest` from the official GitHub releases URL. This is the canonical distribution method but has no signature verification. | MEDIUM |
| SC-06 | **FFmpeg downloaded from gyan.dev** — Downloaded from `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`. This is a third-party build distribution (not FFmpeg official). No checksum verification. | MEDIUM |
| SC-07 | **Tauri version pinned (^2.11.3)** — Semver range allows minor/patch updates. Acceptable. | INFO |
| SC-08 | **Builds are not reproducible** — No CI/CD configuration, no reproducible build verification. | LOW |

**Recommendations:**
- (SC-03) Add `cargo audit` and `npm audit` to CI pipeline before production release. Create a `ci.yml` GitHub Actions workflow.
- (SC-04) Remove `@tauri-apps/plugin-updater` from `package.json` or fully integrate the plugin for app updates.
- (SC-05/SC-06) Add SHA-256 hash verification for downloaded binaries. Hardcode expected hashes and verify after download before executing.
- (SC-07) Consider pinning to exact Tauri version (`"2.11.3"` instead of `"^2.11.3"`) for reproducible builds.

---

### 3.10 Network Request Security

| ID | Finding | Rating |
|----|---------|--------|
| NR-01 | **yt-dlp makes unrestricted HTTPS requests** — yt-dlp connects to YouTube (and any URL the user provides). This is by design. yt-dlp uses HTTPS with certificate verification. | INFO |
| NR-02 | **yt-dlp download uses GitHub HTTPS** — yt-dlp.exe downloaded from `https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe`. Uses HTTPS with certificate verification via PowerShell. | INFO |
| NR-03 | **FFmpeg download uses gyan.dev HTTPS** — Downloaded from `https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip`. Uses HTTPS. | INFO |
| NR-04 | **No telemetry or analytics endpoints** — The app makes no network requests other than through yt-dlp and explicit tool downloads. | INFO |
| NR-05 | **CSP allows HTTPS connections to all origins** — The CSP `connect-src 'self' https:` allows the WebView to make HTTPS connections to any host. If frontend is compromised, data could be exfiltrated to any HTTPS server. | HIGH |

**Recommendations:**
- (NR-05) **HIGH PRIORITY for production 1.0.** Restrict CSP `connect-src` to only the origins the app needs. Since the app frontend does not make direct network requests (all requests go through Rust/y-t-dlp), consider `connect-src 'self'` only, or remove `connect-src` entirely and rely on default-src.

---

### 3.11 Error Handling & Information Disclosure

| ID | Finding | Rating |
|----|---------|--------|
| ED-01 | **yt-dlp stderr forwarded to frontend** — Error messages from yt-dlp (which may include URLs, file paths, or metadata) are returned to the frontend in error strings. Displayed in UI error cards. | LOW |
| ED-02 | **File paths in error messages** — `Failed to start download: <path>` errors include the resolved yt-dlp binary path, which reveals local filesystem structure. | LOW |
| ED-03 | **Stack traces could leak in development** — `console.error` calls in frontend could expose internal state. Acceptable during development. | INFO |
| ED-04 | **No log sanitization** — The log plugin (enabled in debug builds) logs all Tauri activity. If logs are persisted or shared, they could contain sensitive info. | LOW |

**Recommendations:**
- (ED-01/ED-02) Strip or sanitize sensitive paths from error messages before displaying to users. Return generic "An error occurred" with a reference code instead of raw error strings.
- (ED-04) In production builds, disable the log plugin or configure it to not log sensitive data.

---

### 3.12 CSP & Frontend Hardening

| ID | Finding | Rating |
|----|---------|--------|
| FH-01 | **`style-src 'unsafe-inline'` required** — Tailwind/shadcn injects inline styles. Acceptable trade-off. | INFO |
| FH-02 | **`img-src 'self' https: data:` allows any HTTPS image** — The app renders YouTube thumbnails (from `i.ytimg.com` and other hosts). Broad scope is necessary for functionality. | LOW |
| FH-03 | **`media-src 'self' https:` allows any HTTPS media** — Needed for future media playback features. Scope is broad but necessary for video/audio content from YouTube. | LOW |
| FH-04 | **`connect-src 'self' https:` allows any HTTPS connection** — See NR-05. This is the biggest CSP concern. | HIGH |
| FH-05 | **No `script-src` override** — Falls back to `default-src 'self'`, so only local scripts are allowed. This is good. | INFO |
| FH-06 | **Custom DOM events for navigation** — `window.dispatchEvent(new CustomEvent("navigate", ...))` is used for SPA routing. Any JavaScript in the page can dispatch navigations. Low risk since no URL handling is involved. | INFO |

**Recommendations:**
- (FH-04) Tighten `connect-src` to `'self'` since the frontend doesn't make direct network requests (all fetching goes through Rust/y-t-dlp). If yt-dlp's JSON output or thumbnails are loaded directly from the frontend, add only specific origins (e.g., `https://i.ytimg.com` for thumbnails).

---

## 4. Feature-by-Feature Rating Matrix

| Feature | Input Validation | Secure IPC | Safe Subprocess | Data Protection | Supply Chain | Overall |
|---------|:---------------:|:----------:|:---------------:|:---------------:|:------------:|:-------:|
| **Channel URL Fetch** | ❌ Frontend-only | ✅ | ✅ | ✅ | ✅ | **HIGH** |
| **Video/Shorts/Streams Tabs** | ❌ Frontend-only | ✅ | ✅ | ✅ | ✅ | **HIGH** |
| **Playlist Display** | ❌ Frontend-only | ✅ | ✅ | ✅ | ✅ | **HIGH** |
| **Download Execution** | ⚠️ Partial | ✅ | ⚠️ `--` flag risk | ⚠️ Path validation | ⚠️ yt-dlp dependency | **CRITICAL** |
| **Queue Management** | ✅ | ✅ | ✅ | ✅ | ✅ | **LOW** |
| **Cancel/Pause/Resume** | ✅ | ✅ | ✅ | ✅ | ✅ | **LOW** |
| **Setting Persistence** | ⚠️ No schema validation | ✅ | N/A | ⚠️ Plaintext localStorage | ✅ | **MEDIUM** |
| **yt-dlp Install/Update** | ✅ | ✅ | ⚠️ No hash verification | ✅ | ⚠️ No checksums | **MEDIUM** |
| **FFmpeg Install** | ✅ | ✅ | ⚠️ No hash verification | ✅ | ⚠️ Third-party build, no checksums | **MEDIUM** |
| **Cookie Auth** | ✅ | ✅ | ✅ | ⚠️ Plaintext path storage | ✅ | **MEDIUM** |
| **File Open (Play/Folder)** | ⚠️ Path from yt-dlp stdout | ✅ | N/A | ✅ | ✅ | **MEDIUM** |

**Legend:** ✅ Secure / ⚠️ Partially Secure / ❌ Not Secure

---

## 5. Risk Register

| # | Risk | Likelihood | Impact | Risk Level | Owner | Status |
|---|------|:----------:|:------:|:----------:|:-----:|:------:|
| R-01 | yt-dlp RCE via crafted URL passed as flag | Medium | Critical | **HIGH** | Dev | Open |
| R-02 | Path traversal via output_path leading to arbitrary file write | Medium | High | **HIGH** | Dev | Open |
| R-03 | Frontend XSS leading to shell execution via overly broad permissions | Low | Critical | **HIGH** | Dev | Open |
| R-04 | Data exfiltration via broad CSP connect-src | Low | High | **MEDIUM** | Dev | Open |
| R-05 | Compromised yt-dlp/FFmpeg download (MITM or supply chain) | Low | Critical | **HIGH** | Dev | Open |
| R-06 | Cookies file read by malicious yt-dlp | Low | Medium | **LOW** | Dev | Accept |
| R-07 | Settings store poisoning via update_setting | Low | Medium | **LOW** | Dev | Open |
| R-08 | yt-dlp zero-day vulnerability | Medium | Critical | **CRITICAL** | Upstream | Monitor |
| R-09 | Process tracking leaks (stale PIDs) | Low | Low | **LOW** | Dev | Open |
| R-10 | yt-dlp metadata parsing crash (DoS) | Medium | Low | **LOW** | Dev | Accept |

---

## 6. Recommendations Summary

### Must Fix Before Production (CRITICAL/HIGH)

| Priority | Finding ID | Action |
|:--------:|:----------:|--------|
| **P0** | IV-01, IV-05, CI-04 | Add server-side URL validation in all Rust commands. Allowlist `youtube.com` and `youtu.be`. Reject URLs starting with `--` or `-`. |
| **P0** | IV-03, PT-01 | Validate and canonicalize `output_path` in `start_download`. Reject paths with `..`. |
| **P0** | CP-01 | Narrow `shell:default` to only `shell:allow-open`. Remove unused shell permissions. |
| **P1** | NR-05, FH-04 | Tighten CSP `connect-src` to `'self'` only. |
| **P1** | CP-02 | Remove unused `fs:default`, `fs:allow-read`, `fs:allow-write`. |
| **P1** | CI-05 | Add SHA-256 verification for downloaded yt-dlp and FFmpeg binaries. |
| **P1** | IV-04 | Move path sanitization to Rust backend as defense-in-depth. |

### Should Fix Before 1.0 (MEDIUM)

| Priority | Finding ID | Action |
|:--------:|:----------:|--------|
| P2 | A-01 | Add command-level capabilities with `AppManifest::commands`. |
| P2 | A-03 | Replace `HashMap<String, String>` settings with typed struct. |
| P2 | CP-06 | Add scope restrictions to permissions (e.g., `$DOWNLOAD/**` for file open). |
| P2 | SC-03 | Add `cargo audit` and `npm audit` to build pipeline. |
| P2 | DR-05 | Add dev server security note to README. |
| P2 | ED-01 | Sanitize error messages before returning to frontend. |
| P2 | PT-05 | Validate file paths before calling `open()`. |
| P2 | SC-04 | Remove unused `@tauri-apps/plugin-updater` or integrate fully. |

### Post-MVP / Future (LOW)

| Priority | Finding ID | Action |
|:--------:|:----------:|--------|
| P3 | A-02 | Consider Tauri Isolation pattern for IPC validation layer. |
| P3 | PS-03 | Add periodic stale PID cleanup. |
| P3 | CH-01 | Consider encrypting sensitive values in localStorage. |
| P3 | A-04 | Evaluate multi-webview architecture for sensitive pages. |
| P3 | SC-08 | Set up CI/CD with reproducible builds and binary signing. |

---

## 7. Severity Reference

```
CRITICAL (P0)  → Release-blocking. Active exploit possible. Fix immediately.
HIGH (P1)      → Significant risk. Requires mitigation before GA release.
MEDIUM (P2)    → Moderate risk. Plan for next release cycle.
LOW (P3)       → Minor hardening. Address as time permits.
INFO           → Documented for context. No action required.
```

---

*Audit completed 2026-07-28. All findings based on source code at `C:\Projects\channel downloader` commit HEAD. Re-audit recommended after addressing findings and before any major architecture change.*
