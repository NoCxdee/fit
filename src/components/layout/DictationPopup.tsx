import { useEffect, useState } from 'react';
import { useDictation } from '../../hooks/useDictation';
import { Ear, X } from 'lucide-react';

export function DictationPopup() {
  const { isRecording, isTranscribing, showNoSpeech, showNoModel, micSpectrum, cancelRecording, popupPosition } = useDictation();
  const [activeState, setActiveState] = useState<'hidden' | 'listening' | 'transcribing' | 'nospeech' | 'nomodel'>('hidden');

  // Sync state transitions smoothly
  useEffect(() => {
    if (isRecording) {
      setActiveState('listening');
    } else if (isTranscribing) {
      setActiveState('transcribing');
    } else if (showNoSpeech) {
      setActiveState('nospeech');
    } else if (showNoModel) {
      setActiveState('nomodel');
    } else {
      setActiveState('hidden');
    }
  }, [isRecording, isTranscribing, showNoSpeech, showNoModel]);

  if (activeState === 'hidden') return null;

  // Soundwave bars rendering
  const renderSoundwave = () => {
    const weights = [0.45, 0.65, 0.85, 1.0, 1.0, 1.0, 0.85, 0.65, 0.45];
    return Array.from({ length: 9 }).map((_, i) => {
      const spectrumIndex = [1, 3, 5, 7, 8, 9, 11, 13, 14][i];
      const rawVal = micSpectrum[spectrumIndex] || 0;
      const weight = weights[i];
      const activeHeight = Math.abs(rawVal) * 55 * weight;
      const height = Math.max(4, Math.min(26, 4 + activeHeight));
      return (
        <div
          key={i}
          className="dictation-popup__wave-bar"
          style={{ height: `${height}px` }}
        />
      );
    });
  };

  return (
    <div
      className={`dictation-popup dictation-popup--${activeState}`}
      data-position={popupPosition || 'bottom-center'}
      id="dictation-popup-hud"
    >
      {/* ── State 1: Listening ── */}
      {activeState === 'listening' && (
        <div className="dictation-popup__content dictation-popup__content--listening">
          <Ear size={18} className="dictation-popup__ear-icon" />
          <div className="dictation-popup__wave-container">
            {renderSoundwave()}
          </div>
          <button 
            className="dictation-popup__close-btn" 
            onClick={(e) => {
              e.stopPropagation();
              cancelRecording();
            }}
            title="Cancel dictation"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── State 2: Transcribing ── */}
      {activeState === 'transcribing' && (
        <div className="dictation-popup__content dictation-popup__content--transcribing">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dictation-popup__brain-icon"
          >
            <path d="M12 4v16" />
            <path d="M12 4a3.5 3.5 0 0 0-3.5 3.5c0 1.2.8 2.3 2 2.7-.8.3-1.5 1.1-1.5 2s.7 1.7 1.5 2c-1.2.4-2 1.5-2 2.7A3.5 3.5 0 0 0 12 20" />
            <path d="M12 4a3.5 3.5 0 0 1 3.5 3.5c0 1.2-.8 2.3-2 2.7.8.3 1.5 1.1 1.5 2s-.7 1.7-1.5 2c1.2.4 2 1.5 2 2.7A3.5 3.5 0 0 1 12 20" />
          </svg>
          <span className="dictation-popup__text">TRANSCRIBING...</span>
        </div>
      )}

      {/* ── State 3: No Speech ── */}
      {activeState === 'nospeech' && (
        <div className="dictation-popup__content dictation-popup__content--nospeech">
          <div className="dictation-popup__red-dot" />
          <span className="dictation-popup__text">NO SPEECH DETECTED</span>
        </div>
      )}

      {/* ── State 4: No Model ── */}
      {activeState === 'nomodel' && (
        <div className="dictation-popup__content dictation-popup__content--nomodel">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="dictation-popup__text">Download a model first</span>
        </div>
      )}
    </div>
  );
}

