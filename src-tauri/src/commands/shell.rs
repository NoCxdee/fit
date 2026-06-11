// ================================================================
// Fit — Shell Detector
// Detect available shells on the system (Windows-focused).
// ================================================================

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
pub struct ShellInfo {
    pub shell_type: String,
    pub name: String,
    pub path: String,
    pub available: bool,
}

/// Detect which shells are available on the system.
#[tauri::command]
pub fn detect_shells() -> Vec<ShellInfo> {
    let mut shells = Vec::new();

    #[cfg(target_os = "windows")]
    {
        // PowerShell 7+ (pwsh)
        let pwsh_paths = [
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            r"C:\Program Files (x86)\PowerShell\7\pwsh.exe",
        ];
        let pwsh_available = pwsh_paths.iter().any(|p| Path::new(p).exists());
        shells.push(ShellInfo {
            shell_type: "powershell-core".to_string(),
            name: "PowerShell 7".to_string(),
            path: if pwsh_available {
                pwsh_paths.iter().find(|p| Path::new(p).exists()).unwrap_or(&"pwsh.exe").to_string()
            } else {
                "pwsh.exe".to_string()
            },
            available: pwsh_available,
        });

        // Windows PowerShell 5.1
        let ps_path = r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe";
        shells.push(ShellInfo {
            shell_type: "powershell".to_string(),
            name: "Windows PowerShell".to_string(),
            path: ps_path.to_string(),
            available: Path::new(ps_path).exists(),
        });

        // CMD
        let cmd_path = r"C:\Windows\System32\cmd.exe";
        shells.push(ShellInfo {
            shell_type: "cmd".to_string(),
            name: "Command Prompt".to_string(),
            path: cmd_path.to_string(),
            available: Path::new(cmd_path).exists(),
        });

        // WSL
        let wsl_path = r"C:\Windows\System32\wsl.exe";
        shells.push(ShellInfo {
            shell_type: "wsl".to_string(),
            name: "WSL".to_string(),
            path: wsl_path.to_string(),
            available: Path::new(wsl_path).exists(),
        });

        // Git Bash
        let git_bash_paths = [
            r"C:\Program Files\Git\bin\bash.exe",
            r"C:\Program Files (x86)\Git\bin\bash.exe",
        ];
        let git_bash_available = git_bash_paths.iter().any(|p| Path::new(p).exists());
        shells.push(ShellInfo {
            shell_type: "git-bash".to_string(),
            name: "Git Bash".to_string(),
            path: if git_bash_available {
                git_bash_paths.iter().find(|p| Path::new(p).exists()).unwrap_or(&"bash.exe").to_string()
            } else {
                "bash.exe".to_string()
            },
            available: git_bash_available,
        });
    }

    #[cfg(not(target_os = "windows"))]
    {
        let common_shells = [
            ("zsh", "Zsh", "/bin/zsh"),
            ("bash", "Bash", "/bin/bash"),
            ("sh", "Sh", "/bin/sh"),
            ("fish", "Fish", "/opt/homebrew/bin/fish"),
        ];

        for (shell_type, name, default_path) in common_shells {
            let mut path = default_path.to_string();
            let mut available = Path::new(&path).exists();

            if !available && shell_type == "fish" {
                let intel_fish = "/usr/local/bin/fish";
                if Path::new(intel_fish).exists() {
                    path = intel_fish.to_string();
                    available = true;
                }
            } else if !available && shell_type == "bash" {
                let opt_bash = "/opt/homebrew/bin/bash";
                if Path::new(opt_bash).exists() {
                    path = opt_bash.to_string();
                    available = true;
                }
            }

            shells.push(ShellInfo {
                shell_type: shell_type.to_string(),
                name: name.to_string(),
                path,
                available,
            });
        }
    }

    shells
}

/// Relaunch the application.
#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    app.restart();
}

