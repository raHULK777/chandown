use crate::commands::settings::SettingsState;
use crate::process::manager::ProcessManager;
use crate::models::channel::*;
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

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

fn call_ytdlp(app: &AppHandle, args: &[String]) -> Result<String, String> {
    let ytdlp = resolve_ytdlp(app).ok_or_else(|| {
        "yt-dlp not found. Go to Settings to download it.".to_string()
    })?;

    let cookies = get_cookie_flags(app);
    let all_args: Vec<&str> = cookies.iter().map(|s| s.as_str()).chain(args.iter().map(|s| s.as_str())).collect();
    ProcessManager::run_simple(&ytdlp.to_string_lossy(), &all_args)
}

fn extract_channel_info(data: &Value) -> Option<ChannelInfo> {
    Some(ChannelInfo {
        id: data.get("channel_id")?.as_str()?.to_string(),
        title: data.get("channel")?.as_str()?.to_string(),
        description: data.get("description")?.as_str().unwrap_or("").to_string(),
        thumbnail: data.get("thumbnail")?.as_str()?.to_string(),
        subscriber_count: data.get("channel_follower_count").and_then(|v| v.as_i64()),
        video_count: data.get("channel_video_count").and_then(|v| v.as_i64()),
        channel_url: data.get("channel_url")?.as_str()?.to_string(),
    })
}

fn extract_video_from_entry(entry: &Value) -> Option<VideoItem> {
    let id = entry.get("id")?.as_str()?;
    let title = entry.get("title")?.as_str()?;

    Some(VideoItem {
        id: id.to_string(),
        title: title.to_string(),
        url: format!("https://www.youtube.com/watch?v={}", id),
        thumbnail: entry.get("thumbnail")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", id)),
        duration: entry.get("duration").and_then(|v| v.as_i64()),
        view_count: entry.get("view_count").and_then(|v| v.as_i64()),
        upload_date: entry.get("upload_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
        channel: entry.get("channel").and_then(|v| v.as_str())
            .or_else(|| entry.get("playlist_channel").and_then(|v| v.as_str()))
            .unwrap_or("").to_string(),
        channel_id: entry.get("channel_id").and_then(|v| v.as_str())
            .or_else(|| entry.get("playlist_channel_id").and_then(|v| v.as_str()))
            .unwrap_or("").to_string(),
    })
}

fn extract_videos(data: &Value) -> Vec<VideoItem> {
    if let Some(entries) = data.get("entries").and_then(|v| v.as_array()) {
        entries.iter().filter_map(extract_video_from_entry).collect()
    } else {
        if data.get("id").and_then(|v| v.as_str()).is_some() {
            extract_video_from_entry(data).into_iter().collect()
        } else {
            vec![]
        }
    }
}

fn extract_playlist_from_entry(entry: &Value) -> Option<PlaylistItem> {
    let id = entry.get("id")?.as_str()?;
    if !id.starts_with("PL") {
        return None;
    }

    Some(PlaylistItem {
        id: id.to_string(),
        title: entry.get("title")?.as_str()?.to_string(),
        url: format!("https://www.youtube.com/playlist?list={}", id),
        thumbnail: entry.get("thumbnail").and_then(|v| v.as_str()).map(|s| s.to_string()),
        video_count: entry.get("playlist_count").and_then(|v| v.as_i64()),
        upload_date: entry.get("modified_date").and_then(|v| v.as_str()).map(|s| s.to_string())
            .or_else(|| entry.get("upload_date").and_then(|v| v.as_str()).map(|s| s.to_string())),
        channel: entry.get("channel").and_then(|v| v.as_str())
            .or_else(|| entry.get("playlist_channel").and_then(|v| v.as_str()))
            .unwrap_or("").to_string(),
        channel_id: entry.get("channel_id").and_then(|v| v.as_str())
            .or_else(|| entry.get("playlist_channel_id").and_then(|v| v.as_str()))
            .unwrap_or("").to_string(),
        videos: None,
    })
}

fn extract_playlists(data: &Value) -> Vec<PlaylistItem> {
    if let Some(entries) = data.get("entries").and_then(|v| v.as_array()) {
        entries.iter().filter_map(extract_playlist_from_entry).collect()
    } else {
        if data.get("id").and_then(|v| v.as_str()).is_some() {
            extract_playlist_from_entry(data).into_iter().collect()
        } else {
            vec![]
        }
    }
}

#[tauri::command]
pub async fn fetch_channel_info(app: AppHandle, channel_url: String) -> Result<ChannelInfo, String> {
    let args = vec![
        "--dump-json".to_string(),
        "--playlist-end".to_string(),
        "1".to_string(),
        "--skip-download".to_string(),
        "--no-warnings".to_string(),
        channel_url,
    ];

    let output = call_ytdlp(&app, &args)?;

    let data: Value = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse channel data: {}", e))?;

    extract_channel_info(&data).ok_or_else(|| "Could not extract channel info".to_string())
}

#[tauri::command]
pub async fn fetch_channel_videos(app: AppHandle, channel_url: String, tab: String, limit: Option<i64>) -> Result<Vec<VideoItem>, String> {
    let mut args = vec![
        "--dump-json".to_string(),
        "--flat-playlist".to_string(),
        "--skip-download".to_string(),
        "--no-warnings".to_string(),
    ];

    if let Some(l) = limit {
        args.push("--playlist-end".to_string());
        args.push(l.to_string());
    }

    let url = match tab.as_str() {
        "shorts" => format!("{}/shorts", channel_url.trim_end_matches('/')),
        "streams" => format!("{}/streams", channel_url.trim_end_matches('/')),
        _ => format!("{}/videos", channel_url.trim_end_matches('/')),
    };
    args.push(url);

    let output = call_ytdlp(&app, &args)?;

    let mut videos = Vec::new();
    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(data) = serde_json::from_str::<Value>(line) {
            let mut items = extract_videos(&data);
            videos.append(&mut items);
        }
    }

    Ok(videos)
}

