use crate::commands::settings::SettingsState;
use crate::models::download::*;
use crate::process::manager::ProcessManager;
use crate::queue::manager::QueueManager;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use regex::Regex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct DownloadState {
    pub queue: Arc<Mutex<QueueManager>>,
    pub processes: Arc<Mutex<HashMap<String, u32>>>,
}

fn get_bin_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("bin")
}

fn resolve_ytdlp(app: &AppHandle) -> Option<PathBuf> {
    if let Some(path) = ProcessManager::find_tool_path("yt-dlp") {
        return Some(path);
    }
    let bundled = get_bin_dir(app).join("yt-dlp.exe");
    if bundled.exists() {
        return Some(bundled);
    }
    None
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    request: DownloadRequest,
    state: State<'_, DownloadState>,
) -> Result<DownloadItem, String> {
    let mut queue = state.queue.lock().await;
    let item = queue.add_item(request)?;
    let id = item.id.clone();
    drop(queue);

    let queue = state.queue.clone();
    let processes = state.processes.clone();
    let ytdlp = resolve_ytdlp(&app).ok_or_else(|| "yt-dlp not found".to_string())?;

    let id_for_return = id.clone();
    tokio::spawn(async move {
        run_download(id, ytdlp, app, queue, processes).await;
    });

    let queue = state.queue.lock().await;
    queue.get_item(&id_for_return).ok_or_else(|| "Item not found".to_string())
}

fn get_cookie_flags(app: &AppHandle) -> Vec<String> {
    let settings = app.state::<SettingsState>();
    if let Ok(lock) = settings.settings.lock() {
        if let Some(path) = lock.get("cookies_file") {
            if !path.is_empty() {
                return vec!["--cookies".to_string(), path.clone()];
            }
        }
    }
    ProcessManager::get_cookies_args()
}

async fn process_progress_line(
    line: &str,
    download_id: &str,
    app: &AppHandle,
    queue: &Arc<Mutex<QueueManager>>,
    pid: u32,
    progress_re: &Regex,
    speed_re: &Regex,
    eta_re: &Regex,
) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() { return false; }

    let progress = progress_re.captures(trimmed)
        .and_then(|c| c.get(1))
        .and_then(|m| m.as_str().parse::<f64>().ok());
    let speed = speed_re.captures(trimmed)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());
    let eta = eta_re.captures(trimmed)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string());

    if let Some(pct) = progress {
        {
            let mut q = queue.lock().await;
            q.update_item_progress(download_id, pct, speed.clone(), eta.clone());
        }
        let _ = app.emit("download-progress", serde_json::json!({
            "id": download_id,
            "progress": pct,
            "speed": speed,
            "eta": eta,
        }));
    }

    let status = {
        let q = queue.lock().await;
        q.get_item(download_id).map(|i| i.status.clone())
    };

    match status {
        Some(DownloadStatus::Cancelled) | Some(DownloadStatus::Paused) => {
            let _ = std::process::Command::new("taskkill")
                .creation_flags(CREATE_NO_WINDOW)
                .args(["/F", "/PID", &pid.to_string()])
                .output();
            return true;
        }
        _ => {}
    }
    false
}

