// ================================================================
// Fit — Git / Source Control Commands
// Run local Git operations and return repo status.
// ================================================================

use serde::Serialize;
use std::path::Path;
use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitCommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusResult {
    pub is_repo: bool,
    pub branch: String,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub ahead_commits: Vec<GitCommitInfo>,
}

fn run_git_cmd(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd);
    cmd.args(args);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Failed to run git: {}", e))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if err_msg.is_empty() {
            Err(format!("Git exit code: {}", output.status.code().unwrap_or(-1)))
        } else {
            Err(err_msg)
        }
    }
}

/// Like run_git_cmd but preserves file content faithfully without trimming.
/// Only strips a single trailing newline that git adds to stdout output.
fn run_git_cmd_raw(cwd: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(cwd);
    cmd.args(args);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| format!("Failed to run git: {}", e))?;
    if output.status.success() {
        let content = String::from_utf8_lossy(&output.stdout).to_string();
        // Strip only the final trailing newline that git adds to stdout,
        // but preserve the actual file content (including trailing blank lines).
        Ok(content.strip_suffix("\n").unwrap_or(&content).to_string())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if err_msg.is_empty() {
            Err(format!("Git exit code: {}", output.status.code().unwrap_or(-1)))
        } else {
            Err(err_msg)
        }
    }
}

fn clean_path(p: &str) -> String {
    let mut s = p.trim().to_string();
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s.remove(0);
        s.pop();
    }
    s
}

