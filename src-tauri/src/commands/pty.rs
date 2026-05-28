// ================================================================
// Fit — PTY Manager
// Spawn and manage pseudo-terminal sessions via portable-pty.
// ================================================================

use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
pub struct PtyOutputEvent {
    pub pty_id: String,
    pub data: String,
}

/// Holds all active PTY sessions.
pub struct PtyManager {
    sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

struct PtySession {
    writer: Box<dyn Write + Send>,
    pair: portable_pty::PtyPair,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn spawn(
        &self,
        pty_id: String,
        shell: String,
        cwd: String,
        cols: u16,
        rows: u16,
        app: AppHandle,
    ) -> Result<(), String> {
        let pty_system = NativePtySystem::default();

        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(&shell);
        cmd.cwd(&cwd);

        // Suppress PowerShell banner and enable prediction history inline if supported by PSReadLine
        if shell.contains("powershell") || shell.contains("pwsh") {
            cmd.arg("-NoLogo");
            cmd.arg("-NoExit");
            cmd.arg("-Command");
            cmd.arg("if ((Get-Command Set-PSReadLineOption -ErrorAction SilentlyContinue).Parameters.ContainsKey('PredictionSource')) { Set-PSReadLineOption -PredictionSource History }");
        }

        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take writer: {}", e))?;

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone reader: {}", e))?;

        // Spawn reader thread that sends output to the frontend
        let pty_id_clone = pty_id.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = app.emit(
                            "pty-output",
                            PtyOutputEvent {
                                pty_id: pty_id_clone.clone(),
                                data,
                            },
                        );
                    }
                    Err(_) => break,
                }
            }
        });

        let session = PtySession {
            writer,
            pair,
        };

        self.sessions
            .lock()
            .map_err(|e| e.to_string())?
            .insert(pty_id, session);

        Ok(())
    }

    pub fn write(&self, pty_id: &str, data: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get_mut(pty_id)
            .ok_or_else(|| format!("PTY not found: {}", pty_id))?;
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session.writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn resize(&self, pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        let session = sessions
            .get(pty_id)
            .ok_or_else(|| format!("PTY not found: {}", pty_id))?;
        session
            .pair
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    }

    pub fn kill(&self, pty_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
        sessions.remove(pty_id);
        Ok(())
    }
}

// ── Tauri Commands ───────────────────────────────────────────────

#[tauri::command]
pub fn pty_spawn(
    pty_id: String,
    shell: String,
    cwd: String,
    cols: u16,
    rows: u16,
    app: AppHandle,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    // Resolve shell short-name to absolute path on Windows to avoid spawning errors
    let resolved_shell = match shell.as_str() {
        "powershell" => r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe".to_string(),
        "powershell-core" => {
            let pwsh_paths = [
                r"C:\Program Files\PowerShell\7\pwsh.exe",
                r"C:\Program Files (x86)\PowerShell\7\pwsh.exe",
            ];
            pwsh_paths.iter()
                .find(|p| std::path::Path::new(p).exists())
                .map(|p| p.to_string())
                .unwrap_or_else(|| r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe".to_string())
        }
        "cmd" => r"C:\Windows\System32\cmd.exe".to_string(),
        "wsl" => r"C:\Windows\System32\wsl.exe".to_string(),
        "git-bash" => {
            let git_bash_paths = [
                r"C:\Program Files\Git\bin\bash.exe",
                r"C:\Program Files (x86)\Git\bin\bash.exe",
            ];
            git_bash_paths.iter()
                .find(|p| std::path::Path::new(p).exists())
                .map(|p| p.to_string())
                .unwrap_or_else(|| "bash.exe".to_string())
        }
        _ => shell,
    };
    state.spawn(pty_id, resolved_shell, cwd, cols, rows, app)
}

#[tauri::command]
pub fn pty_write(
    pty_id: String,
    data: String,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    state.write(&pty_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    pty_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    state.resize(&pty_id, cols, rows)
}

#[tauri::command]
pub fn pty_kill(
    pty_id: String,
    state: tauri::State<'_, Arc<PtyManager>>,
) -> Result<(), String> {
    state.kill(&pty_id)
}
