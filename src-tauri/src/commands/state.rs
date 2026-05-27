// ================================================================
// Fit — State Persistence
// Load/save app state as JSON in %APPDATA%/fit/state.json
// ================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_opened: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalConfig {
    pub id: String,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub terminals: Vec<TerminalConfig>,
    pub split_direction: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: String,
    #[serde(rename = "type")]
    pub tab_type: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub workspaces: Vec<Workspace>,
    pub active_workspace_id: Option<String>,
    pub sessions: Vec<Session>,
    pub active_session_id: Option<String>,
    pub open_tabs: Vec<Tab>,
    pub active_tab_id: Option<String>,
    pub file_drawer_open: bool,
}

/// Get the path to the state file.
fn state_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let fit_dir = app_data.join("fit");
    fs::create_dir_all(&fit_dir).ok();
    fit_dir.join("state.json")
}

/// Load state from disk. Returns default state if file doesn't exist.
#[tauri::command]
pub fn load_state() -> AppState {
    let path = state_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppState::default(),
    }
}

/// Save state to disk.
#[tauri::command]
pub fn save_state(state: AppState) -> Result<(), String> {
    let path = state_path();
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to save state: {}", e))
}
