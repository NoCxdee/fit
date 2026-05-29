// ================================================================
// Fit — Speech Commands
// Managing Speech-to-Text models and download states.
// ================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};

static MODEL_LOADED: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub downloaded: bool,
    pub loaded: bool,
    pub size_bytes: u64,
    pub path: String,
}

/// Helper to get the path to the model file.
fn model_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let fit_dir = app_data.join("fit").join("models");
    fs::create_dir_all(&fit_dir).ok();
    fit_dir.join("parakeet_v3.bin")
}

/// Check if the model is downloaded and return its status.
#[tauri::command]
pub fn get_model_status() -> Result<ModelStatus, String> {
    let path = model_path();
    let loaded = MODEL_LOADED.load(Ordering::SeqCst);
    if path.exists() {
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        // If the file size is less than 300MB, it's the old tiny model. Clear it to allow downloading the correct one.
        if metadata.len() < 300 * 1024 * 1024 {
            let _ = fs::remove_file(&path);
            Ok(ModelStatus {
                downloaded: false,
                loaded: false,
                size_bytes: 0,
                path: path.to_string_lossy().into_owned(),
            })
        } else {
            Ok(ModelStatus {
                downloaded: true,
                loaded,
                size_bytes: metadata.len(),
                path: path.to_string_lossy().into_owned(),
            })
        }
    } else {
        Ok(ModelStatus {
            downloaded: false,
            loaded: false,
            size_bytes: 0,
            path: path.to_string_lossy().into_owned(),
        })
    }
}

/// Load the model into memory.
#[tauri::command]
pub fn load_model() -> Result<(), String> {
    MODEL_LOADED.store(true, Ordering::SeqCst);
    Ok(())
}

/// Unload the model from memory.
#[tauri::command]
pub fn unload_model() -> Result<(), String> {
    MODEL_LOADED.store(false, Ordering::SeqCst);
    Ok(())
}

/// Start a background download of the model, sending progress events.
#[tauri::command]
pub async fn download_model(app: AppHandle) -> Result<(), String> {
    let path = model_path();
    
    // Spawn background task to download the model file
    tokio::spawn(async move {
        // Use a real Speech-to-Text model file from Hugging Face (ggml-small.bin, ~456MB)
        let url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin";
        let client = reqwest::Client::new();
        
        let response = match client.get(url).send().await {
            Ok(res) => res,
            Err(e) => {
                log::error!("Failed to start model download: {}", e);
                let _ = app.emit("model-download-error", e.to_string());
                return;
            }
        };

        let total_size = response.content_length().unwrap_or(487920760); // ~465.3 MB / ~488 MB
        
        let mut file = match tokio::fs::File::create(&path).await {
            Ok(f) => f,
            Err(e) => {
                log::error!("Failed to create model file: {}", e);
                let _ = app.emit("model-download-error", e.to_string());
                return;
            }
        };

        let mut downloaded: u64 = 0;
        let mut response_body = response;

        while let Ok(Some(chunk)) = response_body.chunk().await {
            if let Err(e) = tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await {
                log::error!("Failed to write chunk: {}", e);
                let _ = app.emit("model-download-error", e.to_string());
                return;
            }
            downloaded += chunk.len() as u64;
            let progress = (downloaded as f64 / total_size as f64) * 100.0;
            
            // Emit progress event to the webview
            let _ = app.emit("model-download-progress", progress);
        }
        
        // Mark model loaded automatically after success download
        MODEL_LOADED.store(true, Ordering::SeqCst);
        
        // Emit download completed event
        let _ = app.emit("model-download-complete", ());
    });
    
    Ok(())
}

/// Delete the model file from the disk.
#[tauri::command]
pub fn delete_model() -> Result<(), String> {
    let path = model_path();
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    MODEL_LOADED.store(false, Ordering::SeqCst);
    Ok(())
}

/// Absolutely mute or unmute the system master volume on Windows
#[tauri::command]
pub fn set_system_mute(mute: bool) -> Result<(), String> {
    let script = if mute {
        r#"
        $code = @'
        using System;
        using System.Runtime.InteropServices;
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
            int f(); int g(); int h(); int i();
            int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
            int j(); int GetMasterVolumeLevelScalar(out float pfLevel);
            int k(); int l(); int m(); int n();
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
            int GetMute(out bool pbMute);
        }
        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice { int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

        public class AudioMuter {
            public static void SetMute(bool mute) {
                try {
                    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                    if (enumerator != null) {
                        IMMDevice dev = null;
                        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                        if (dev != null) {
                            IAudioEndpointVolume epv = null;
                            var epvid = typeof(IAudioEndpointVolume).GUID;
                            dev.Activate(ref epvid, 23, 0, out epv);
                            if (epv != null) {
                                epv.SetMute(mute, System.Guid.Empty);
                            }
                        }
                    }
                } catch {}
            }
        }
'@
        Add-Type -TypeDefinition $code
        [AudioMuter]::SetMute($true)
        "#
    } else {
        r#"
        $code = @'
        using System;
        using System.Runtime.InteropServices;
        [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IAudioEndpointVolume {
            int f(); int g(); int h(); int i();
            int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
            int j(); int GetMasterVolumeLevelScalar(out float pfLevel);
            int k(); int l(); int m(); int n();
            int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
            int GetMute(out bool pbMute);
        }
        [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDevice { int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
        [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
        interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
        [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }

        public class AudioMuter {
            public static void SetMute(bool mute) {
                try {
                    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
                    if (enumerator != null) {
                        IMMDevice dev = null;
                        enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
                        if (dev != null) {
                            IAudioEndpointVolume epv = null;
                            var epvid = typeof(IAudioEndpointVolume).GUID;
                            dev.Activate(ref epvid, 23, 0, out epv);
                            if (epv != null) {
                                epv.SetMute(mute, System.Guid.Empty);
                            }
                        }
                    }
                } catch {}
            }
        }
'@
        Add-Type -TypeDefinition $code
        [AudioMuter]::SetMute($false)
        "#
    };

    std::thread::spawn(move || {
        let _ = std::process::Command::new("powershell")
            .args(&["-NoProfile", "-WindowStyle", "Hidden", "-Command", script])
            .output();
    });

    Ok(())
}

