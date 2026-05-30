/* ================================================================
   Fit — App Shell
   Main application layout with all panels and state persistence.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { WorkspaceBar } from './components/layout/WorkspaceBar';
import { SessionPanel } from './components/layout/SessionPanel';
import { TitleBar } from './components/layout/TitleBar';
import { MainContent } from './components/layout/MainContent';
import { FileDrawer } from './components/layout/FileDrawer';
import { SettingsModal } from './components/layout/SettingsModal';
import { AboutModal } from './components/layout/AboutModal';
import { UpdateModal } from './components/layout/UpdateModal';
import { WelcomeScreen } from './components/layout/WelcomeScreen';
import { Loader } from './components/layout/Loader';
import { SpeechOverlay } from './components/layout/SpeechOverlay';
import { useAppState, useAppDispatch } from './stores/appStore';
import { useTranslation } from './i18n';
import { loadState, saveState, gitStatus, checkUpdate, getModelStatus, loadModel, unloadModel, setSystemMute } from './utils/ipc';
import { generateId } from './utils/generateId';

export function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const initialized = useRef(false);
  const lastStateRef = useRef(state);
  const [showLoader, setShowLoader] = useState(true);

  const { lang } = useTranslation();
  const { 
    sttShortcut, sttMicId, sttVolume, sttPushToTalk, settingsOpen,
    sttAutoUnload, sttOverlayPos, sttPasteMethod, sttMuteSystem
  } = state;

  const [sttStatus, setSttStatus] = useState<'listening' | 'transcribing' | 'error' | null>(null);
  const [sttVolumeLevel, setSttVolumeLevel] = useState<number>(0);
  const [sttErrorMsg, setSttErrorMsg] = useState<string>('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const unloadTimeoutRef = useRef<any>(null);
  const sttTimeoutRef = useRef<any>(null);
  const lastRecognizedTextRef = useRef<string>('');
  const lastActiveElementRef = useRef<Element | null>(null);

  const matchShortcut = (e: KeyboardEvent, shortcutStr: string): boolean => {
    const parts = shortcutStr.split('+');
    const key = parts[parts.length - 1]; // e.g. "Space" or "a"
    const needsCtrl = parts.includes('Control');
    const needsShift = parts.includes('Shift');
    const needsAlt = parts.includes('Alt');
    const needsMeta = parts.includes('Meta');

    const actualKey = e.key === ' ' ? 'Space' : e.key;

    return (
      actualKey.toLowerCase() === key.toLowerCase() &&
      e.ctrlKey === needsCtrl &&
      e.shiftKey === needsShift &&
      e.altKey === needsAlt &&
      e.metaKey === needsMeta
    );
  };

  const handleAutoUnload = () => {
    if (unloadTimeoutRef.current) {
      clearTimeout(unloadTimeoutRef.current);
      unloadTimeoutRef.current = null;
    }
    
    if (sttAutoUnload === 'immediate') {
      unloadModel().catch(console.error);
    } else if (sttAutoUnload === '5min') {
      unloadTimeoutRef.current = setTimeout(() => {
        unloadModel().catch(console.error);
      }, 5 * 60 * 1000);
    } else if (sttAutoUnload === '10min') {
      unloadTimeoutRef.current = setTimeout(() => {
        unloadModel().catch(console.error);
      }, 10 * 60 * 1000);
    }
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    if (sttStatus === 'transcribing') return;

    if (sttTimeoutRef.current) {
      clearTimeout(sttTimeoutRef.current);
      sttTimeoutRef.current = null;
    }

    if (unloadTimeoutRef.current) {
      clearTimeout(unloadTimeoutRef.current);
      unloadTimeoutRef.current = null;
    }

    // Check if model is downloaded first
    try {
      const status = await getModelStatus();
      if (!status.downloaded) {
        setSttErrorMsg(lang === 'it' ? 'Scarica Parakeet V3 nelle Impostazioni!' : 'Download Parakeet V3 in Settings!');
        setSttStatus('error');
        sttTimeoutRef.current = setTimeout(() => setSttStatus(null), 4000);
        // Automatically open settings to the Speech tab!
        if (!settingsOpen) {
          dispatch({ type: 'TOGGLE_SETTINGS' });
        }
        return;
      }
      
      // Auto-load model if not loaded
      if (!status.loaded) {
        await loadModel();
      }
    } catch (e) {
      console.error('Failed to check/load model status:', e);
    }

    lastRecognizedTextRef.current = '';
    lastActiveElementRef.current = document.activeElement;
    isRecordingRef.current = true;
    setSttStatus('listening');
    setSttVolumeLevel(0);

    // Mute system volume if enabled
    if (sttMuteSystem) {
      setSystemMute(true).catch(console.error);
    }

    // 1. Audio Level Visualizer setup
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(sttMicId !== 'default' ? { deviceId: { exact: sttMicId } } : {}),
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Interpolation state for smooth motion design
      let smoothedVolume = 0;

      const updateVolume = () => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // Noise gate: ignore very low average levels to prevent background noise from moving the bars
        const NOISE_FLOOR = 2; // Lowered to pick up standard mics easily
        let effectiveAverage = average;
        if (average < NOISE_FLOOR) {
          effectiveAverage = 0;
        } else {
          // Normalize so it scales smoothly from 0 after the noise floor
          effectiveAverage = ((average - NOISE_FLOOR) / (255 - NOISE_FLOOR)) * 255;
        }

        // Target volume: Amplify slightly and clamp to 0-100
        // (Removed sttVolume multiplier since slider is gone and might be stuck at 0)
        const targetVol = Math.min(100, (effectiveAverage / 64) * 100);

        // Motion Design: Fast attack, smooth slow decay for audio bars
        if (targetVol > smoothedVolume) {
          smoothedVolume += (targetVol - smoothedVolume) * 0.6; // Quick rise
        } else {
          smoothedVolume += (targetVol - smoothedVolume) * 0.12; // Premium smooth fall
        }

        // Ensure we don't dispatch infinitely small decimals, and snap to 0 cleanly
        if (smoothedVolume < 0.5) smoothedVolume = 0;

        setSttVolumeLevel(Math.round(smoothedVolume));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    } catch (err) {
      console.warn('Microphone access denied or failed:', err);
    }

    // 2. Speech recognition setup
    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        // Removing explicit recognition.lang assignment.
        // This allows the native OS speech engine to use its global/multilingual dictation settings
        // instead of forcing it to strictly match the UI language, which was causing hallucinations.

        let speechResultReceived = false;
        let finalTranscript = '';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' ';
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const text = (finalTranscript + interimTranscript).trim();
          if (text) {
            lastRecognizedTextRef.current = text;
            speechResultReceived = true;
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition error event:', e);
        };

        recognition.onend = () => {
          // If the API ended automatically (e.g., silence timeout or 7-8s limit) but user is still recording,
          // we must restart the recognition to allow continuous long dictation.
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.warn('Failed to restart speech recognition:', e);
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        // Fallback for environment where SpeechRecognition is not supported
        sttTimeoutRef.current = setTimeout(() => {
          if (isRecordingRef.current) {
            isRecordingRef.current = false;
            setSttErrorMsg(lang === 'it' ? 'SpeechRecognition non supportato' : 'SpeechRecognition not supported');
            setSttStatus('error');
            if (sttMuteSystem) {
              setSystemMute(false).catch(console.error);
            }
            // Clean up visualizer stream
            if (animationFrameRef.current) {
              cancelAnimationFrame(animationFrameRef.current);
              animationFrameRef.current = null;
            }
            if (audioStreamRef.current) {
              audioStreamRef.current.getTracks().forEach(track => track.stop());
              audioStreamRef.current = null;
            }
            if (audioContextRef.current) {
              audioContextRef.current.close().catch(console.error);
              audioContextRef.current = null;
            }
            sttTimeoutRef.current = setTimeout(() => {
              setSttStatus(null);
              handleAutoUnload();
            }, 3000);
          }
        }, 1000);
      }
    } catch (e) {
      console.error('Speech recognition failed to init:', e);
    }
  };

  const cancelRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    // Unmute system volume if muted
    if (sttMuteSystem) {
      setSystemMute(false).catch(console.error);
    }

    // Clean up AudioContext & streams
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    setSttStatus(null);
    handleAutoUnload();
  };

  const stopRecording = (transcriptionText?: string) => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setSttStatus('transcribing');

    // Unmute system volume if muted
    if (sttMuteSystem) {
      setSystemMute(false).catch(console.error);
    }

    // Clean up AudioContext & streams
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    // Process transcription pasting
    sttTimeoutRef.current = setTimeout(async () => {
      let textToPaste = transcriptionText || lastRecognizedTextRef.current;
      
      if (!textToPaste) {
        setSttErrorMsg(lang === 'it' ? 'Nessun testo rilevato' : 'No speech detected');
        setSttStatus('error');
        sttTimeoutRef.current = setTimeout(() => {
          setSttStatus(null);
          handleAutoUnload();
        }, 1500);
        return;
      }

      if (textToPaste) {
        // Write to clipboard if required
        if (sttPasteMethod === 'clipboard') {
          try {
            await navigator.clipboard.writeText(textToPaste);
          } catch (clipErr) {
            console.error('Failed to copy text to clipboard:', clipErr);
          }
        }

        // Paste directly to inputs/trigger custom event if 'direct'
        if (sttPasteMethod === 'direct') {
          const targetEl = lastActiveElementRef.current || document.activeElement;
          console.log('[STT] Dispatching fit-speech-transcription event with text:', textToPaste, 'sttPasteMethod:', sttPasteMethod, 'target:', targetEl ? targetEl.tagName : 'None');
          
          // 1. Dispatch custom event for editors and terminals, bubble it from targetEl
          const ev = new CustomEvent('fit-speech-transcription', { 
            bubbles: true, 
            cancelable: true,
            detail: { text: textToPaste } 
          });
          if (targetEl) {
            targetEl.dispatchEvent(ev);
          } else {
            window.dispatchEvent(ev);
          }

          // 2. Fallback: Paste into standard focused inputs/textareas (excluding xterm helper textarea)
          const activeEl = targetEl;
          console.log('[STT] Target element for fallback paste:', activeEl ? activeEl.tagName : 'None', 'Classes:', activeEl ? activeEl.className : '');
          if (activeEl && 
              (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) &&
              !activeEl.classList.contains('xterm-helper-textarea')) {
            const start = activeEl.selectionStart || 0;
            const end = activeEl.selectionEnd || 0;
            const val = activeEl.value;
            const newValue = val.substring(0, start) + textToPaste + val.substring(end);
            
            try {
              // React overrides the value setter. To trigger onChange, we must call the native setter.
              const prototype = activeEl instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
              const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
              if (descriptor && descriptor.set) {
                descriptor.set.call(activeEl, newValue);
              } else {
                activeEl.value = newValue;
              }
              activeEl.selectionStart = activeEl.selectionEnd = start + textToPaste.length;
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
              console.log('[STT] Fallback paste succeeded. New value set.');
            } catch (err) {
              console.error('[STT] Error during fallback native value setting:', err);
              // Fallback assignment
              activeEl.value = newValue;
              activeEl.selectionStart = activeEl.selectionEnd = start + textToPaste.length;
              activeEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        }
      }
      setSttStatus(null);
      handleAutoUnload();
    }, 600);
  };

  // Keyboard shortcut listener hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (target.closest('.settings-modal') && !target.classList.contains('settings-select__native')) {
          return;
        }
      }

      if (matchShortcut(e, sttShortcut)) {
        e.preventDefault();
        if (sttStatus === 'transcribing') return; // Ignore key presses while transcribing

        if (sttPushToTalk) {
          if (!isRecordingRef.current) {
            startRecording();
          }
        } else {
          // Toggle mode
          if (isRecordingRef.current) {
            stopRecording();
          } else {
            startRecording();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (matchShortcut(e, sttShortcut)) {
        if (sttStatus === 'transcribing') return; // Ignore key releases while transcribing

        if (sttPushToTalk && isRecordingRef.current) {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
    };
  }, [sttShortcut, sttPushToTalk, sttMicId, sttVolume, settingsOpen, lang, sttAutoUnload, sttOverlayPos, sttPasteMethod, sttMuteSystem, sttStatus]);


  const handleLoaderFinished = () => {
    setShowLoader(false);
  };

  // Load state on mount and check updates
  useEffect(() => {
    async function init() {
      try {
        const savedState = await loadState();
        if (savedState && savedState.workspaces) {
          dispatch({ type: 'LOAD_STATE', payload: savedState });
        }
      } catch (err) {
        console.error('Failed to load state:', err);
      } finally {
        initialized.current = true;
        
        // Check for updates on startup if enabled
        try {
          const stored = localStorage.getItem('fit_check_on_startup');
          const checkEnabled = stored !== null ? stored === 'true' : true;
          if (checkEnabled) {
            const result = await checkUpdate();
            if (result && result.available) {
              dispatch({
                type: 'SET_PENDING_UPDATE',
                payload: { version: result.version, body: result.body }
              });
            }
          }
        } catch (updateErr) {
          console.error('Startup update check failed:', updateErr);
        }
      }
    }
    init();
  }, [dispatch]);

  // Save state on change (immediate for critical changes, debounced for panel resizes)
  // gitStatus is excluded from saves — it's transient and reset on load
  useEffect(() => {
    if (!initialized.current) {
      lastStateRef.current = state;
      return;
    }

    const prevState = lastStateRef.current;
    lastStateRef.current = state;

    // Skip save entirely if ONLY gitStatus changed
    if (prevState.gitStatus !== state.gitStatus) {
      // Check if anything else changed too
      const otherChanged =
        prevState.workspaces !== state.workspaces ||
        prevState.activeWorkspaceId !== state.activeWorkspaceId ||
        prevState.sessions !== state.sessions ||
        prevState.activeSessionId !== state.activeSessionId ||
        prevState.openTabs !== state.openTabs ||
        prevState.activeTabId !== state.activeTabId ||
        prevState.fileDrawerOpen !== state.fileDrawerOpen ||
        prevState.panelSizes !== state.panelSizes ||
        prevState.drawerTab !== state.drawerTab ||
        prevState.useWebGl !== state.useWebGl ||
        prevState.sttShortcut !== state.sttShortcut ||
        prevState.sttMicId !== state.sttMicId ||
        prevState.sttVolume !== state.sttVolume ||
        prevState.sttPushToTalk !== state.sttPushToTalk ||
        prevState.sttAutoUnload !== state.sttAutoUnload ||
        prevState.sttOverlayPos !== state.sttOverlayPos ||
        prevState.sttPasteMethod !== state.sttPasteMethod ||
        prevState.sttMuteSystem !== state.sttMuteSystem;
      if (!otherChanged) return; // gitStatus only — skip save
    }

    // Exclude transient state from persistence
    const { gitStatus: _gs, settingsOpen: _so, aboutOpen: _ao, pendingUpdate: _pu, inspectorMode: _im, capturedElement: _ce, ...stateToSave } = state;

    // Check if anything other than panelSizes changed
    const isCriticalChange =
      prevState.workspaces !== state.workspaces ||
      prevState.activeWorkspaceId !== state.activeWorkspaceId ||
      prevState.sessions !== state.sessions ||
      prevState.activeSessionId !== state.activeSessionId ||
      prevState.openTabs !== state.openTabs ||
      prevState.activeTabId !== state.activeTabId ||
      prevState.fileDrawerOpen !== state.fileDrawerOpen;

    if (isCriticalChange) {
      saveState(stateToSave as any).catch(err => console.error('Failed to save state immediately:', err));
      return;
    }

    // Debounce saving only for non-critical changes (e.g. panel resizes)
    const timeoutId = setTimeout(() => {
      saveState(stateToSave as any).catch(err => console.error('Failed to save state:', err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state]);

  // Save active workspace to recent projects in localStorage
  useEffect(() => {
    if (state.activeWorkspaceId) {
      const activeWorkspace = state.workspaces.find(w => w.id === state.activeWorkspaceId);
      if (activeWorkspace) {
        try {
          const recentsRaw = localStorage.getItem('fit_recent_projects');
          const recents = recentsRaw ? JSON.parse(recentsRaw) : [];
          const existingIndex = recents.findIndex((p: any) => p.path === activeWorkspace.path);
          
          const newProject = {
            id: activeWorkspace.id,
            name: activeWorkspace.name,
            path: activeWorkspace.path,
            color: activeWorkspace.color,
            icon: activeWorkspace.icon,
            lastOpened: Date.now(),
          };

          if (existingIndex > -1) {
            recents[existingIndex] = newProject;
          } else {
            recents.push(newProject);
          }

          // Sort by lastOpened desc
          recents.sort((a: any, b: any) => b.lastOpened - a.lastOpened);
          
          // Keep max 10 recent projects
          const trimmed = recents.slice(0, 10);
          localStorage.setItem('fit_recent_projects', JSON.stringify(trimmed));
        } catch (e) {
          console.error('Failed to save recent projects:', e);
        }
      }
    }
  }, [state.activeWorkspaceId, state.workspaces]);

  // Poll Git status for the active workspace globally
  // Adaptive polling: 5s when git/diff panel visible, 15s otherwise
  useEffect(() => {
    const activeWorkspaceId = state.activeWorkspaceId;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) {
      dispatch({ type: 'SET_GIT_STATUS', payload: null });
      return;
    }

    let isMounted = true;
    let isPolling = false; // In-flight guard

    async function queryStatus() {
      if (isPolling) return; // Skip if previous call is still in-flight
      isPolling = true;
      try {
        const res = await gitStatus(activeWorkspace!.path);
        if (isMounted) {
          dispatch({ type: 'SET_GIT_STATUS', payload: res });
        }
      } catch (err) {
        console.error('Failed to query git status globally:', err);
      } finally {
        isPolling = false;
      }
    }

    // Query status immediately
    queryStatus();

    // Adaptive interval: faster when git UI is visible
    const isGitVisible = state.fileDrawerOpen && state.drawerTab === 'git';
    const pollInterval = isGitVisible ? 5000 : 15000;
    const interval = setInterval(queryStatus, pollInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [state.activeWorkspaceId, state.workspaces, state.fileDrawerOpen, state.drawerTab, dispatch]);

  // Global Keyboard Shortcuts (Ctrl+T for terminal, Ctrl+P for preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl || e.shiftKey || e.altKey) return;

      const activeWorkspaceId = state.activeWorkspaceId;
      if (!activeWorkspaceId) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
        const activeWorkspaceSessions = state.sessions.filter(s => s.workspaceId === activeWorkspaceId);
        const num = activeWorkspaceSessions.length + 1;
        const name = `session ${num}`;

        const session = {
          id: generateId('session'),
          workspaceId: activeWorkspaceId,
          name,
          terminals: [{
            id: generateId('term'),
            shell: 'powershell-core',
            cwd: activeWorkspace ? activeWorkspace.path : '',
          }],
          splitDirection: 'horizontal' as const,
        };

        dispatch({ type: 'ADD_SESSION', payload: session });
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        dispatch({
          type: 'OPEN_TAB',
          payload: {
            id: `tab-preview-${Date.now()}`,
            type: 'preview',
            title: 'Preview',
            previewUrl: '',
            workspaceId: activeWorkspaceId,
          },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activeWorkspaceId, state.workspaces, state.sessions, dispatch]);

  // Prevent default drag/drop behaviors globally
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => e.preventDefault();
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  if (showLoader) {
    return <Loader onFinished={handleLoaderFinished} />;
  }

  return (
    <div className="app-shell">
      {/* Unified Integrated Title & Tab Bar */}
      <TitleBar />

      {/* Main Body */}
      <div className="app-body">
        {/* Column 1: Workspace Bar */}
        <WorkspaceBar />

        {/* Column 2: Session Panel */}
        {state.activeWorkspaceId && <SessionPanel />}

        {/* Column 3: Main Area */}
        {state.activeWorkspaceId ? (
          <div className="main-area">
            <div className="main-content">
              <MainContent />
            </div>
          </div>
        ) : (
          <WelcomeScreen />
        )}

        {/* Column 5: File Drawer (Right Sidebar) */}
        {state.activeWorkspaceId && <FileDrawer />}
      </div>

      {/* Global Settings Modal overlay */}
      <SettingsModal />
      <AboutModal />
      <UpdateModal />

      {/* Speech overlay visualizer */}
      {sttStatus && (
        <SpeechOverlay 
          status={sttStatus} 
          volume={sttVolumeLevel} 
          errorMsg={sttErrorMsg} 
          onClose={cancelRecording} 
          position={sttOverlayPos} 
        />
      )}
    </div>
  );
}
