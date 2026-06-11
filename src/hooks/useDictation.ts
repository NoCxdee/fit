import { useState, useEffect, useCallback, useRef, createContext, useContext, createElement, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ── Types ────────────────────────────────────────────────────────

type ModelUnloadTimeout =
  | 'never'
  | 'immediately'
  | 'sec_15'
  | 'min_2'
  | 'min_5'
  | 'min_10'
  | 'min_15'
  | 'hour_1';

type WhisperAcceleratorSetting = 'auto' | 'cpu' | 'gpu';
type OrtAcceleratorSetting = 'auto' | 'cpu' | 'cuda' | 'directml' | 'rocm';

interface AppSettings {
  selectedModel: string;
  alwaysOnMicrophone: boolean;
  selectedMicrophone: string | null;
  clamshellMicrophone: string | null;
  selectedOutputDevice: string | null;
  translateToEnglish: boolean;
  selectedLanguage: string;
  customWords: string[];
  modelUnloadTimeout: ModelUnloadTimeout;
  wordCorrectionThreshold: number;
  muteWhileRecording: boolean;
  appLanguage: string;
  lazyStreamClose: boolean;
  customFillerWords: string[] | null;
  whisperAccelerator: WhisperAcceleratorSetting;
  ortAccelerator: OrtAcceleratorSetting;
  whisperGpuDevice: number;
  extraRecordingBufferMs: number;
  dictationFeedbackSound: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string | null;
  sha256: string | null;
  size_mb: number;
  is_downloaded: boolean;
  is_downloading: boolean;
  partial_size: number;
  is_directory: boolean;
  engine_type: 'whisper' | 'onnx' | 'parakeet' | 'moonshine' | 'sense_voice';
  accuracy_score: number;
  speed_score: number;
  supports_translation: boolean;
  is_recommended: boolean;
  supported_languages: string[];
  supports_language_selection: boolean;
  is_custom: boolean;
}

interface AudioDevice {
  index: string;
  name: string;
  is_default: boolean;
}

interface ModelStateEvent {
  event_type: 'selection_changed' | 'loading' | 'loaded' | 'load_failed' | 'unloaded';
  model_id: string | null;
  model_name: string | null;
  error: string | null;
}

interface DownloadProgressEvent {
  model_id: string;
  bytes_downloaded: number;
  total_bytes: number;
  percentage: number;
  speed_kbps: number;
}

// ── DOM Insertion Helper ─────────────────────────────────────────

function insertTextAtCursor(text: string): boolean {
  const activeEl = document.activeElement;
  if (!activeEl) return false;

  if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
    const start = activeEl.selectionStart ?? activeEl.value.length;
    const end = activeEl.selectionEnd ?? activeEl.value.length;
    const originalValue = activeEl.value;
    const newValue = originalValue.substring(0, start) + text + originalValue.substring(end);

    const prototype = Object.getPrototypeOf(activeEl);
    const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (valueSetter) {
      valueSetter.call(activeEl, newValue);
    } else {
      activeEl.value = newValue;
    }

    activeEl.selectionStart = activeEl.selectionEnd = start + text.length;
    activeEl.dispatchEvent(new Event('input', { bubbles: true }));
    activeEl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (activeEl && (activeEl as HTMLElement).isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      activeEl.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  return false;
}

// ── Hook ─────────────────────────────────────────────────────────

function useDictationInternal() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [microphones, setMicrophones] = useState<AudioDevice[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showNoSpeech, setShowNoSpeech] = useState(false);
  const [showNoModel, setShowNoModel] = useState(false);
  const noSpeechTimerRef = useRef<any>(null);
  const noModelTimerRef = useRef<any>(null);

  const [shortcut, setShortcutState] = useState(() => {
    return localStorage.getItem('fit_dictation_shortcut') || 'Ctrl+Space';
  });

  const setShortcut = useCallback((newShortcut: string) => {
    localStorage.setItem('fit_dictation_shortcut', newShortcut);
    setShortcutState(newShortcut);
  }, []);

  const [popupPosition, setPopupPositionState] = useState(() => {
    return localStorage.getItem('fit_dictation_popup_position') || 'bottom-center';
  });

  const setPopupPosition = useCallback((pos: string) => {
    localStorage.setItem('fit_dictation_popup_position', pos);
    setPopupPositionState(pos);
  }, []);

  useEffect(() => {
    return () => {
      if (noSpeechTimerRef.current) {
        clearTimeout(noSpeechTimerRef.current);
      }
    };
  }, []);


  const [modelLoadingState, setModelLoadingState] = useState<{
    isLoading: boolean;
    activeModelId: string | null;
    error: string | null;
  }>({
    isLoading: false,
    activeModelId: null,
    error: null,
  });

  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [downloadPhase, setDownloadPhase] = useState<Record<string, 'downloading' | 'verifying' | 'extracting'>>({});
  const [micSpectrum, setMicSpectrum] = useState<number[]>(new Array(16).fill(0));
  
  // Track transcription lifecycle internally to prevent duplicates
  const transcribingRef = useRef(false);

  // 1. Fetch settings, models, devices
  const fetchSettings = useCallback(async () => {
    try {
      const res = await invoke<AppSettings>('get_app_settings');
      setSettings(res);
    } catch (err) {
      console.error('Failed to fetch app settings:', err);
    }
  }, []);

  const fetchModels = useCallback(async () => {
    try {
      const list = await invoke<ModelInfo[]>('get_available_models');
      setModels(list);
    } catch (err) {
      console.error('Failed to fetch available models:', err);
    }
  }, []);

  const fetchMicrophones = useCallback(async () => {
    try {
      const list = await invoke<AudioDevice[]>('get_available_microphones');
      setMicrophones(list);
    } catch (err) {
      console.error('Failed to fetch microphones:', err);
    }
  }, []);

  // Update a single setting field
  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);

    try {
      await invoke('save_app_settings', { settings: updated });
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [settings]);

  // Sync state initially
  useEffect(() => {
    fetchSettings();
    fetchModels();
  }, [fetchSettings, fetchModels]);

  // Listen to background event streams
  useEffect(() => {
    let active = true;
    const listeners: (() => void)[] = [];

    // Spectrum Visualizer
    listen<number[]>('mic-level', (e) => {
      if (!active) return;
      setMicSpectrum(e.payload);
    }).then(un => listeners.push(un));

    // Model load status events
    listen<ModelStateEvent>('model-state-changed', (e) => {
      if (!active) return;
      const { event_type, model_id, error } = e.payload;
      
      if (event_type === 'loading') {
        setModelLoadingState({
          isLoading: true,
          activeModelId: model_id,
          error: null,
        });
      } else if (event_type === 'loaded') {
        setModelLoadingState({
          isLoading: false,
          activeModelId: model_id,
          error: null,
        });
        fetchSettings(); // Update active model selection in settings
      } else if (event_type === 'load_failed') {
        setModelLoadingState({
          isLoading: false,
          activeModelId: null,
          error: error,
        });
      } else if (event_type === 'unloaded') {
        setModelLoadingState({
          isLoading: false,
          activeModelId: null,
          error: null,
        });
      }
    }).then(un => listeners.push(un));

    // Download progress events
    listen<DownloadProgressEvent>('model-download-progress', (e) => {
      if (!active) return;
      const { model_id, percentage } = e.payload;
      setDownloadProgress(prev => ({
        ...prev,
        [model_id]: Math.round(percentage),
      }));
      // Set phase to downloading if not already in a post-download phase
      setDownloadPhase(prev => {
        if (prev[model_id] === 'verifying' || prev[model_id] === 'extracting') return prev;
        return { ...prev, [model_id]: 'downloading' };
      });
    }).then(un => listeners.push(un));

    // Verification events
    listen<string>('model-verification-started', (e) => {
      if (!active) return;
      setDownloadPhase(prev => ({ ...prev, [e.payload]: 'verifying' }));
    }).then(un => listeners.push(un));

    listen<string>('model-verification-completed', (e) => {
      if (!active) return;
      // Keep verifying phase until extraction starts (or download completes for non-directory models)
    }).then(un => listeners.push(un));

    // Extraction events
    listen<string>('model-extraction-started', (e) => {
      if (!active) return;
      setDownloadPhase(prev => ({ ...prev, [e.payload]: 'extracting' }));
    }).then(un => listeners.push(un));

    listen<string>('model-extraction-completed', (e) => {
      if (!active) return;
      // Cleanup happens in download-complete
    }).then(un => listeners.push(un));

    // Complete / Failure hooks
    listen<string>('model-download-complete', (e) => {
      if (!active) return;
      const completedModelId = e.payload;
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[completedModelId];
        return next;
      });
      setDownloadPhase(prev => {
        const next = { ...prev };
        delete next[completedModelId];
        return next;
      });
      fetchModels();
      // Auto-load the model after download completes
      invoke('set_active_model', { modelId: completedModelId })
        .then(() => fetchSettings())
        .catch((err) => console.error('Failed to auto-load model after download:', err));
    }).then(un => listeners.push(un));

    listen<string>('model-download-cancelled', (e) => {
      if (!active) return;
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[e.payload];
        return next;
      });
      setDownloadPhase(prev => {
        const next = { ...prev };
        delete next[e.payload];
        return next;
      });
      fetchModels();
    }).then(un => listeners.push(un));

    listen<{ model_id: string; error: string }>('model-download-failed', (e) => {
      if (!active) return;
      const { model_id } = e.payload;
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[model_id];
        return next;
      });
      setDownloadPhase(prev => {
        const next = { ...prev };
        delete next[model_id];
        return next;
      });
      fetchModels();
    }).then(un => listeners.push(un));

    listen<string>('model-deleted', () => {
      if (!active) return;
      fetchModels();
      fetchSettings();
    }).then(un => listeners.push(un));

    // Sync recording state from VAD when VAD handles voice activation
    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const recording = await invoke<boolean>('is_recording');
        setIsRecording(recording);
      } catch {}
    }, 1000);

    return () => {
      active = false;
      listeners.forEach(un => un());
      clearInterval(interval);
    };
  }, [fetchModels, fetchSettings]);

  // Check if model is loaded on start
  useEffect(() => {
    invoke<{ isLoaded: boolean; currentModel: string | null }>('get_model_load_status')
      .then(res => {
        if (res.isLoaded) {
          setModelLoadingState({
            isLoading: false,
            activeModelId: res.currentModel,
            error: null,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Recording Control Actions ───────────────────────────────────

  const startRecording = useCallback(async () => {
    // Check if any model is downloaded and selected
    const hasDownloaded = models.some(m => m.is_downloaded);
    if (!hasDownloaded) {
      setShowNoModel(true);
      if (noModelTimerRef.current) clearTimeout(noModelTimerRef.current);
      noModelTimerRef.current = setTimeout(() => {
        setShowNoModel(false);
      }, 3000);
      return;
    }
    try {
      setIsRecording(true);
      await invoke('start_transcription');
    } catch (err) {
      setIsRecording(false);
      console.error('Failed to start recording:', err);
      throw err;
    }
  }, [models]);

  const stopRecording = useCallback(async () => {
    if (transcribingRef.current) return '';
    setIsRecording(false);
    setIsTranscribing(true);
    transcribingRef.current = true;
    setShowNoSpeech(false);

    try {
      const text = await invoke<string>('stop_transcription');
      const cleanText = text ? text.trim() : '';

      if (cleanText) {
        // 1. Dispatch custom event to insert in active CodeMirror editor
        const event = new CustomEvent('fit-dictation-insert', {
          detail: { text: cleanText + ' ' },
          cancelable: true,
        });
        window.dispatchEvent(event);

        // Fallback: If not handled by custom listeners, try to insert in standard active input/textarea
        if (!event.defaultPrevented) {
          insertTextAtCursor(cleanText + ' ');
        }

        // 2. Fallback: Copy to clipboard so user can paste it anywhere
        try {
          await navigator.clipboard.writeText(cleanText);
        } catch (clipErr) {
          console.warn('Failed to copy transcribed text to clipboard:', clipErr);
        }
      } else {
        // No speech detected
        setShowNoSpeech(true);
        if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
        noSpeechTimerRef.current = setTimeout(() => {
          setShowNoSpeech(false);
        }, 3000);
      }

      setIsTranscribing(false);
      transcribingRef.current = false;
      return cleanText;
    } catch (err) {
      setIsTranscribing(false);
      transcribingRef.current = false;
      setShowNoSpeech(true);
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = setTimeout(() => {
        setShowNoSpeech(false);
      }, 3000);
      console.error('Failed to stop/transcribe audio:', err);
      throw err;
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    try {
      setIsRecording(false);
      setIsTranscribing(false);
      transcribingRef.current = false;
      setShowNoSpeech(false);
      if (noSpeechTimerRef.current) clearTimeout(noSpeechTimerRef.current);
      await invoke('cancel_transcription');
    } catch (err) {
      console.error('Failed to cancel recording:', err);
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      return await stopRecording();
    } else {
      await startRecording();
      return '';
    }
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        if (target.classList.contains('recording-shortcut-input')) {
          return;
        }
      }

      if (matchShortcut(e, shortcut)) {
        e.preventDefault();
        e.stopPropagation();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [shortcut, toggleRecording]);

  // ── Model Downloader Actions ────────────────────────────────────

  const downloadModel = useCallback(async (modelId: string) => {
    setDownloadProgress(prev => ({ ...prev, [modelId]: 0 }));
    try {
      await invoke('download_model', { modelId });
    } catch (err) {
      console.error(`Failed to download model ${modelId}:`, err);
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[modelId];
        return next;
      });
      fetchModels();
    }
  }, [fetchModels]);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      await invoke('delete_model', { modelId });
      fetchModels();
    } catch (err) {
      console.error(`Failed to delete model ${modelId}:`, err);
    }
  }, [fetchModels]);

  const selectModel = useCallback(async (modelId: string) => {
    try {
      await invoke('set_active_model', { modelId });
      fetchSettings();
    } catch (err) {
      console.error(`Failed to activate model ${modelId}:`, err);
    }
  }, [fetchSettings]);

  const cancelDownload = useCallback(async (modelId: string) => {
    try {
      await invoke('cancel_download', { modelId });
    } catch (err) {
      console.error(`Failed to cancel download ${modelId}:`, err);
    }
  }, []);

  const unloadModel = useCallback(async () => {
    try {
      await invoke('unload_model_manually');
    } catch (err) {
      console.error('Failed to unload model:', err);
    }
  }, []);

  return {
    settings,
    models,
    microphones,
    isRecording,
    isTranscribing,
    modelLoadingState,
    downloadProgress,
    downloadPhase,
    micSpectrum,
    updateSetting,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
    downloadModel,
    deleteModel,
    selectModel,
    cancelDownload,
    unloadModel,
    refreshDevices: fetchMicrophones,
    refreshModels: fetchModels,
    showNoSpeech,
    showNoModel,
    shortcut,
    setShortcut,
    popupPosition,
    setPopupPosition,
  };
}

// ── Shared Context ───────────────────────────────────────────────

type DictationContextType = ReturnType<typeof useDictationInternal>;

const DictationContext = createContext<DictationContextType | null>(null);

export function DictationProvider({ children }: { children: ReactNode }) {
  const value = useDictationInternal();
  return createElement(DictationContext.Provider, { value }, children);
}

export function useDictation() {
  const context = useContext(DictationContext);
  if (!context) {
    throw new Error('useDictation must be used within a DictationProvider');
  }
  return context;
}

function matchShortcut(e: KeyboardEvent, shortcutStr: string): boolean {
  const parts = shortcutStr.toLowerCase().split('+');
  const hasCtrl = parts.includes('ctrl') || parts.includes('control');
  const hasAlt = parts.includes('alt');
  const hasShift = parts.includes('shift');
  const hasMeta = parts.includes('meta') || parts.includes('cmd') || parts.includes('win');
  
  const nonModifiers = parts.filter(p => !['ctrl', 'control', 'alt', 'shift', 'meta', 'cmd', 'win'].includes(p));
  const targetKey = nonModifiers[0] || '';
  
  if (e.ctrlKey !== hasCtrl) return false;
  if (e.altKey !== hasAlt) return false;
  if (e.shiftKey !== hasShift) return false;
  if (e.metaKey !== hasMeta) return false;
  
  let eventKey = e.key.toLowerCase();
  if (eventKey === ' ') eventKey = 'space';
  
  let targetKeyNormalized = targetKey;
  if (targetKeyNormalized === ' ') targetKeyNormalized = 'space';
  
  return eventKey === targetKeyNormalized;
}
