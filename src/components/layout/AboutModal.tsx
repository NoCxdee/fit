/* ================================================================
   Fit — AboutModal Component
   ================================================================ */

import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { open } from '@tauri-apps/plugin-shell';

export function AboutModal() {
  const { aboutOpen } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  if (!aboutOpen) return null;

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_ABOUT' });
  };

  return (
    <div className="about-backdrop" onClick={handleClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        {/* App Logo Card */}
        <div className="about-modal__logo-card">
          <div className="about-modal__logo-icon">
            <img src="/fit_new_logo.png" alt="Fit" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div className="about-modal__logo-info">
            <h1 className="about-modal__app-name">{t('app.name')}</h1>
            <p className="about-modal__app-desc">{t('app.description')}</p>
            <span className="about-modal__app-version">v1.0.0</span>
          </div>
        </div>

        {/* Details Table */}
        <div className="about-modal__details">
          <div className="about-modal__row">
            <span className="about-modal__label">{t('about.build')}</span>
            <span className="about-modal__value">Windows &middot; x86_64 &middot; v1.0.0</span>
          </div>

          <div className="about-modal__row">
            <span className="about-modal__label">{t('about.bundleId')}</span>
            <span className="about-modal__value font-mono">app.fit.desktop</span>
          </div>

          <div className="about-modal__row">
            <span className="about-modal__label">{t('about.website')}</span>
            <span className="about-modal__value">
              <a 
                href="https://fit-web-one.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="about-modal__link"
                onClick={(e) => {
                  e.preventDefault();
                  open('https://fit-web-one.vercel.app/');
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                fit-web-one.vercel.app
              </a>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
