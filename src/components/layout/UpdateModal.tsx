/* ================================================================
   Fit — UpdateModal Component
   ================================================================ */

import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { installUpdate } from '../../utils/ipc';
import packageInfo from '../../../package.json';

function parseFormatting(text: string, baseKey: number): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let key = baseKey * 100;
  const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = formatRegex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(textBefore);
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    }
    lastIndex = formatRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

function parseMarkdownText(text: string): React.ReactNode {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  linkRegex.lastIndex = 0;
  let key = 0;
  while ((match = linkRegex.exec(text)) !== null) {
    const textBefore = text.substring(lastIndex, match.index);
    if (textBefore) {
      parts.push(parseFormatting(textBefore, key++));
    }
    const label = match[1];
    const url = match[2];
    const isAnchor = url.startsWith('#');
    parts.push(
      <a
        key={key++}
        href={isAnchor ? undefined : url}
        target={isAnchor ? undefined : "_blank"}
        rel={isAnchor ? undefined : "noopener noreferrer"}
        className="update-modal__notes-link"
        onClick={isAnchor ? (e) => e.preventDefault() : undefined}
      >
        {label}
      </a>
    );
    lastIndex = linkRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(parseFormatting(text.substring(lastIndex), key++));
  }
  return parts.length > 0 ? <>{parts}</> : text;
}

function formatReleaseNotes(body: string | undefined) {
  if (!body) return null;
  const lines = body.split('\n');
  return (
    <ul className="update-modal__notes-list">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const cleanDivider = trimmed.replace(/\s/g, '');
        if (cleanDivider === '---' || cleanDivider === '***' || cleanDivider === '___') {
          return <hr key={idx} className="update-modal__notes-divider" />;
        }
        if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.substring(1).trim();
          if (!content) return null;
          return (
            <li key={idx} className="update-modal__notes-bullet">
              {parseMarkdownText(content)}
            </li>
          );
        }
        if (trimmed.startsWith('#')) {
          const text = trimmed.replace(/^#+\s*/, '');
          return <h4 key={idx} className="update-modal__notes-heading">{parseMarkdownText(text)}</h4>;
        }
        if (!trimmed) {
          return <div key={idx} className="update-modal__notes-spacer" />;
        }
        return <p key={idx} className="update-modal__notes-text">{parseMarkdownText(trimmed)}</p>;
      })}
    </ul>
  );
}

export function UpdateModal() {
  const { pendingUpdate } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pendingUpdate) return null;

  const handleClose = () => {
    if (downloading) return; // Prevent closing while downloading/installing
    dispatch({ type: 'SET_PENDING_UPDATE', payload: null });
  };

  const handleInstall = async () => {
    setDownloading(true);
    setError(null);
    try {
      await installUpdate();
      // installUpdate will download and restart the app automatically in production.
    } catch (err) {
      console.error('Install update failed:', err);
      setError(String(err));
      setDownloading(false);
    }
  };

  return (
    <div className="update-backdrop" onClick={handleClose}>
      <div className="update-modal" onClick={e => e.stopPropagation()}>
        {/* App Logo Card */}
        <div className="update-modal__header-card">
          <div className="update-modal__logo-icon">
            <img src="/fit_new_logo.png" alt="Fit" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="update-modal__header-info">
            <h1 className="update-modal__title">{t('settings.updater.available', { version: pendingUpdate.version })}</h1>
            <p className="update-modal__subtitle">{t('settings.updater.subtitle')}</p>
            <div className="update-modal__version-badges">
              <span className="update-modal__badge update-modal__badge--current">v{packageInfo.version}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="update-modal__badge-arrow">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span className="update-modal__badge update-modal__badge--new">v{pendingUpdate.version}</span>
            </div>
          </div>
        </div>

        {/* Release Notes */}
        {pendingUpdate.body && (
          <div className="update-modal__notes-container">
            <span className="update-modal__notes-title">{t('settings.updater.releaseNotes')}</span>
            <div className="update-modal__notes-content">
              {formatReleaseNotes(pendingUpdate.body)}
            </div>
          </div>
        )}

        {/* Status / Error */}
        {error && (
          <div className="update-modal__error">
            <span className="update-modal__error-title">{t('settings.updater.errorTitle')}</span>
            <p className="update-modal__error-text">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="update-modal__actions">
          {downloading ? (
            <div className="update-modal__status">
              <span className="update-modal__spinner" />
              <span className="update-modal__status-text">{t('settings.updater.downloading')}</span>
            </div>
          ) : (
            <>
              <button className="update-modal__btn update-modal__btn--secondary" onClick={handleClose}>
                {t('workspace.cancel')}
              </button>
              <button className="update-modal__btn update-modal__btn--primary" onClick={handleInstall}>
                {t('settings.updater.install')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