#[tauri::command]
pub async fn fetch_channel_playlists(app: AppHandle, channel_url: String) -> Result<Vec<PlaylistItem>, String> {
    let args = vec![
        "--dump-json".to_string(),
        "--flat-playlist".to_string(),
        "--skip-download".to_string(),
        "--no-warnings".to_string(),
        format!("{}/playlists", channel_url.trim_end_matches('/')),
    ];

    let output = call_ytdlp(&app, &args)?;

    let mut playlists = Vec::new();
    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(data) = serde_json::from_str::<Value>(line) {
            let mut items = extract_playlists(&data);
            playlists.append(&mut items);
        }
    }

    Ok(playlists)
}

#[tauri::command]
pub async fn fetch_playlist_videos(app: AppHandle, playlist_url: String) -> Result<Vec<VideoItem>, String> {
    let args = vec![
        "--dump-json".to_string(),
        "--flat-playlist".to_string(),
        "--skip-download".to_string(),
        "--no-warnings".to_string(),
        playlist_url,
    ];

    let output = call_ytdlp(&app, &args)?;

    let mut videos = Vec::new();
    for line in output.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(data) = serde_json::from_str::<Value>(line) {
            let mut items = extract_videos(&data);
            videos.append(&mut items);
        }
    }

    Ok(videos)
}

