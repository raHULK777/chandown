use crate::models::download::{DownloadItem, DownloadStatus};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub struct HistoryStore;

const HISTORY_FILE: &str = "download_history.json";

impl HistoryStore {
    fn history_path(app: &AppHandle) -> PathBuf {
        app.path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(HISTORY_FILE)
    }

    pub fn add(app: &AppHandle, item: &DownloadItem) {
        let mut items = Self::load(app);
        if let Some(existing) = items.iter_mut().find(|i| i.id == item.id) {
            *existing = item.clone();
        } else {
            items.push(item.clone());
        }
        items.sort_by(|a, b| b.queued_at.cmp(&a.queued_at));
        Self::save(app, &items);
    }

    pub fn load(app: &AppHandle) -> Vec<DownloadItem> {
        let path = Self::history_path(app);
        if !path.exists() {
            return Vec::new();
        }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str::<Vec<DownloadItem>>(&s).ok())
            .unwrap_or_default()
    }

    pub fn clear(app: &AppHandle) {
        let path = Self::history_path(app);
        let _ = std::fs::remove_file(path);
    }

    fn save(app: &AppHandle, items: &[DownloadItem]) {
        let path = Self::history_path(app);
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(items) {
            let _ = std::fs::write(&path, json);
        }
    }
}

#[allow(dead_code)]
pub fn is_terminal_status(status: &DownloadStatus) -> bool {
    matches!(
        status,
        DownloadStatus::Completed | DownloadStatus::Failed | DownloadStatus::Cancelled
    )
}
