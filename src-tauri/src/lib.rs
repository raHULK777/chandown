mod commands;
mod models;
mod process;
mod queue;
mod db;

use commands::download::DownloadState;
use commands::settings::SettingsState;
use queue::manager::QueueManager;
use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::Mutex as TokioMutex;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_process::init())

    .manage(DownloadState {
      queue: Arc::new(TokioMutex::new(QueueManager::new(3))),
      processes: Arc::new(TokioMutex::new(HashMap::new())),
    })
    .manage(SettingsState {
      settings: Mutex::new(HashMap::new()),
    })
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      db::init(app.handle())?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::system::check_tools,
      commands::system::ensure_ytdlp,
      commands::system::ensure_ffmpeg,
      commands::system::update_ytdlp,
      commands::system::get_ytdlp_version,
      commands::system::get_ffmpeg_version,
      commands::channel::fetch_channel_info,
      commands::channel::fetch_channel_videos,
      commands::channel::fetch_channel_playlists,
      commands::channel::fetch_video_info,
      commands::channel::fetch_playlist_videos,
      commands::download::start_download,
      commands::download::cancel_download,
      commands::download::pause_download,
      commands::download::resume_download,
      commands::download::get_queue,
      commands::download::clear_queue,
      commands::settings::get_settings,
      commands::settings::update_setting,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
