use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChannelInfo {
    pub id: String,
    pub title: String,
    pub description: String,
    pub thumbnail: String,
    pub subscriber_count: Option<i64>,
    pub video_count: Option<i64>,
    pub channel_url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub duration: Option<i64>,
    pub view_count: Option<i64>,
    pub upload_date: Option<String>,
    pub channel: String,
    pub channel_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistItem {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: Option<String>,
    pub video_count: Option<i64>,
    pub upload_date: Option<String>,
    pub channel: String,
    pub channel_id: String,
    pub videos: Option<Vec<VideoItem>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FormatInfo {
    pub format_id: String,
    pub ext: String,
    pub resolution: Option<String>,
    pub filesize: Option<i64>,
    pub vcodec: Option<String>,
    pub acodec: Option<String>,
    pub tbr: Option<f64>,
    pub fps: Option<i64>,
    pub height: Option<i64>,
    pub width: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoDetail {
    pub id: String,
    pub title: String,
    pub url: String,
    pub thumbnail: String,
    pub duration: Option<i64>,
    pub view_count: Option<i64>,
    pub like_count: Option<i64>,
    pub upload_date: Option<String>,
    pub description: String,
    pub channel: String,
    pub channel_id: String,
    pub formats: Vec<FormatInfo>,
    pub subtitles: Vec<String>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChannelFetchResult {
    pub channel: ChannelInfo,
    pub videos: Vec<VideoItem>,
    pub shorts: Vec<VideoItem>,
    pub streams: Vec<VideoItem>,
    pub playlists: Vec<PlaylistItem>,
}