fn map_status_char(c: char) -> &'static str {
    match c {
        'M' => "modified",
        'A' => "added",
        'D' => "deleted",
        'R' => "renamed",
        'C' => "copied",
        'U' => "unmerged",
        '?' => "untracked",
        _ => "modified",
    }
}

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    // 1. Check if it's inside a work tree
    let is_repo_check = run_git_cmd(&path, &["rev-parse", "--is-inside-work-tree"]);
    let is_repo = match is_repo_check {
        Ok(val) => val == "true",
        Err(_) => false,
    };

    if !is_repo {
        return Ok(GitStatusResult {
            is_repo: false,
            branch: "".to_string(),
            staged: Vec::new(),
            unstaged: Vec::new(),
            ahead_commits: Vec::new(),
        });
    }

    // 2. Get current branch name
    let branch = run_git_cmd(&path, &["branch", "--show-current"])
        .unwrap_or_else(|_| "".to_string());
    let branch = if branch.is_empty() {
        run_git_cmd(&path, &["rev-parse", "--abbrev-ref", "HEAD"])
            .unwrap_or_else(|_| "HEAD".to_string())
    } else {
        branch
    };

    // 3. Get porcelain status
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();

    if let Ok(porcelain) = run_git_cmd_raw(&path, &["status", "--porcelain", "-u"]) {
        for line in porcelain.lines() {
            if line.len() < 4 {
                continue;
            }
            let x = line.chars().nth(0).unwrap_or(' ');
            let y = line.chars().nth(1).unwrap_or(' ');
            let path_part = line[2..].trim();
            let clean_p = clean_path(path_part);

            // Handle rename: "old_path -> new_path"
            let (display_path, display_name) = if clean_p.contains(" -> ") {
                let parts: Vec<&str> = clean_p.split(" -> ").collect();
                if parts.len() == 2 {
                    let old_p = clean_path(parts[0]);
                    let new_p = clean_path(parts[1]);
                    let old_name = Path::new(&old_p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| old_p.clone());
                    let new_name = Path::new(&new_p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| new_p.clone());
                    (new_p, format!("{} -> {}", old_name, new_name))
                } else {
                    (clean_p.clone(), clean_p.clone())
                }
            } else {
                let name = Path::new(&clean_p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| clean_p.clone());
                (clean_p, name)
            };

            // If X is staged (not space, not ? or !)
            if x != ' ' && x != '?' && x != '!' {
                staged.push(GitFileStatus {
                    path: display_path.clone(),
                    name: display_name.clone(),
                    status: map_status_char(x).to_string(),
                });
            }

            // If Y is unstaged (not space, not !) OR if it's untracked (X='?', Y='?')
            if (y != ' ' && y != '!') || (x == '?' && y == '?') {
                let status_char = if x == '?' && y == '?' { '?' } else { y };
                unstaged.push(GitFileStatus {
                    path: display_path,
                    name: display_name,
                    status: map_status_char(status_char).to_string(),
                });
            }
        }
    }

    // 4. Get ahead commits (waiting for push)
    let mut ahead_commits = Vec::new();
    
    // Check if HEAD and upstream exist
    let head_exists = run_git_cmd(&path, &["rev-parse", "HEAD"]).is_ok();
    let has_upstream = run_git_cmd(&path, &["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).is_ok();

    if head_exists && has_upstream {
        if let Ok(log_out) = run_git_cmd(
            &path,
            &["log", "@{u}..HEAD", "--pretty=format:%h|%s|%an|%ad", "--date=short"]
        ) {
            for line in log_out.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() >= 4 {
                    ahead_commits.push(GitCommitInfo {
                        hash: parts[0].to_string(),
                        message: parts[1].to_string(),
                        author: parts[2].to_string(),
                        date: parts[3].to_string(),
                    });
                }
            }
        }
    }

    Ok(GitStatusResult {
        is_repo: true,
        branch,
        staged,
        unstaged,
        ahead_commits,
    })
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn git_stage(path: String, filePath: String) -> Result<(), String> {
    run_git_cmd(&path, &["add", "--", &filePath]).map(|_| ())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn git_unstage(path: String, filePath: String) -> Result<(), String> {
    run_git_cmd(&path, &["reset", "HEAD", "--", &filePath]).map(|_| ())
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    run_git_cmd(&path, &["add", "-A"]).map(|_| ())
}

#[tauri::command]
pub fn git_unstage_all(path: String) -> Result<(), String> {
    run_git_cmd(&path, &["reset", "HEAD"]).map(|_| ())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }
    run_git_cmd(&path, &["commit", "-m", &message]).map(|_| ())
}

#[tauri::command]
pub fn git_push(path: String) -> Result<(), String> {
    run_git_cmd(&path, &["push"]).map(|_| ())
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<(), String> {
    run_git_cmd(&path, &["pull"]).map(|_| ())
}

#[tauri::command]
pub fn git_fetch(path: String) -> Result<(), String> {
    run_git_cmd(&path, &["fetch"]).map(|_| ())
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn git_show_file(path: String, filePath: String, gitRef: Option<String>) -> Result<String, String> {
    let clean_path = filePath.replace('\\', "/");
    let ref_name = gitRef.unwrap_or_else(|| "HEAD".to_string());

    if ref_name == "index" {
        // Fetch from staging area (git show :file)
        let target = format!(":{}", clean_path);
        match run_git_cmd_raw(&path, &["show", &target]) {
            Ok(content) => Ok(content),
            Err(_) => {
                // Fallback to HEAD if not in index
                let head_target = format!("HEAD:{}", clean_path);
                match run_git_cmd_raw(&path, &["show", &head_target]) {
                    Ok(content) => Ok(content),
                    Err(_) => Ok("".to_string()),
                }
            }
        }
    } else {
        // Fetch from a specific ref (default: HEAD)
        let target = format!("{}:{}", ref_name, clean_path);
        match run_git_cmd_raw(&path, &["show", &target]) {
            Ok(content) => Ok(content),
            Err(_) => Ok("".to_string()),
        }
    }
}

#[tauri::command]
#[allow(non_snake_case)]
pub fn git_discard_file(path: String, filePath: String) -> Result<(), String> {
    // Check if the file is tracked
    let is_tracked = run_git_cmd(&path, &["ls-files", "--error-unmatch", &filePath]).is_ok();
    
    if is_tracked {
        // Tracked file: checkout to discard modifications
        run_git_cmd(&path, &["checkout", "--", &filePath]).map(|_| ())
    } else {
        // Untracked file: remove it from filesystem
        let abs_path = Path::new(&path).join(&filePath);
        if abs_path.exists() {
            if abs_path.is_dir() {
                std::fs::remove_dir_all(&abs_path)
                    .map_err(|e| format!("Failed to remove directory: {}", e))?;
            } else {
                std::fs::remove_file(&abs_path)
                    .map_err(|e| format!("Failed to remove file: {}", e))?;
            }
        }
        Ok(())
    }
}
