/* ================================================================
   Fit — SpeechOverlay Component
   Floating visualizer showing recording states and audio levels.
   Uses vertical equalizer bars for a premium listening animation.
   ================================================================ */

import { useTranslation } from '../../i18n';

interface SpeechOverlayProps {
  status: 'listening' | 'transcribing' | 'error';
  volume: number; // 0 to 100
  errorMsg?: string;
  onClose?: () => void;
  position?: 'bottom' | 'top' | 'center' | 'none';
}

export function SpeechOverlay({ status, volume, errorMsg, onClose, position = 'bottom' }: SpeechOverlayProps) {
  const { t, lang } = useTranslation();

  if (position === 'none') return null;

  const numBars = 9;
  const bars = Array.from({ length: numBars }).map((_, i) => {
    const isActive = status === 'listening' && volume > 5;

    // When idle (no voice): all bars are identical small dots — completely still
    if (!isActive) {
      return (
        <div
          key={i}
          className="stt-visualizer-bar stt-visualizer-bar--idle"
          style={{
            '--bar-height': '6px',
            '--bar-opacity': 0.35,
          } as React.CSSProperties}
        />
      );
    }

    // When speaking: bars react to voice volume
    // Center bars grow taller, edge bars are shorter — organic equalizer shape
    const center = (numBars - 1) / 2;
    const distFromCenter = Math.abs(i - center) / center; // 0 at center, 1 at edge
    const centerWeight = 1 - distFromCenter * 0.5; // center=1.0, edge=0.5

    // Each bar gets a unique offset so they don't all move identically
    const uniqueOffset = Math.sin(i * 2.1 + 0.7) * 0.2 + Math.cos(i * 1.3) * 0.1;

    // Volume normalized 0-1, then shaped per bar
    const vol = volume / 100;
    const barValue = Math.max(0, Math.min(1, vol * centerWeight + uniqueOffset * vol));

    // Height: 6px (min idle) → 24px (max full volume)
    const barHeight = 6 + barValue * 18;

    // Opacity: more opaque when louder
    const barOpacity = 0.5 + barValue * 0.5;

    return (
      <div
        key={i}
        className="stt-visualizer-bar"
        style={{
          '--bar-height': `${barHeight}px`,
          '--bar-opacity': barOpacity,
        } as React.CSSProperties}
      />
    );
  });

  return (
    <div className={`stt-overlay stt-overlay--${status} stt-overlay--pos-${position}`}>
      <div className="stt-overlay__container">
        {/* Left Side: Icon */}
        <div className="stt-overlay__icon">
          {status === 'listening' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stt-overlay__ear">
              <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" />
              <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1.5" />
            </svg>
          ) : status === 'transcribing' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a857" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="stt-overlay__brain">
              <path d="M9.5 2a2.5 2.5 0 0 1 2.5 2.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
              <path d="M14.5 2a2.5 2.5 0 0 0-2.5 2.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
            </svg>
          ) : (
            <div className="stt-overlay__error-dot" />
          )}
        </div>

        {/* Center: Content (Bars for listening, Text for transcribing/error) */}
        <div className="stt-overlay__content">
          {status === 'listening' ? (
            <div className="stt-overlay__bars-container">
              {bars}
            </div>
          ) : (
            <span className="stt-overlay__title">
              {status === 'transcribing'
                ? (lang === 'it' ? 'Trascrizione...' : t('stt.overlay.transcribing'))
                : errorMsg || 'Error'}
            </span>
          )}
        </div>

        {/* Right Side: Close Button (only for listening state) */}
        {status === 'listening' && onClose && (
          <button className="stt-overlay__close-btn" onClick={onClose} aria-label="Cancel recording">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d4a857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
