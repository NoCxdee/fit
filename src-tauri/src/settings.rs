use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelUnloadTimeout {
    Never,
    Immediately,
    Min2,
    Min5,
    Min10,
    Min15,
    Hour1,
    Sec15,
}

impl Default for ModelUnloadTimeout {
    fn default() -> Self {
        ModelUnloadTimeout::Immediately
    }
}

impl ModelUnloadTimeout {
    pub fn to_minutes(self) -> Option<u64> {
        match self {
            ModelUnloadTimeout::Never => None,
            ModelUnloadTimeout::Immediately => Some(0),
            ModelUnloadTimeout::Min2 => Some(2),
            ModelUnloadTimeout::Min5 => Some(5),
            ModelUnloadTimeout::Min10 => Some(10),
            ModelUnloadTimeout::Min15 => Some(15),
            ModelUnloadTimeout::Hour1 => Some(60),
            ModelUnloadTimeout::Sec15 => Some(0),
        }
    }

    pub fn to_seconds(self) -> Option<u64> {
        match self {
            ModelUnloadTimeout::Never => None,
            ModelUnloadTimeout::Immediately => Some(0),
            ModelUnloadTimeout::Sec15 => Some(15),
            _ => self.to_minutes().map(|m| m * 60),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WhisperAcceleratorSetting {
    Auto,
    Cpu,
    Gpu,
}

impl Default for WhisperAcceleratorSetting {
    fn default() -> Self {
        WhisperAcceleratorSetting::Auto
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OrtAcceleratorSetting {
    Auto,
    Cpu,
    Cuda,
    #[serde(rename = "directml")]
    DirectMl,
    Rocm,
}

impl Default for OrtAcceleratorSetting {
    fn default() -> Self {
        OrtAcceleratorSetting::Cpu
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub selected_model: String,
    pub always_on_microphone: bool,
    pub selected_microphone: Option<String>,
    pub clamshell_microphone: Option<String>,
    pub selected_output_device: Option<String>,
    pub translate_to_english: bool,
    pub selected_language: String,
    pub custom_words: Vec<String>,
    pub model_unload_timeout: ModelUnloadTimeout,
    pub word_correction_threshold: f64,
    pub mute_while_recording: bool,
    pub app_language: String,
    pub lazy_stream_close: bool,
    pub custom_filler_words: Option<Vec<String>>,
    pub whisper_accelerator: WhisperAcceleratorSetting,
    pub ort_accelerator: OrtAcceleratorSetting,
    pub whisper_gpu_device: i32,
    pub extra_recording_buffer_ms: u64,
    #[serde(default = "default_dictation_feedback_sound")]
    pub dictation_feedback_sound: bool,
}

fn default_dictation_feedback_sound() -> bool {
    true
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            selected_model: "parakeet-tdt-0.6b-v3".to_string(), // Default/Recommended NVIDIA model
            always_on_microphone: false,
            selected_microphone: None,
            clamshell_microphone: None,
            selected_output_device: None,
            translate_to_english: false,
            selected_language: "auto".to_string(),
            custom_words: Vec::new(),
            model_unload_timeout: ModelUnloadTimeout::Immediately,
            word_correction_threshold: 0.5,
            mute_while_recording: false,
            app_language: "en".to_string(),
            lazy_stream_close: false,
            custom_filler_words: None,
            whisper_accelerator: WhisperAcceleratorSetting::Auto,
            ort_accelerator: OrtAcceleratorSetting::Cpu,
            whisper_gpu_device: -1, // accel::GPU_DEVICE_AUTO is -1
            extra_recording_buffer_ms: 0,
            dictation_feedback_sound: true,
        }
    }
}

fn settings_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let fit_dir = app_data.join("fit");
    fs::create_dir_all(&fit_dir).ok();
    fit_dir.join("settings.json")
}

pub fn get_settings(_app: &AppHandle) -> AppSettings {
    let path = settings_path();
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => {
            let default_settings = AppSettings::default();
            let json = serde_json::to_string_pretty(&default_settings).unwrap();
            let _ = fs::write(&path, json);
            default_settings
        }
    }
}

pub fn write_settings(_app: &AppHandle, settings: AppSettings) {
    let path = settings_path();
    if let Ok(json) = serde_json::to_string_pretty(&settings) {
        let _ = fs::write(&path, json);
    }
}
