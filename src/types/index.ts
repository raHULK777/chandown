export interface ChannelInfo {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriber_count: number | null
  video_count: number | null
  channel_url: string
}

export interface VideoItem {
  id: string
  title: string
  url: string
  thumbnail: string
  duration: number | null
  view_count: number | null
  upload_date: string | null
  channel: string
  channel_id: string
}

export interface PlaylistItem {
  id: string
  title: string
  url: string
  thumbnail: string | null
  video_count: number | null
  upload_date: string | null
  channel: string
  channel_id: string
  videos: VideoItem[] | null
}

export interface FormatInfo {
  format_id: string
  ext: string
  resolution: string | null
  filesize: number | null
  vcodec: string | null
  acodec: string | null
  tbr: number | null
  fps: number | null
  height: number | null
  width: number | null
}

export interface VideoDetail {
  id: string
  title: string
  url: string
  thumbnail: string
  duration: number | null
  view_count: number | null
  like_count: number | null
  upload_date: string | null
  description: string
  channel: string
  channel_id: string
  formats: FormatInfo[]
  subtitles: string[]
}

export type DownloadStatus = "Queued" | "Downloading" | "Paused" | "Completed" | "Failed" | "Cancelled"

export interface DownloadItem {
  id: string
  url: string
  title: string
  format_id: string
  output_path: string
  video_format: string | null
  audio_only: boolean
  audio_format: string | null
  audio_quality: string | null
  status: DownloadStatus
  progress: number
  speed: string | null
  eta: string | null
  filesize: number | null
  downloaded_bytes: number | null
  error: string | null
  queued_at: string
  file_path: string | null
}

export interface DownloadRequest {
  url: string
  title: string
  format_id: string
  output_path: string
  quality: string
  audio_only: boolean
  audio_format: string | null
  audio_quality: string | null
  video_format: string | null
  filesize: number | null
}

export interface QueueState {
  items: DownloadItem[]
  active_count: number
  max_concurrent: number
}
