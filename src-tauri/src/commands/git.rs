// ================================================================
// Fit — Git / Source Control Commands
// Run local Git operations and return repo status.
// Optimized: single `git status --porcelain=v2 --branch -u` call
// with parallel `git log` for ahead commits.
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
    pub additions: Option<u32>,
    pub deletions: Option<u32>,
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
    pub hash: String,
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

/// Compute a simple FNV-1a hash of a string, returned as 16-char hex.
fn fnv_hash(data: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in data.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{:016x}", hash)
}

fn get_numstats(cwd: &str, cached: bool) -> HashMap<String, (u32, u32)> {
    let mut stats = HashMap::new();
    let args = if cached {
        vec!["diff", "--cached", "--numstat"]
    } else {
        vec!["diff", "--numstat"]
    };
    if let Ok(output) = run_git_cmd(cwd, &args) {
        for line in output.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() == 3 {
                let adds = parts[0].parse::<u32>().unwrap_or(0);
                let dels = parts[1].parse::<u32>().unwrap_or(0);
                let path = parts[2].trim().replace('\\', "/").to_string();
                stats.insert(path, (adds, dels));
            }
        }
    }
    stats
}

fn count_file_lines(cwd: &str, rel_path: &str) -> u32 {
    let abs_path = Path::new(cwd).join(rel_path);
    if let Ok(content) = std::fs::read_to_string(&abs_path) {
        content.lines().count() as u32
    } else {
        0
    }
}

use std::collections::HashMap;

#[tauri::command]
pub fn git_status(path: String) -> Result<GitStatusResult, String> {
    // Single consolidated call: porcelain v2 with branch info and untracked files
    let porcelain_result = run_git_cmd_raw(
        &path,
        &["status", "--porcelain=v2", "--branch", "-u"],
    );

    let porcelain_output = match porcelain_result {
        Ok(output) => output,
        Err(_) => {
            // Not a git repo or git not available
            return Ok(GitStatusResult {
                is_repo: false,
                branch: String::new(),
                staged: Vec::new(),
                unstaged: Vec::new(),
                ahead_commits: Vec::new(),
                hash: String::new(),
            });
        }
    };

    // Retrieve additions/deletions stats in parallel
    let path_clone1 = path.clone();
    let path_clone2 = path.clone();
    let staged_stats_handle = std::thread::spawn(move || get_numstats(&path_clone1, true));
    let unstaged_stats_handle = std::thread::spawn(move || get_numstats(&path_clone2, false));
    let staged_stats = staged_stats_handle.join().unwrap_or_default();
    let unstaged_stats = unstaged_stats_handle.join().unwrap_or_default();

    // Compute hash of the raw porcelain output for change detection
    let hash = fnv_hash(&porcelain_output);

    // Parse porcelain v2 output
    let mut branch = String::new();
    let mut ahead: i32 = 0;
    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut has_upstream = false;

    for line in porcelain_output.lines() {
        if line.starts_with("# branch.head ") {
            branch = line["# branch.head ".len()..].to_string();
        } else if line.starts_with("# branch.ab ") {
            has_upstream = true;
            // Format: # branch.ab +N -M
            let ab_part = &line["# branch.ab ".len()..];
            for token in ab_part.split_whitespace() {
                if let Some(n) = token.strip_prefix('+') {
                    ahead = n.parse().unwrap_or(0);
                }
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") {
            // Ordinary (1) or rename/copy (2) changed entry
            // Format for "1": 1 XY sub mH mI mW hH hI path
            // Format for "2": 2 XY sub mH mI mW hH hI X<score> path\torigPath
            let parts: Vec<&str> = line.splitn(9, ' ').collect();
            if parts.len() < 9 {
                continue;
            }

            let xy = parts[1];
            let x = xy.chars().nth(0).unwrap_or('.');
            let y = xy.chars().nth(1).unwrap_or('.');

            let is_rename = line.starts_with("2 ");

            let (file_path, display_name) = if is_rename {
                // For renames, the path field contains "new_path\told_path"
                let path_part = parts[8];
                // In porcelain v2, rename format: last field is "Xscore path\torigPath"
                // But when split by space with limit 9, parts[8] is everything after the 8th space
                // which is "X<score> newpath\toldpath"
                let rename_parts: Vec<&str> = path_part.splitn(2, ' ').collect();
                let paths_str = if rename_parts.len() == 2 { rename_parts[1] } else { path_part };
                let tab_parts: Vec<&str> = paths_str.split('\t').collect();
                if tab_parts.len() == 2 {
                    let new_p = clean_path(tab_parts[0]);
                    let old_p = clean_path(tab_parts[1]);
                    let old_name = Path::new(&old_p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| old_p.clone());
                    let new_name = Path::new(&new_p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| new_p.clone());
                    (new_p, format!("{} -> {}", old_name, new_name))
                } else {
                    let p = clean_path(paths_str);
                    let name = Path::new(&p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| p.clone());
                    (p, name)
                }
            } else {
                let p = clean_path(parts[8]);
                let name = Path::new(&p).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| p.clone());
                (p, name)
            };

            // X = staged status (index vs HEAD)
            if x != '.' {
                let p_clean = file_path.replace('\\', "/");
                let (adds, dels) = staged_stats.get(&p_clean)
                    .map(|&(a, d)| (Some(a), Some(d)))
                    .unwrap_or((None, None));

                staged.push(GitFileStatus {
                    path: file_path.clone(),
                    name: display_name.clone(),
                    status: map_status_char(x).to_string(),
                    additions: adds,
                    deletions: dels,
                });
            }

            // Y = unstaged status (worktree vs index)
            if y != '.' {
                let p_clean = file_path.replace('\\', "/");
                let (adds, dels) = unstaged_stats.get(&p_clean)
                    .map(|&(a, d)| (Some(a), Some(d)))
                    .unwrap_or((None, None));

                unstaged.push(GitFileStatus {
                    path: file_path,
                    name: display_name,
                    status: map_status_char(y).to_string(),
                    additions: adds,
                    deletions: dels,
                });
            }
        } else if line.starts_with("? ") {
            // Untracked file
            let file_path = clean_path(&line[2..]);
            let name = Path::new(&file_path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| file_path.clone());
            let adds = count_file_lines(&path, &file_path);

            unstaged.push(GitFileStatus {
                path: file_path,
                name,
                status: "untracked".to_string(),
                additions: Some(adds),
                deletions: Some(0),
            });
        }
    }

    // Get ahead commits in parallel (only if there's an upstream and ahead > 0)
    let ahead_commits = if has_upstream && ahead > 0 {
        let path_clone = path.clone();
        let handle = std::thread::spawn(move || {
            let mut commits = Vec::new();
            if let Ok(log_out) = run_git_cmd(
                &path_clone,
                &["log", "@{u}..HEAD", "--pretty=format:%h|%s|%an|%ad", "--date=short"],
            ) {
                for line in log_out.lines() {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() >= 4 {
                        commits.push(GitCommitInfo {
                            hash: parts[0].to_string(),
                            message: parts[1].to_string(),
                            author: parts[2].to_string(),
                            date: parts[3].to_string(),
                        });
                    }
                }
            }
            commits
        });
        handle.join().unwrap_or_default()
    } else {
        Vec::new()
    };

    Ok(GitStatusResult {
        is_repo: true,
        branch,
        staged,
        unstaged,
        ahead_commits,
        hash,
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
