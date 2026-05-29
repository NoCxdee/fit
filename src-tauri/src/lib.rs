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

            // Create main window programmatically to inject script into all frames globally
            let win_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::default(),
            )
            .title("Fit")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .decorations(false)
            .center()
            .initialization_script_for_all_frames(r#"
                if (typeof window !== 'undefined') {
                  if (window.self !== window.top) {
                    console.log('[FIT DEBUG Global] Inspector script loaded inside iframe.');
                    
                    let active = false;

                    const overHandler = (e) => {
                      if (!active) return;
                      e.stopPropagation();
                      e.target.classList.add('fit-inspector-hover');
                    };

                    const outHandler = (e) => {
                      if (!active) return;
                      e.target.classList.remove('fit-inspector-hover');
                    };

                    const clickHandler = (e) => {
                      if (!active) return;
                      e.preventDefault();
                      e.stopPropagation();

                      const target = e.target;
                      const data = target.outerHTML;

                      target.classList.remove('fit-inspector-hover');
                      window.parent.postMessage({ type: 'FIT_INSPECTOR_CAPTURED', payload: data }, '*');
                      active = false;
                      document.querySelectorAll('.fit-inspector-hover').forEach(el => el.classList.remove('fit-inspector-hover'));
                    };

                    const init = () => {
                      console.log('[FIT DEBUG Global] DOMContentLoaded. Initializing style and listeners.');
                      const style = document.createElement('style');
                      style.innerHTML = `
                        .fit-inspector-hover {
                          outline: 2px dashed #d4a857 !important;
                          outline-offset: -2px !important;
                          background-color: rgba(212, 168, 87, 0.2) !important;
                          cursor: crosshair !important;
                        }
                      `;
                      document.head.appendChild(style);

                      document.body.addEventListener('mouseover', overHandler, true);
                      document.body.addEventListener('mouseout', outHandler, true);
                      document.body.addEventListener('click', clickHandler, true);
                    };

                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', init);
                    } else {
                      init();
                    }

                    window.addEventListener('message', (e) => {
                      if (e.data && e.data.type === 'FIT_TOGGLE_INSPECTOR') {
                        active = e.data.payload;
                        if (!active) {
                          document.querySelectorAll('.fit-inspector-hover').forEach(el => el.classList.remove('fit-inspector-hover'));
                        }
                      }
                    });

                    // Send ready signal to parent
                    window.parent.postMessage({ type: 'FIT_INSPECTOR_READY' }, '*');
                  }
                }
            "#);

            win_builder.build()?;

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
