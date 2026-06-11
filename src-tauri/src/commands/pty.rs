// ================================================================
// Fit — PTY Manager
// Spawn and manage pseudo-terminal sessions via portable-pty.
// ================================================================

use portable_pty::{Child, CommandBuilder, NativePtySystem, PtySize, PtySystem};
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
    child: Box<dyn Child + Send + 'static>,
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
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Suppress PowerShell banner, force UTF-8 console encoding, and disable PSReadLine
        // inline history prediction. Prediction re-renders the prompt on every keystroke
        // and races with the user's own character echo coming back over the PTY, which
        // makes the typed text visually splice into the middle of the prompt in xterm.js
        // (classic symptom: `PS C:\Users\` + typed chars + `Fit>`). We keep PSReadLine
        // active (syntax highlighting, multi-line editing) but force its render to be
        // synchronous and non-predictive, and require a full redraw on each prompt to
        // avoid stale buffer fragments.
        if shell.contains("powershell") || shell.contains("pwsh") {
            cmd.arg("-NoLogo");
            cmd.arg("-NoExit");
            cmd.arg("-Command");
            cmd.arg("[Console]::InputEncoding = [System.Text.Encoding]::UTF8; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 > $null; if (Get-Module -ListAvailable PSReadLine) { Import-Module PSReadLine; Set-PSReadLineOption -PredictionSource None; Set-PSReadLineOption -EditMode Windows; Set-PSReadLineOption -BellStyle None; Set-PSReadLineOption -MaximumHistoryCount 4000 }; function global:prompt { \"$PWD> \" }");
        } else if shell.contains("cmd.exe") || shell.ends_with("cmd") {
            cmd.arg("/K");
            cmd.arg("chcp 65001 > nul");
        }

        // On Unix/macOS, spawn standard shells as login shells to ensure ~/.zprofile,
        // ~/.bash_profile, etc., are loaded, resolving missing PATH variables (e.g. command not found for npm/npx).
        #[cfg(unix)]
        {
            let shell_lower = shell.to_lowercase();
            if shell_lower.contains("zsh")
                || shell_lower.contains("bash")
                || shell_lower.contains("sh")
                || shell_lower.contains("fish")
            {
                cmd.arg("-l");
            }
        }

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command: {}", e))?;

        #[allow(unused_mut)]
        let mut writer = pair
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
            let mut leftover = Vec::with_capacity(4100);
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        if !leftover.is_empty() {
                            let data = String::from_utf8_lossy(&leftover).to_string();
                            let _ = app.emit(
                                "pty-output",
                                PtyOutputEvent {
                                    pty_id: pty_id_clone.clone(),
                                    data,
                                },
                            );
                        }
                        break;
                    }
                    Ok(n) => {
                        leftover.extend_from_slice(&buf[..n]);
                        let mut search_start = 0;
                        
                        while search_start < leftover.len() {
                            match std::str::from_utf8(&leftover[search_start..]) {
                                Ok(s) => {
                                    let _ = app.emit(
                                        "pty-output",
                                        PtyOutputEvent {
                                            pty_id: pty_id_clone.clone(),
                                            data: s.to_string(),
                                        },
                                    );
                                    search_start = leftover.len();
                                }
                                Err(e) => {
                                    let valid_up_to = e.valid_up_to();
                                    if valid_up_to > 0 {
                                        let valid_str = std::str::from_utf8(&leftover[search_start..search_start + valid_up_to]).unwrap();
                                        let _ = app.emit(
                                            "pty-output",
                                            PtyOutputEvent {
                                                pty_id: pty_id_clone.clone(),
                                                data: valid_str.to_string(),
                                            },
                                        );
                                        search_start += valid_up_to;
                                    }
                                    
                                    if let Some(error_len) = e.error_len() {
                                        let _ = app.emit(
                                            "pty-output",
                                            PtyOutputEvent {
                                                pty_id: pty_id_clone.clone(),
                                                data: "\u{FFFD}".to_string(),
                                            },
                                        );
                                        search_start += error_len;
                                    } else {
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if search_start > 0 {
                            leftover.drain(0..search_start);
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        let session = PtySession {
            writer,
            pair,
            child,
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
        // Remove the session from the map, then explicitly kill the child
        // process so it does not outlive the PTY. The child kill/wait runs
        // outside the lock to avoid deadlocking other PTY operations.
        let removed = {
            let mut sessions = self.sessions.lock().map_err(|e| e.to_string())?;
            sessions.remove(pty_id)
        };
        if let Some(mut session) = removed {
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
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
    // If a PTY already exists for this id (e.g. after a grid restructure
    // that reused terminal ids), just resize the existing session instead
    // of killing and re-spawning the child process.
    let already_exists = {
        let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.contains_key(&pty_id)
    };
    if already_exists {
        return state.resize(&pty_id, cols, rows);
    }

    // Resolve shell short-name to absolute path on Windows to avoid spawning errors
    let resolved_shell = if cfg!(target_os = "windows") {
        match shell.as_str() {
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
        }
    } else {
        // Non-Windows platforms
        let is_windows_shell = matches!(
            shell.as_str(),
            "powershell" | "powershell-core" | "cmd" | "wsl" | "git-bash"
        );
        if is_windows_shell || shell.is_empty() {
            std::env::var("SHELL").unwrap_or_else(|_| {
                if std::path::Path::new("/bin/zsh").exists() {
                    "/bin/zsh".to_string()
                } else if std::path::Path::new("/bin/bash").exists() {
                    "/bin/bash".to_string()
                } else {
                    "/bin/sh".to_string()
                }
            })
        } else {
            shell
        }
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
