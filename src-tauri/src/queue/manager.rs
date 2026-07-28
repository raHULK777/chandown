use crate::models::download::*;

pub struct QueueManager {
    items: Vec<DownloadItem>,
    max_concurrent: usize,
}

impl QueueManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            items: Vec::new(),
            max_concurrent,
        }
    }

    pub fn add_item(&mut self, request: DownloadRequest) -> Result<DownloadItem, String> {
        let item = DownloadItem {
            id: uuid_v4(),
            url: request.url,
            title: request.title,
            format_id: request.format_id,
            output_path: request.output_path,
            video_format: request.video_format,
            status: DownloadStatus::Queued,
            progress: 0.0,
            speed: None,
            eta: None,
            filesize: None,
            downloaded_bytes: None,
            error: None,
            queued_at: chrono_now(),
            file_path: None,
        };

        let id = item.id.clone();
        self.items.push(item);

        self.items.iter()
            .find(|i| i.id == id)
            .cloned()
            .ok_or_else(|| "Item not found after adding".to_string())
    }

    pub fn cancel_item(&mut self, id: &str) -> Result<(), String> {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.status = DownloadStatus::Cancelled;
            Ok(())
        } else {
            Err("Item not found".to_string())
        }
    }

    pub fn pause_item(&mut self, id: &str) -> Result<(), String> {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            if item.status == DownloadStatus::Downloading {
                item.status = DownloadStatus::Paused;
                Ok(())
            } else {
                Err("Item is not downloading".to_string())
            }
        } else {
            Err("Item not found".to_string())
        }
    }

    pub fn resume_item(&mut self, id: &str) -> Result<(), String> {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            if item.status == DownloadStatus::Paused {
                item.status = DownloadStatus::Queued;
                Ok(())
            } else {
                Err("Item is not paused".to_string())
            }
        } else {
            Err("Item not found".to_string())
        }
    }

    pub fn get_state(&self) -> QueueState {
        let active_count = self.items.iter()
            .filter(|i| i.status == DownloadStatus::Downloading)
            .count();

        QueueState {
            items: self.items.clone(),
            active_count,
            max_concurrent: self.max_concurrent,
        }
    }

    pub fn get_item(&self, id: &str) -> Option<DownloadItem> {
        self.items.iter().find(|i| i.id == id).cloned()
    }

    pub fn update_item_status(&mut self, id: &str, status: DownloadStatus, error: Option<String>) {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.status = status;
            if let Some(e) = error {
                item.error = Some(e);
            }
        }
    }

    pub fn update_item_path(&mut self, id: &str, file_path: Option<String>) {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.file_path = file_path;
        }
    }

    pub fn update_item_progress(&mut self, id: &str, progress: f64, speed: Option<String>, eta: Option<String>) {
        if let Some(item) = self.items.iter_mut().find(|i| i.id == id) {
            item.progress = progress;
            if let Some(s) = speed {
                item.speed = Some(s);
            }
            if let Some(e) = eta {
                item.eta = Some(e);
            }
        }
    }

    pub fn clear_completed(&mut self) {
        self.items.retain(|i| i.status != DownloadStatus::Completed && i.status != DownloadStatus::Cancelled);
    }
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("dl-{:x}", nanos)
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let secs = dur.as_secs();
    let millis = dur.subsec_millis();

    let days_since_epoch = secs / 86400;
    let time_secs = secs % 86400;
    let hours = time_secs / 3600;
    let minutes = (time_secs % 3600) / 60;
    let seconds = time_secs % 60;

    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        1970 + (days_since_epoch / 365) as u32,
        1 + ((days_since_epoch % 365) / 30) as u32,
        1 + ((days_since_epoch % 365) % 30) as u32,
        hours, minutes, seconds, millis)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(title: &str) -> DownloadRequest {
        DownloadRequest {
            url: format!("https://youtube.com/watch?v={}", title),
            title: title.to_string(),
            format_id: "best".to_string(),
            output_path: "C:\\Downloads".to_string(),
            quality: "1080p".to_string(),
            audio_only: false,
            audio_format: None,
            audio_quality: None,
            video_format: None,
        }
    }

    #[test]
    fn test_new_queue_is_empty() {
        let qm = QueueManager::new(3);
        let state = qm.get_state();
        assert_eq!(state.items.len(), 0);
        assert_eq!(state.active_count, 0);
        assert_eq!(state.max_concurrent, 3);
    }

    #[test]
    fn test_add_item_returns_item_with_id() {
        let mut qm = QueueManager::new(3);
        let result = qm.add_item(make_request("test1"));
        assert!(result.is_ok());
        let item = result.unwrap();
        assert_eq!(item.title, "test1");
        assert!(item.id.starts_with("dl-"));
        assert_eq!(item.status, DownloadStatus::Queued);
    }

    #[test]
    fn test_add_multiple_items() {
        let mut qm = QueueManager::new(3);
        qm.add_item(make_request("test1")).unwrap();
        qm.add_item(make_request("test2")).unwrap();
        qm.add_item(make_request("test3")).unwrap();
        assert_eq!(qm.get_state().items.len(), 3);
    }

    #[test]
    fn test_cancel_item() {
        let mut qm = QueueManager::new(3);
        let item = qm.add_item(make_request("test1")).unwrap();
        let id = item.id.clone();

        let result = qm.cancel_item(&id);
        assert!(result.is_ok());

        let state = qm.get_state();
        let cancelled = state.items.iter().find(|i| i.id == id).unwrap();
        assert_eq!(cancelled.status, DownloadStatus::Cancelled);
    }

    #[test]
    fn test_cancel_nonexistent_item() {
        let mut qm = QueueManager::new(3);
        let result = qm.cancel_item("nonexistent");
        assert!(result.is_err());
    }

    #[test]
    fn test_pause_item() {
        let mut qm = QueueManager::new(3);
        let mut item = qm.add_item(make_request("test1")).unwrap();
        item.status = DownloadStatus::Downloading;
        qm.items.push(item);
        let id = qm.items.last().unwrap().id.clone();

        // Need to add another to get one we can mutate, easier:
        // Reset and do properly
        qm = QueueManager::new(3);
        let item = qm.add_item(make_request("test1")).unwrap();
        let id = item.id.clone();

        // Directly set to downloading
        qm.items.iter_mut().for_each(|i| {
            if i.id == id {
                i.status = DownloadStatus::Downloading;
            }
        });

        let result = qm.pause_item(&id);
        assert!(result.is_ok());

        let paused = qm.items.iter().find(|i| i.id == id).unwrap();
        assert_eq!(paused.status, DownloadStatus::Paused);
    }

    #[test]
    fn test_pause_non_downloading_item_fails() {
        let mut qm = QueueManager::new(3);
        let item = qm.add_item(make_request("test1")).unwrap();
        let result = qm.pause_item(&item.id);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Item is not downloading");
    }

    #[test]
    fn test_resume_paused_item() {
        let mut qm = QueueManager::new(3);
        let item = qm.add_item(make_request("test1")).unwrap();
        let id = item.id.clone();

        // Set to downloading then pause
        qm.items.iter_mut().for_each(|i| {
            if i.id == id {
                i.status = DownloadStatus::Paused;
            }
        });

        let result = qm.resume_item(&id);
        assert!(result.is_ok());

        let resumed = qm.items.iter().find(|i| i.id == id).unwrap();
        assert_eq!(resumed.status, DownloadStatus::Queued);
    }

    #[test]
    fn test_resume_non_paused_item_fails() {
        let mut qm = QueueManager::new(3);
        let item = qm.add_item(make_request("test1")).unwrap();
        let result = qm.resume_item(&item.id);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Item is not paused");
    }

    #[test]
    fn test_clear_completed_removes_completed_and_cancelled() {
        let mut qm = QueueManager::new(3);

        let item1 = qm.add_item(make_request("keep")).unwrap();
        let item2 = qm.add_item(make_request("cancel_me")).unwrap();
        qm.add_item(make_request("keep2")).unwrap();

        let id2 = item2.id.clone();
        qm.cancel_item(&id2).unwrap();

        let id1 = item1.id.clone();
        qm.items.iter_mut().for_each(|i| {
            if i.id == id1 {
                i.status = DownloadStatus::Completed;
            }
        });

        qm.clear_completed();
        assert_eq!(qm.items.len(), 1);
        assert_eq!(qm.items[0].title, "keep2");
    }

    #[test]
    fn test_get_state_active_count() {
        let mut qm = QueueManager::new(5);
        let item1 = qm.add_item(make_request("t1")).unwrap();
        qm.add_item(make_request("t2")).unwrap();

        let id1 = item1.id.clone();
        qm.items.iter_mut().for_each(|i| {
            if i.id == id1 {
                i.status = DownloadStatus::Downloading;
            }
        });

        let state = qm.get_state();
        assert_eq!(state.active_count, 1);
        assert_eq!(state.max_concurrent, 5);
        assert_eq!(state.items.len(), 2);
    }

    #[test]
    fn test_queue_fifo_order() {
        let mut qm = QueueManager::new(3);
        qm.add_item(make_request("first")).unwrap();
        qm.add_item(make_request("second")).unwrap();
        qm.add_item(make_request("third")).unwrap();

        let items = &qm.get_state().items;
        assert_eq!(items[0].title, "first");
        assert_eq!(items[1].title, "second");
        assert_eq!(items[2].title, "third");
    }
}
