use crate::commands::settings::SettingsState;
use crate::models::download::*;
use crate::process::manager::ProcessManager;
use crate::queue::manager::QueueManager;
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
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

async fn run_download(
    download_id: String,
    ytdlp: PathBuf,
    app: AppHandle,
    queue: Arc<Mutex<QueueManager>>,
    processes: Arc<Mutex<HashMap<String, u32>>>,
) {
    let (url, output, format, video_fmt) = {
        let q = queue.lock().await;
        let item = match q.get_item(&download_id) {
            Some(i) => i,
            None => return,
        };
        (item.url.clone(), item.output_path.clone(), item.format_id.clone(), item.video_format.clone())
    };

    let format_arg = if format == "bestaudio" {
        "bestaudio/best".to_string()
    } else {
        let height: String = format.chars().take_while(|c| c.is_ascii_digit()).collect();
        if height.is_empty() {
            "bestvideo+bestaudio/best".to_string()
        } else {
            format!("bestvideo[height<={}]+bestaudio/best", height)
        }
    };

    let mut args: Vec<String> = get_cookie_flags(&app);
    args.push("--no-warnings".to_string());
    args.push("--newline".to_string());
    args.push("--progress".to_string());
    args.push("-o".to_string());
    args.push(format!(r#"{}\%(title)s [\%(id)s].%(ext)s"#, output));
    args.push("-f".to_string());
    args.push(format_arg);
    if let Some(vf) = &video_fmt {
        args.push("--merge-output-format".to_string());
        args.push(vf.clone());
    }
    args.push(url.clone());

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
            let reader = BufReader::new(output);
            let mut lines = reader.lines();

            use regex::Regex;
            let progress_re = Regex::new(r"(\d+\.?\d*)%").unwrap();
            let speed_re = Regex::new(r"at\s+([\d.]+[KMG]?i?B/s)").unwrap();
            let eta_re = Regex::new(r"ETA\s+(\d+:\d+)").unwrap();
            let dest_re = Regex::new(r#""([^"]+)"$"#).unwrap();

            loop {
                tokio::select! {
                    line_result = lines.next_line() => {
                        match line_result {
                            Ok(Some(line)) => {
                                let trimmed = line.trim();
                                if trimmed.is_empty() { continue; }

                                if trimmed.starts_with("[download] Destination:") || trimmed.starts_with("[Merger]") {
                                    if let Some(cap) = dest_re.captures(trimmed) {
                                        if let Some(path) = cap.get(1) {
                                            let p = path.as_str().to_string();
                                            let mut q = queue.lock().await;
                                            q.update_item_path(&download_id, Some(p));
                                        }
                                    }
                                }

                                let progress = progress_re.captures(trimmed)
                                    .and_then(|c| c.get(1))
                                    .and_then(|m| m.as_str().parse::<f64>().ok());
                                let speed = speed_re.captures(trimmed)
                                    .and_then(|c| c.get(1))
                                    .map(|m| m.as_str().to_string());
                                let eta = eta_re.captures(trimmed)
                                    .and_then(|c| c.get(1))
                                    .map(|m| m.as_str().to_string());

                                if trimmed.contains("[download]") {
                                    if let Some(pct) = progress {
                                        {
                                            let mut q = queue.lock().await;
                                            q.update_item_progress(&download_id, pct, speed.clone(), eta.clone());
                                        }
                                        let _ = app.emit("download-progress", serde_json::json!({
                                            "id": download_id,
                                            "progress": pct,
                                            "speed": speed,
                                            "eta": eta,
                                        }));
                                    }

                                    if trimmed.contains("100%") {
                                        let mut q = queue.lock().await;
                                        q.update_item_status(&download_id, DownloadStatus::Completed, None);
                                        q.update_item_progress(&download_id, 100.0, None, None);
                                        let _ = app.emit("download-status", serde_json::json!({
                                            "id": download_id,
                                            "status": "Completed",
                                        }));
                                    }
                                }

                                let status = {
                                    let q = queue.lock().await;
                                    q.get_item(&download_id).map(|i| i.status.clone())
                                };

                                match status {
                                    Some(DownloadStatus::Cancelled) | Some(DownloadStatus::Paused) => {
                                        let _ = std::process::Command::new("taskkill")
                                            .creation_flags(CREATE_NO_WINDOW)
                                            .args(["/F", "/PID", &pid.to_string()])
                                            .output();
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                            Ok(None) => break,
                            Err(_) => break,
                        }
                    }
                    _ = sleep(Duration::from_secs(30)) => {
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

            let _ = child.wait().await;

            let final_status = {
                let q = queue.lock().await;
                q.get_item(&download_id).map(|i| i.status.clone())
            };

            if final_status == Some(DownloadStatus::Downloading) || final_status == Some(DownloadStatus::Queued) {
                let mut q = queue.lock().await;
                q.update_item_status(&download_id, DownloadStatus::Completed, None);
                q.update_item_progress(&download_id, 100.0, None, None);
                let _ = app.emit("download-status", serde_json::json!({
                    "id": download_id,
                    "status": "Completed",
                }));
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
    queue.cancel_item(&id)
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
