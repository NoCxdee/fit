/* ================================================================
   Fit — UpdateModal Component
   ================================================================ */

import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { installUpdate } from '../../utils/ipc';
import packageInfo from '../../../package.json';

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
      setDownloading(false);
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
              {pendingUpdate.body
                .split('\n')
                .filter(line => !line.trim().match(/^#*\s*fit(?:\s+v?\d+(?:\.\d+)*(?:-[a-z0-9.]+)?|\s*\(\s*v?\d+(?:\.\d+)*(?:-[a-z0-9.]+)?\s*\))$/i))
                .map((line, i) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  // Support basic bolding like **text** in bullets
                  const parts = trimmed.substring(2).split(/(\*\*.*?\*\*)/g);
                  return (
                    <div key={i} className="update-modal__notes-bullet">
                      {parts.map((part, j) => 
                        part.startsWith('**') && part.endsWith('**') 
                          ? <strong key={j} style={{ color: 'var(--color-primary)' }}>{part.slice(2, -2)}</strong> 
                          : part
                      )}
                    </div>
                  );
                } else if (trimmed.startsWith('#')) {
                  return <h3 key={i} className="update-modal__notes-heading">{trimmed.replace(/^#+\s*/, '')}</h3>;
                } else if (trimmed === '---') {
                  return <hr key={i} className="update-modal__notes-divider" />;
                } else if (trimmed !== '') {
                  return <p key={i} className="update-modal__notes-text">{trimmed}</p>;
                }
                return null;
              })}
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