#[tauri::command]
pub async fn fetch_video_info(app: AppHandle, video_url: String) -> Result<VideoDetail, String> {
    let args = vec![
        "--dump-json".to_string(),
        "--no-warnings".to_string(),
        video_url,
    ];

    let output = call_ytdlp(&app, &args)?;

    let data: Value = serde_json::from_str(&output)
        .map_err(|e| format!("Failed to parse video data: {}", e))?;

    let formats = data.get("formats")
        .and_then(|f| f.as_array())
        .map(|arr| {
            arr.iter().filter_map(|f| {
                Some(FormatInfo {
                    format_id: f.get("format_id")?.as_str()?.to_string(),
                    ext: f.get("ext")?.as_str()?.to_string(),
                    resolution: f.get("resolution").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    filesize: f.get("filesize").and_then(|v| v.as_i64()),
                    vcodec: f.get("vcodec").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    acodec: f.get("acodec").and_then(|v| v.as_str()).map(|s| s.to_string()),
                    tbr: f.get("tbr").and_then(|v| v.as_f64()),
                    fps: f.get("fps").and_then(|v| v.as_i64()),
                    height: f.get("height").and_then(|v| v.as_i64()),
                    width: f.get("width").and_then(|v| v.as_i64()),
                })
            }).collect::<Vec<_>>()
        }).unwrap_or_default();

    let subtitles = data.get("subtitles")
        .and_then(|s| s.as_object())
        .map(|obj| obj.keys().cloned().collect::<Vec<_>>())
        .unwrap_or_default();

    Ok(VideoDetail {
        id: data.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        title: data.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        url: data.get("webpage_url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        thumbnail: data.get("thumbnail").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        duration: data.get("duration").and_then(|v| v.as_i64()),
        view_count: data.get("view_count").and_then(|v| v.as_i64()),
        like_count: data.get("like_count").and_then(|v| v.as_i64()),
        upload_date: data.get("upload_date").and_then(|v| v.as_str()).map(|s| s.to_string()),
        description: data.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        channel: data.get("channel").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        channel_id: data.get("channel_id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        formats,
        subtitles,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_entry(id: &str, title: &str) -> Value {
        json!({
            "id": id,
            "title": title,
            "duration": 120,
            "view_count": 5000,
            "upload_date": "20240115",
            "channel": "TestChannel",
            "channel_id": "UCtest123",
            "channel_follower_count": 10000,
            "channel_video_count": 50,
            "channel_url": "https://youtube.com/@test",
            "thumbnail": "https://i.ytimg.com/vi/test/hqdefault.jpg",
            "description": "A test video",
            "webpage_url": format!("https://youtube.com/watch?v={}", id),
            "formats": [],
            "subtitles": {}
        })
    }

    #[test]
    fn test_extract_channel_info() {
        let data = json!({
            "channel_id": "UCtest123",
            "channel": "TestChannel",
            "description": "A test channel",
            "thumbnail": "https://i.ytimg.com/vi/test/hqdefault.jpg",
            "channel_follower_count": 10000,
            "channel_video_count": 50,
            "channel_url": "https://youtube.com/@test"
        });
        let info = extract_channel_info(&data).unwrap();
        assert_eq!(info.id, "UCtest123");
        assert_eq!(info.title, "TestChannel");
        assert_eq!(info.subscriber_count, Some(10000));
        assert_eq!(info.video_count, Some(50));
    }

    #[test]
    fn test_extract_channel_info_missing_fields() {
        let data = json!({});
        assert!(extract_channel_info(&data).is_none());
    }

    #[test]
    fn test_extract_videos_empty() {
        let data = json!({});
        let videos = extract_videos(&data);
        assert!(videos.is_empty());
    }

    #[test]
    fn test_extract_videos_with_entries() {
        let data = json!({
            "entries": [
                sample_entry("vid1", "First Video"),
                sample_entry("vid2", "Second Video"),
                sample_entry("vid3", "Third Video"),
            ]
        });
        let videos = extract_videos(&data);
        assert_eq!(videos.len(), 3);
        assert_eq!(videos[0].id, "vid1");
        assert_eq!(videos[1].title, "Second Video");
        assert_eq!(videos[2].duration, Some(120));
    }

    #[test]
    fn test_extract_videos_with_missing_data() {
        let data = json!({
            "entries": [
                {"id": "ok1", "title": "Good"},
                {"id": "ok2"},
                {"title": "no_id"},
            ]
        });
        let videos = extract_videos(&data);
        assert_eq!(videos.len(), 1);
        assert_eq!(videos[0].id, "ok1");
    }

    #[test]
    fn test_extract_playlists_filters_non_playlist() {
        let data = json!({
            "entries": [
                {"id": "PLabc123", "title": "Real Playlist", "playlist_count": 10},
                {"id": "UUxxx", "title": "Uploads (not a playlist)", "playlist_count": 50},
                {"id": "FLxxx", "title": "Favorites", "playlist_count": 5},
            ]
        });
        let playlists = extract_playlists(&data);
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].id, "PLabc123");
        assert_eq!(playlists[0].title, "Real Playlist");
        assert_eq!(playlists[0].video_count, Some(10));
    }

    #[test]
    fn test_extract_playlists_empty() {
        let data = json!({});
        let playlists = extract_playlists(&data);
        assert!(playlists.is_empty());
    }

    #[test]
    fn test_video_item_url_format() {
        let data = json!({
            "entries": [
                {"id": "dQw4w9WgXcQ", "title": "Rick Roll"}
            ]
        });
        let videos = extract_videos(&data);
        assert_eq!(videos[0].url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        assert_eq!(videos[0].thumbnail, "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    }

    #[test]
    fn test_extract_videos_flat_format() {
        let data = json!({
            "id": "vid1",
            "title": "Flat Video",
            "playlist_channel": "TestChannel",
            "playlist_channel_id": "UCtest123",
        });
        let videos = extract_videos(&data);
        assert_eq!(videos.len(), 1);
        assert_eq!(videos[0].id, "vid1");
        assert_eq!(videos[0].channel, "TestChannel");
    }

    #[test]
    fn test_extract_playlists_flat_format() {
        let data = json!({
            "id": "PLabc123",
            "title": "Flat Playlist",
            "playlist_count": 5,
        });
        let playlists = extract_playlists(&data);
        assert_eq!(playlists.len(), 1);
        assert_eq!(playlists[0].id, "PLabc123");
    }
}
