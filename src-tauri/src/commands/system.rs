use crate::process::manager::ProcessManager;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

fn get_bin_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_local_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("bin")
}

#[tauri::command]
pub async fn check_tools(app: AppHandle) -> Result<serde_json::Value, String> {
    let ytdlp = resolve_ytdlp(&app).is_some();
    let ffmpeg = ProcessManager::find_tool("ffmpeg");

    Ok(serde_json::json!({
        "ytdlp": ytdlp,
        "ffmpeg": ffmpeg,
        "ytdlp_path": resolve_ytdlp(&app).map(|p| p.to_string_lossy().to_string()),
    }))
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
pub async fn ensure_ytdlp(app: AppHandle) -> Result<String, String> {
    if let Some(path) = resolve_ytdlp(&app) {
        return Ok(path.to_string_lossy().to_string());
    }

    let bin = get_bin_dir(&app);
    std::fs::create_dir_all(&bin).map_err(|e| format!("Failed to create bin dir: {}", e))?;

    let path = ProcessManager::download_ytdlp(&bin)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn update_ytdlp(app: AppHandle) -> Result<String, String> {
    let ytdlp = resolve_ytdlp(&app).ok_or_else(|| "yt-dlp not found".to_string())?;
    let output = ProcessManager::run_simple(
        &ytdlp.to_string_lossy(),
        &["-U"],
    )
    .map_err(|e| format!("Failed to update yt-dlp: {}", e))?;
    Ok(output)
}

#[tauri::command]
pub async fn get_ytdlp_version(app: AppHandle) -> Result<String, String> {
    let ytdlp = resolve_ytdlp(&app).ok_or_else(|| "yt-dlp not found".to_string())?;
    let output = ProcessManager::run_simple(
        &ytdlp.to_string_lossy(),
        &["--version"],
    )
    .map_err(|e| format!("Failed to get yt-dlp version: {}", e))?;
    Ok(output.trim().to_string())
}

#[tauri::command]
pub async fn get_ffmpeg_version() -> Result<String, String> {
    let output = ProcessManager::run_simple("ffmpeg", &["-version"])
        .map_err(|e| format!("Failed to get FFmpeg version: {}", e))?;
    let line = output.lines().next().unwrap_or("unknown");
    Ok(line.to_string())
}

#[tauri::command]
pub async fn ensure_ffmpeg(app: AppHandle) -> Result<String, String> {
    if let Some(path) = ProcessManager::find_tool_path("ffmpeg") {
        return Ok(path.to_string_lossy().to_string());
    }

    let bin = get_bin_dir(&app);
    std::fs::create_dir_all(&bin).map_err(|e| format!("Failed to create bin dir: {}", e))?;

    let path = ProcessManager::download_ffmpeg(&bin)?;
    Ok(path.to_string_lossy().to_string())
}
