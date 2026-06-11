// ================================================================
// Fit — Clipboard Commands
// Interface with the native OS clipboard to query copied file paths or screenshot images.
// ================================================================

#[cfg(target_os = "windows")]
use windows_sys::Win32::System::DataExchange::{OpenClipboard, CloseClipboard, GetClipboardData};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock, GlobalSize};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Shell::DragQueryFileW;

#[tauri::command]
pub fn get_clipboard_files(_workspace_path: Option<String>) -> Result<Option<Vec<String>>, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        // Open the clipboard with retries (associated with the current process/thread)
        let mut open_success = false;
        for _ in 0..10 {
            if OpenClipboard(0) != 0 {
                open_success = true;
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(15));
        }
        if !open_success {
            return Err("Failed to open clipboard after retries".into());
        }

        const CF_HDROP: u32 = 15;
        let h_data = GetClipboardData(CF_HDROP);
        if h_data != 0 {
            let h_drop = h_data; // In windows-sys, HDROP is an alias to isize/HANDLE, so we can use it directly
            
            // Query the total number of files in the CF_HDROP structure
            let count = DragQueryFileW(h_drop, 0xFFFFFFFF, std::ptr::null_mut(), 0);
            let mut files = Vec::new();

            for i in 0..count {
                // Determine the buffer length needed for the path (excluding the null terminator)
                let len = DragQueryFileW(h_drop, i, std::ptr::null_mut(), 0);
                if len > 0 {
                    let mut buffer = vec![0u16; (len + 1) as usize];
                    DragQueryFileW(h_drop, i, buffer.as_mut_ptr(), buffer.len() as u32);
                    
                    // Convert UTF-16 wide string to standard Rust String
                    if let Ok(path) = String::from_utf16(&buffer[..len as usize]) {
                        files.push(path);
                    }
                }
            }

            // Only return files if we actually parsed at least one file path.
            // If the format exists but is empty, fall through to check for images.
            if !files.is_empty() {
                CloseClipboard();
                return Ok(Some(files));
            }
        }

        // If no files in clipboard, check if there is an image (CF_DIB or CF_DIBV5)
        const CF_DIB: u32 = 8;
        const CF_DIBV5: u32 = 17;
        
        let mut h_dib = GetClipboardData(CF_DIB);
        if h_dib == 0 {
            h_dib = GetClipboardData(CF_DIBV5);
        }
        
        if h_dib != 0 {
            let size = GlobalSize(h_dib as *mut _);
            if size >= 40 {
                let ptr = GlobalLock(h_dib as *mut _);
                if !ptr.is_null() {
                    let dib_data = std::slice::from_raw_parts(ptr as *const u8, size);
                    
                    let bi_size = u32::from_le_bytes(dib_data[0..4].try_into().unwrap_or_default());
                    if size >= bi_size as usize {
                        let bi_bit_count = u16::from_le_bytes(dib_data[14..16].try_into().unwrap_or_default());
                        let bi_compression = u32::from_le_bytes(dib_data[16..20].try_into().unwrap_or_default());
                        let bi_clr_used = u32::from_le_bytes(dib_data[32..36].try_into().unwrap_or_default());
                        
                        let mut palette_colors = 0;
                        if bi_bit_count <= 8 {
                            palette_colors = if bi_clr_used > 0 {
                                bi_clr_used as usize
                            } else {
                                1 << bi_bit_count
                            };
                        }
                        let palette_size = palette_colors * 4;
                        
                        const BI_BITFIELDS: u32 = 3;
                        let bitfields_size = if bi_size == 40 && bi_compression == BI_BITFIELDS {
                            12
                        } else {
                            0
                        };
                        
                        let dib_pixel_offset = bi_size as usize + palette_size + bitfields_size;
                        let bf_off_bits = 14 + dib_pixel_offset;
                        
                        let mut bmp_file = Vec::with_capacity(14 + size);
                        bmp_file.extend_from_slice(b"BM");
                        bmp_file.extend_from_slice(&(14 + size as u32).to_le_bytes());
                        bmp_file.extend_from_slice(&0u16.to_le_bytes());
                        bmp_file.extend_from_slice(&0u16.to_le_bytes());
                        bmp_file.extend_from_slice(&(bf_off_bits as u32).to_le_bytes());
                        bmp_file.extend_from_slice(dib_data);
                        
                        GlobalUnlock(h_dib as *mut _);
                        CloseClipboard();
                        
                        // Save the BMP file to the target folder
                        let timestamp = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_secs();
                        let filename = format!("screenshot_{}.bmp", timestamp);
                        
                        // Save to OS temporary directory to avoid polluting the workspace
                        let temp_dir = std::env::temp_dir().join("fit_screenshots");
                        if !temp_dir.exists() {
                            let _ = std::fs::create_dir_all(&temp_dir);
                        }
                        let target_dir = if temp_dir.exists() {
                            temp_dir
                        } else {
                            std::env::temp_dir()
                        };
                        
                        let file_path = target_dir.join(&filename);
                        if std::fs::write(&file_path, &bmp_file).is_ok() {
                            if let Some(path_str) = file_path.to_str() {
                                return Ok(Some(vec![path_str.to_string()]));
                            }
                        }
                        return Err("Failed to save clipboard image to file".into());
                    }
                    GlobalUnlock(h_dib as *mut _);
                }
            }
        }

        CloseClipboard();
        Ok(None)
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::{Command, Stdio};
        use std::io::Write;

        let swift_code = r#"
        import Cocoa
        let board = NSPasteboard.general
        if let fileURLs = board.readObjects(forClasses: [NSURL.self], options: nil) as? [NSURL] {
            let paths = fileURLs.filter { $0.isFileURL }.map { $0.path }
            if !paths.isEmpty {
                print("FILES:" + paths.joined(separator: "|"))
                exit(0)
            }
        }
        if let image = NSImage(pasteboard: board) {
            if let tiffData = image.tiffRepresentation,
               let bitmap = NSBitmapImageRep(data: tiffData),
               let pngData = bitmap.representation(using: .png, properties: [:]) {
                let tempDir = NSTemporaryDirectory() + "fit_screenshots"
                try? FileManager.default.createDirectory(atPath: tempDir, withIntermediateDirectories: true, attributes: nil)
                let timestamp = Int(Date().timeIntervalSince1970)
                let filePath = tempDir + "/screenshot_\(timestamp).png"
                if FileManager.default.createFile(atPath: filePath, contents: pngData, attributes: nil) {
                    print("IMAGE:" + filePath)
                    exit(0)
                }
            }
        }
        print("NONE")
        "#;

        let mut child = Command::new("swift")
            .arg("-")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to run swift CLI: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(swift_code.as_bytes()).map_err(|e| e.to_string())?;
        }

        let output = child.wait_with_output().map_err(|e| format!("Swift process error: {}", e))?;
        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(format!("Swift script failed: {}", err_msg));
        }

        let out_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if out_str.starts_with("FILES:") {
            let paths = out_str["FILES:".len()..]
                .split('|')
                .map(|s| s.to_string())
                .collect();
            Ok(Some(paths))
        } else if out_str.starts_with("IMAGE:") {
            let path = out_str["IMAGE:".len()..].to_string();
            Ok(Some(vec![path]))
        } else {
            Ok(None)
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Ok(None)
    }
}
