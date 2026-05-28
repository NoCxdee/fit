// ================================================================
// Fit — Clipboard Commands
// Interface with the native OS clipboard to query copied file paths.
// ================================================================

use windows_sys::Win32::System::DataExchange::{OpenClipboard, CloseClipboard, GetClipboardData};
use windows_sys::Win32::UI::Shell::DragQueryFileW;

#[tauri::command]
pub fn get_clipboard_files() -> Result<Option<Vec<String>>, String> {
    unsafe {
        // Open the clipboard (associated with the current process/thread)
        if OpenClipboard(0) == 0 {
            return Err("Failed to open clipboard".into());
        }

        const CF_HDROP: u32 = 15;
        let h_data = GetClipboardData(CF_HDROP);
        if h_data == 0 {
            CloseClipboard();
            return Ok(None);
        }

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

        CloseClipboard();
        Ok(Some(files))
    }
}
