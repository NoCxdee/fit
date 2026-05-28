// ================================================================
// Fit — Filesystem Commands
// Read directory listings, file contents, and write files.
// ================================================================

use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileEntry>>,
}

/// Read a directory tree (non-recursive — only one level deep).
/// The frontend requests deeper levels on demand (lazy loading).
#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut entries: Vec<FileEntry> = Vec::new();

    let read = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in read {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip only system and internal directories (.git, target, system garbage)
        if name == ".git" || name == "target" || name == ".DS_Store" || name == "desktop.ini" {
            continue;
        }

        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            children: None,
        });
    }

    // Sort: directories first, then files, alphabetically
    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Read the text content of a file.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))?;
    // Strip only a single trailing newline for consistency with git show output format.
    // This ensures diff comparison between git content and file content is accurate.
    Ok(content.strip_suffix("\n").unwrap_or(&content).to_string())
}

/// Write text content to a file.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    // Create parent directories if needed
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file {}: {}", path, e))
}

/// Create a new empty file, ensuring parent directories exist.
#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, "").map_err(|e| format!("Failed to create file {}: {}", path, e))
}

/// Create a new directory and any missing parent directories.
#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    fs::create_dir_all(p).map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

/// Search for files recursively under a workspace path matching the query (limit 100).
#[tauri::command]
pub fn search_files(path: String, query: String) -> Result<Vec<FileEntry>, String> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }
    let mut results = Vec::new();
    if query.trim().is_empty() {
        return Ok(results);
    }
    search_dir_limit(dir, &query, &mut results, 100);
    Ok(results)
}

fn search_dir_limit(dir: &Path, query: &str, results: &mut Vec<FileEntry>, limit: usize) {
    if results.len() >= limit {
        return;
    }
    if let Ok(read) = fs::read_dir(dir) {
        for entry in read {
            if results.len() >= limit {
                break;
            }
            if let Ok(entry) = entry {
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip common junk/compiled/git folders
                if name == ".git" || name == "target" || name == ".DS_Store" || name == "desktop.ini" || name == "node_modules" {
                    continue;
                }
                let path_buf = entry.path();
                let is_dir = path_buf.is_dir();
                if name.to_lowercase().contains(&query.to_lowercase()) {
                    results.push(FileEntry {
                        name: name.clone(),
                        path: path_buf.to_string_lossy().to_string(),
                        is_dir,
                        size: if !is_dir { entry.metadata().ok().map(|m| m.len()) } else { None },
                        children: None,
                    });
                }
                if is_dir {
                    search_dir_limit(&path_buf, query, results, limit);
                }
            }
        }
    }
}