fn extract_video_id(url: &str) -> Option<String> {
    let youtube_re = Regex::new(r"(?:v=|youtu\.be/|shorts/)([a-zA-Z0-9_-]{11})").unwrap();
    youtube_re.captures(url)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

fn sanitize_filename(name: &str) -> String {
    name.replace(|c: char| c.is_ascii_control() || matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'), "_")
        .trim()
        .to_string()
}

async fn run_download(
    download_id: String,
    ytdlp: PathBuf,
    app: AppHandle,
    queue: Arc<Mutex<QueueManager>>,
    processes: Arc<Mutex<HashMap<String, u32>>>,
) {
    let (url, output, format_id, video_fmt, audio_only, audio_fmt, audio_qual, title) = {
        let q = queue.lock().await;
        let item = match q.get_item(&download_id) {
            Some(i) => i,
            None => return,
        };
        (
            item.url.clone(),
            item.output_path.clone(),
            item.format_id.clone(),
            item.video_format.clone(),
            item.audio_only,
            item.audio_format.clone(),
            item.audio_quality.clone(),
            item.title.clone(),
        )
    };

    let output_dir = std::path::Path::new(&output);
    std::fs::create_dir_all(output_dir).ok();

    let ext = if audio_only {
        audio_fmt.as_deref().unwrap_or("mp3")
    } else {
        video_fmt.as_deref().unwrap_or("mp4")
    };
    let _video_id = extract_video_id(&url).unwrap_or_else(|| "video".to_string());
    let safe_title = sanitize_filename(&title);
    let friendly_name = if audio_only {
        let aq = audio_qual.as_deref().unwrap_or("192");
        format!("{}-{}-{}.{}", safe_title, audio_fmt.as_deref().unwrap_or("mp3"), aq, ext)
    } else {
        format!("{}.{}", safe_title, ext)
    };
    let expected_path = output_dir.join(&friendly_name);
    let expected_str = expected_path.to_string_lossy().to_string();

    let mut args: Vec<String> = get_cookie_flags(&app);
    args.push("--no-warnings".to_string());
    args.push("--newline".to_string());
    args.push("--progress".to_string());
    args.push("-o".to_string());
    args.push(expected_str.clone());

    if audio_only {
        args.push("-f".to_string());
        args.push("bestaudio/best".to_string());
        args.push("--extract-audio".to_string());
        if let Some(af) = &audio_fmt {
            args.push("--audio-format".to_string());
            args.push(af.clone());
        }
        if let Some(aq) = &audio_qual {
            args.push("--audio-quality".to_string());
            args.push(aq.clone());
        }
    } else {
        let height: String = format_id.chars().take_while(|c| c.is_ascii_digit()).collect();
        let format_arg = if height.is_empty() {
            "bestvideo+bestaudio/best".to_string()
        } else {
            format!("bestvideo[height<={}]+bestaudio/best", height)
        };
        args.push("-f".to_string());
        args.push(format_arg);
        if let Some(vf) = &video_fmt {
            args.push("--merge-output-format".to_string());
            args.push(vf.clone());
        }
    }
    args.push(url.clone());

    {
        let mut q = queue.lock().await;
        q.update_item_path(&download_id, Some(expected_str.clone()));
    }

    match tokio::process::Command::new(&ytdlp)
        .creation_flags(CREATE_NO_WINDOW)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
    {
        Ok(mut child) => {
            let pid = child.id().unwrap_or(0);
            {
                let mut p = processes.lock().await;
                p.insert(download_id.clone(), pid);

                let mut q = queue.lock().await;
                q.update_item_status(&download_id, DownloadStatus::Downloading, None);
                let _ = app.emit("download-status", serde_json::json!({
                    "id": download_id,
                    "status": "Downloading",
                }));
            }

            let output = child.stdout.take().unwrap();
            let error = child.stderr.take().unwrap();
            let mut reader = BufReader::new(output).lines();
            let mut err_reader = BufReader::new(error).lines();

            let progress_re = Regex::new(r"(\d+\.?\d*)%").unwrap();
            let speed_re = Regex::new(r"at\s+([\d.]+[KMG]?i?B/s)").unwrap();
            let eta_re = Regex::new(r"ETA\s+(\d+:\d+)").unwrap();

            let mut stderr_lines: Vec<String> = Vec::new();
            let mut done = false;
            while !done {
                let line_fut = reader.next_line();
                let err_fut = err_reader.next_line();
                let sleep_fut = sleep(Duration::from_secs(30));

                tokio::select! {
                    line_result = line_fut => {
                        match line_result {
                            Ok(Some(line)) => {
                                if process_progress_line(&line, &download_id, &app, &queue, pid, &progress_re, &speed_re, &eta_re).await {
                                    break;
                                }
                            }
                            Ok(None) => done = true,
                            Err(_) => done = true,
                        }
                    }
                    line_result = err_fut => {
                        match line_result {
                            Ok(Some(line)) => {
                                stderr_lines.push(line.clone());
                                if process_progress_line(&line, &download_id, &app, &queue, pid, &progress_re, &speed_re, &eta_re).await {
                                    break;
                                }
                            }
                            Ok(None) => {}
                            Err(_) => {}
                        }
                    }
                    _ = sleep_fut => {
                        let status = {
                            let q = queue.lock().await;
                            q.get_item(&download_id).map(|i| i.status.clone())
                        };
                        if status != Some(DownloadStatus::Downloading) {
                            break;
                        }
                    }
                }
            }

            let exit_status = child.wait().await;

            let final_status = {
                let q = queue.lock().await;
                q.get_item(&download_id).map(|i| i.status.clone())
            };

            match final_status {
                Some(DownloadStatus::Downloading) | Some(DownloadStatus::Queued) => {
                    let success = exit_status.is_ok() && exit_status.unwrap().success();
                    if success {
                        let file_verified = expected_path.exists() && std::fs::metadata(&expected_path).map(|m| m.len() > 0).unwrap_or(false);

                        if file_verified {
                            let mut q = queue.lock().await;
                            q.update_item_path(&download_id, Some(expected_str.clone()));
                            q.update_item_status(&download_id, DownloadStatus::Completed, None);
                            q.update_item_progress(&download_id, 100.0, None, None);
                            let saved = q.get_item(&download_id);
                            if let Some(s) = saved {
                                crate::history::HistoryStore::add(&app, &s);
                            }
                            let _ = app.emit("download-status", serde_json::json!({
                                "id": download_id,
                                "status": "Completed",
                            }));
                        } else {
                            let mut q = queue.lock().await;
                            q.update_item_status(
                                &download_id,
                                DownloadStatus::Failed,
                                Some("Download completed but output file not found or is empty".to_string()),
                            );
                            let saved = q.get_item(&download_id);
                            if let Some(s) = saved {
                                crate::history::HistoryStore::add(&app, &s);
                            }
                            let _ = app.emit("download-status", serde_json::json!({
                                "id": download_id,
                                "status": "Failed",
                                "error": "Download completed but output file not found or is empty",
                            }));
                        }
                    } else {
                        let error_msg = if !stderr_lines.is_empty() {
                            let last_lines: Vec<&str> = stderr_lines.iter().rev().take(3).rev().map(|s| s.as_str()).collect();
                            format!("yt-dlp error: {}", last_lines.join(" | "))
                        } else {
                            "yt-dlp process exited with an error".to_string()
                        };
                        let mut q = queue.lock().await;
                        q.update_item_status(
                            &download_id,
                            DownloadStatus::Failed,
                            Some(error_msg.clone()),
                        );
                        let saved = q.get_item(&download_id);
                        if let Some(s) = saved {
                            crate::history::HistoryStore::add(&app, &s);
                        }
                        let _ = app.emit("download-status", serde_json::json!({
                            "id": download_id,
                            "status": "Failed",
                            "error": error_msg,
                        }));
                    }
                }
                _ => {}
            }

            let mut p = processes.lock().await;
            p.remove(&download_id);
        }
        Err(e) => {
            let mut q = queue.lock().await;
            q.update_item_status(
                &download_id,
                DownloadStatus::Failed,
                Some(format!("Failed to start download: {}", e)),
            );
            let _ = app.emit("download-status", serde_json::json!({
                "id": download_id,
                "status": "Failed",
                "error": format!("Failed to start download: {}", e),
            }));
        }
    }
}

#[tauri::command]
pub async fn cancel_download(
    app: tauri::AppHandle,
    id: String,
    state: State<'_, DownloadState>,
) -> Result<(), String> {
    let processes = state.processes.lock().await;
    if let Some(pid) = processes.get(&id) {
        let _ = std::process::Command::new("taskkill")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/F", "/PID", &pid.to_string()])
            .output();
    }
    drop(processes);

    let mut queue = state.queue.lock().await;
    let res = queue.cancel_item(&id);
    if res.is_ok() {
        if let Some(item) = queue.get_item(&id) {
            crate::history::HistoryStore::add(&app, &item);
        }
    }
    res
}

#[tauri::command]
pub async fn pause_download(
    id: String,
    state: State<'_, DownloadState>,
) -> Result<(), String> {
    let processes = state.processes.lock().await;
    if let Some(pid) = processes.get(&id) {
        let _ = std::process::Command::new("taskkill")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["/F", "/PID", &pid.to_string()])
            .output();
    }
    drop(processes);

    let mut queue = state.queue.lock().await;
    queue.pause_item(&id)
}

#[tauri::command]
pub async fn resume_download(
    id: String,
    state: State<'_, DownloadState>,
) -> Result<(), String> {
    let mut queue = state.queue.lock().await;
    queue.resume_item(&id)
}

#[tauri::command]
pub async fn get_queue(
    state: State<'_, DownloadState>,
) -> Result<QueueState, String> {
    let queue = state.queue.lock().await;
    Ok(queue.get_state())
}

#[tauri::command]
pub async fn clear_queue(
    state: State<'_, DownloadState>,
) -> Result<(), String> {
    let mut queue = state.queue.lock().await;
    queue.clear_completed();
    Ok(())
}

#[tauri::command]
pub async fn get_history(app: AppHandle) -> Vec<DownloadItem> {
    crate::history::HistoryStore::load(&app)
}

#[tauri::command]
pub async fn clear_history(app: AppHandle) -> Result<(), String> {
    crate::history::HistoryStore::clear(&app);
    Ok(())
}
