use crate::managers::audio::{AudioRecordingManager, MicrophoneMode};
use crate::managers::transcription::TranscriptionManager;
use crate::settings::{get_settings, write_settings, AppSettings, ModelUnloadTimeout};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> AppSettings {
    get_settings(&app)
}

#[tauri::command]
pub fn save_app_settings(
    app: AppHandle,
    settings: AppSettings,
    audio_manager: State<'_, Arc<AudioRecordingManager>>,
) -> Result<(), String> {
    let always_on = settings.always_on_microphone;
    write_settings(&app, settings);

    // Update the audio manager mode
    let new_mode = if always_on {
        MicrophoneMode::AlwaysOn
    } else {
        MicrophoneMode::OnDemand
    };

    let _ = audio_manager.update_mode(new_mode);
    let _ = audio_manager.update_selected_device();

    // Apply accelerator preferences
    crate::managers::transcription::apply_accelerator_settings(&app);

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelLoadStatus {
    pub is_loaded: bool,
    pub current_model: Option<String>,
}

#[tauri::command]
pub fn set_model_unload_timeout(app: AppHandle, timeout: ModelUnloadTimeout) {
    let mut settings = get_settings(&app);
    settings.model_unload_timeout = timeout;
    write_settings(&app, settings);
}

#[tauri::command]
pub fn get_model_load_status(
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
) -> Result<ModelLoadStatus, String> {
    Ok(ModelLoadStatus {
        is_loaded: transcription_manager.is_model_loaded(),
        current_model: transcription_manager.get_current_model(),
    })
}

#[tauri::command]
pub fn unload_model_manually(
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
) -> Result<(), String> {
    transcription_manager
        .unload_model()
        .map_err(|e| format!("Failed to unload model: {}", e))
}

#[tauri::command]
pub async fn start_transcription(
    app: AppHandle,
    audio_manager: State<'_, Arc<AudioRecordingManager>>,
) -> Result<(), String> {
    crate::audio_feedback::play_feedback_sound(&app, crate::audio_feedback::SoundType::Start);
    audio_manager
        .try_start_recording("fit-stt")
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_transcription(
    app: AppHandle,
    audio_manager: State<'_, Arc<AudioRecordingManager>>,
    transcription_manager: State<'_, Arc<TranscriptionManager>>,
) -> Result<String, String> {
    crate::audio_feedback::play_feedback_sound(&app, crate::audio_feedback::SoundType::Stop);
    let samples_res = audio_manager.stop_recording("fit-stt");
    
    let samples = match samples_res {
        Some(s) => s,
        None => {
            audio_manager.remove_mute();
            return Err("No audio samples recorded".to_string());
        }
    };
        
    let result = transcription_manager
        .transcribe(samples)
        .map_err(|e| e.to_string());
        
    audio_manager.remove_mute();
    
    result
}

#[tauri::command]
pub async fn cancel_transcription(
    app: AppHandle,
    audio_manager: State<'_, Arc<AudioRecordingManager>>,
) -> Result<(), String> {
    crate::audio_feedback::play_feedback_sound(&app, crate::audio_feedback::SoundType::Cancel);
    audio_manager.cancel_recording();
    Ok(())
}
