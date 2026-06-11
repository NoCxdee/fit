use crate::settings::get_settings;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::f32::consts::PI;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::AppHandle;

pub enum SoundType {
    Start,
    Stop,
    Cancel,
}

const VOLUME: f32 = 0.14;

fn generate_bubble(sample_rate: u32, channels: u16, freq_start: f32, dur_ms: f32) -> Vec<f32> {
    let num_frames = (sample_rate as f32 * dur_ms / 1000.0) as usize;
    let total = num_frames * channels as usize;
    let mut samples = Vec::with_capacity(total);

    let mut phase = 0.0f32;
    let freq_end = freq_start * 0.4;

    for i in 0..num_frames {
        let progress = i as f32 / num_frames as f32;

        // Frequency sweep: drops fast, like a bubble resonance decaying
        let freq = freq_end + (freq_start - freq_end) * (-6.0 * progress).exp();

        // Amplitude: sharp pop then exponential decay
        let envelope = (-5.0 * progress).exp();

        phase += 2.0 * PI * freq / sample_rate as f32;
        if phase > 2.0 * PI {
            phase -= 2.0 * PI;
        }

        let mono = phase.sin() * envelope * VOLUME;
        for _ in 0..channels {
            samples.push(mono);
        }
    }
    samples
}

fn generate_start_samples(sample_rate: u32, channels: u16) -> Vec<f32> {
    generate_bubble(sample_rate, channels, 1100.0, 40.0)
}

fn generate_stop_samples(sample_rate: u32, channels: u16) -> Vec<f32> {
    generate_bubble(sample_rate, channels, 900.0, 40.0)
}

fn generate_cancel_samples(sample_rate: u32, channels: u16) -> Vec<f32> {
    generate_bubble(sample_rate, channels, 700.0, 30.0)
}

struct PlaybackState {
    samples: Vec<f32>,
    position: usize,
}

fn play_samples(samples: Vec<f32>, config: cpal::StreamConfig) {
    let total_samples = samples.len();
    let state = Arc::new(Mutex::new(PlaybackState {
        samples,
        position: 0,
    }));

    let sample_rate = config.sample_rate.0;
    let channels = config.channels as usize;

    thread::spawn(move || {
        let host = cpal::default_host();
        let device = match host.default_output_device() {
            Some(d) => d,
            None => {
                log::error!("Audio feedback: no output device available");
                return;
            }
        };

        let stream = match device.build_output_stream(
            &config,
            {
                let state_clone = state.clone();
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    let mut playback = state_clone.lock().unwrap();
                    let remaining = total_samples.saturating_sub(playback.position);
                    let to_write = data.len().min(remaining);
                    if to_write > 0 {
                        data[..to_write]
                            .copy_from_slice(&playback.samples[playback.position..playback.position + to_write]);
                        playback.position += to_write;
                    }
                    for sample in &mut data[to_write..] {
                        *sample = 0.0;
                    }
                }
            },
            |err| {
                log::error!("Audio feedback stream error: {}", err);
            },
            Some(Duration::from_millis(150)),
        ) {
            Ok(s) => s,
            Err(e) => {
                log::error!("Audio feedback: failed to build output stream: {}", e);
                return;
            }
        };

        let _ = stream.play();

        let duration_sec = total_samples as f64 / (sample_rate as f64 * channels as f64);
        let sleep_ms = (duration_sec * 1000.0) as u64 + 150;
        thread::sleep(Duration::from_millis(sleep_ms));
    });
}

fn should_play(app: &AppHandle) -> bool {
    let settings = get_settings(app);
    settings.dictation_feedback_sound
}

pub fn play_feedback_sound(app: &AppHandle, sound_type: SoundType) {
    if !should_play(app) {
        return;
    }

    let host = cpal::default_host();
    let device = match host.default_output_device() {
        Some(d) => d,
        None => {
            log::error!("Audio feedback: no default output device");
            return;
        }
    };

    let supported_config = match device.default_output_config() {
        Ok(c) => c,
        Err(e) => {
            log::error!("Audio feedback: failed to get output config: {}", e);
            return;
        }
    };

    let sample_rate = supported_config.sample_rate().0;
    let channels = supported_config.channels();

    let config = cpal::StreamConfig {
        channels,
        sample_rate: supported_config.sample_rate(),
        buffer_size: cpal::BufferSize::Default,
    };

    match sound_type {
        SoundType::Start => {
            let samples = generate_start_samples(sample_rate, channels);
            play_samples(samples, config);
        }
        SoundType::Stop => {
            let samples = generate_stop_samples(sample_rate, channels);
            play_samples(samples, config);
        }
        SoundType::Cancel => {
            let samples = generate_cancel_samples(sample_rate, channels);
            play_samples(samples, config);
        }
    }
}

pub fn play_feedback_sound_blocking(app: &AppHandle, sound_type: SoundType) {
    play_feedback_sound(app, sound_type);
}

pub fn play_test_sound(app: &AppHandle, sound_type: SoundType) {
    play_feedback_sound(app, sound_type);
}
