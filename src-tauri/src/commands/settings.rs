use std::collections::HashMap;
use tauri::State;
use std::sync::Mutex;

pub struct SettingsState {
    pub settings: Mutex<HashMap<String, String>>,
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, SettingsState>,
) -> Result<HashMap<String, String>, String> {
    let settings = state.settings.lock().map_err(|e| e.to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn update_setting(
    key: String,
    value: String,
    state: State<'_, SettingsState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|e| e.to_string())?;
    settings.insert(key, value);
    Ok(())
}
