use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum DownloadStatus {
    Queued,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub format_id: String,
    pub output_path: String,
    pub video_format: Option<String>,
    pub audio_only: bool,
    pub audio_format: Option<String>,
    pub audio_quality: Option<String>,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: Option<String>,
    pub eta: Option<String>,
    pub filesize: Option<i64>,
    pub downloaded_bytes: Option<i64>,
    pub error: Option<String>,
    pub queued_at: String,
    pub file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadRequest {
    pub url: String,
    pub title: String,
    pub format_id: String,
    pub output_path: String,
    pub quality: String,
    pub audio_only: bool,
    pub audio_format: Option<String>,
    pub audio_quality: Option<String>,
    pub video_format: Option<String>,
    pub filesize: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QueueState {
    pub items: Vec<DownloadItem>,
    pub active_count: usize,
    pub max_concurrent: usize,
}
