// ================================================================
// Fit — Tauri Application Entry Point
// Wires up all IPC commands, plugins, and managed state.
// ================================================================

mod commands;

use commands::pty::PtyManager;
use std::sync::Arc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_manager = Arc::new(PtyManager::new());

    tauri::Builder::default()
        .manage(pty_manager)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Filesystem
            commands::filesystem::read_dir,
            commands::filesystem::read_file,
            commands::filesystem::write_file,
            commands::filesystem::create_file,
            commands::filesystem::create_dir,
            commands::filesystem::search_files,
            // PTY
            commands::pty::pty_spawn,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_kill,
            // Ports
            commands::ports::scan_ports,
            // Shell
            commands::shell::detect_shells,
            // State
            commands::state::load_state,
            commands::state::save_state,
            // Git
            commands::git::git_status,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_stage_all,
            commands::git::git_unstage_all,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_show_file,
            commands::git::git_discard_file,
            commands::clipboard::get_clipboard_files,
            // Speech
            commands::speech::get_model_status,
            commands::speech::download_model,
            commands::speech::delete_model,
            commands::speech::load_model,
            commands::speech::unload_model,
            commands::speech::set_system_mute,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fit");
}
