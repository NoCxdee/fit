/* ================================================================
   Fit — SettingsModal Component
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation, type Lang } from '../../i18n';
import { checkUpdate, installUpdate } from '../../utils/ipc';
import packageInfo from '../../../package.json';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <label className="settings-toggle">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="settings-toggle__track">
        <span className="settings-toggle__thumb" />
      </span>
    </label>
  );
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleScroll() {
      setOpen(false);
    }
    if (open) {
      document.addEventListener('click', handleClick);
      window.addEventListener('scroll', handleScroll, true);
      // Compute fixed position relative to viewport
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPos({
          top: rect.bottom + 4,
          left: rect.left,
          minWidth: rect.width,
        });
      }
    }
    return () => {
      document.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      <div className="settings-select">
        <button ref={triggerRef} className="settings-select__trigger" onClick={() => setOpen(!open)}>
          <span>{options.find(o => o.value === value)?.label || value}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && menuPos && createPortal(
          <div
            className="settings-select__menu"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              minWidth: menuPos.minWidth,
              zIndex: 99999,
            }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                className={`settings-select__option${opt.value === value ? ' settings-select__option--active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`settings-sidebar__item${active ? ' settings-sidebar__item--active' : ''}`} onClick={onClick}>
      <span className="settings-sidebar__icon">{icon}</span>
      <span className="settings-sidebar__text">{label}</span>
    </button>
  );
}

export function SettingsModal() {
  const { settingsOpen, useWebGl } = useAppState();
  const dispatch = useAppDispatch();
  const { t, lang, setLang } = useTranslation();

  const [activeTab, setActiveTab] = useState<'general' | 'shortcuts'>('general');

  const [checkOnStartup, setCheckOnStartup] = useState(() => {
    try {
      const stored = localStorage.getItem('fit_check_on_startup');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<{ version: string; body?: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const statusTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen) {
      setUpdateStatus(null);
      setUpdateAvailable(null);
      setCheckingUpdate(false);
      setDownloading(false);
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (settingsOpen && checkOnStartup) {
      handleCheckUpdate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen]);

  if (!settingsOpen) return null;

  const handleClose = () => {
    dispatch({ type: 'TOGGLE_SETTINGS' });
  };

  const handleToggleCheckOnStartup = () => {
    const nextVal = !checkOnStartup;
    setCheckOnStartup(nextVal);
    try {
      localStorage.setItem('fit_check_on_startup', String(nextVal));
    } catch (e) {
      console.error('Failed to save updater preference:', e);
    }
  };

  const handleOpenUpdateModal = () => {
    if (updateAvailable) {
      dispatch({ type: 'TOGGLE_SETTINGS' });
      dispatch({
        type: 'SET_PENDING_UPDATE',
        payload: { version: updateAvailable.version, body: updateAvailable.body },
      });
    }
  };

  const handleCheckUpdate = async (silent = false) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setCheckingUpdate(true);
    setUpdateStatus(null);
    setUpdateAvailable(null);
    const startTime = Date.now();
    try {
      const result = await checkUpdate();
      
      // Enforce a minimum loader duration of 1800ms
      const elapsed = Date.now() - startTime;
      const minDuration = 1800;
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
      }

      if (result.error) {
        if (!silent) {
          setUpdateStatus(
            result.error === 'DEV_MODE'
              ? t('settings.updater.devMode')
              : result.error
          );
        }
      } else if (result.available) {
        setUpdateAvailable({ version: result.version, body: result.body });
        setUpdateStatus(t('settings.updater.available', { version: result.version }));
      } else {
        if (!silent) {
          setUpdateStatus(t('settings.latest'));
          statusTimeoutRef.current = setTimeout(() => {
            setUpdateStatus(null);
          }, 4000);
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      if (!silent) setUpdateStatus(t('settings.updater.failed'));
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    setDownloading(true);
    try {
      await installUpdate();
    } catch (err) {
      console.error('Install failed:', err);
      setDownloading(false);
    }
  };

  const handleToggleWebGl = () => {
    dispatch({ type: 'SET_USE_WEBGL', payload: !useWebGl });
  };

  const handleLanguageChange = (val: string) => {
    setLang(val as Lang);
  };

  return (
    <div className="settings-backdrop" onClick={handleClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <aside className="settings-sidebar">
          <div className="settings-sidebar__top">
            <SidebarItem
              active={activeTab === 'general'}
              onClick={() => setActiveTab('general')}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07 4.93l-4.24-4.24M6.34 6.34L2.1 2.1" />
                </svg>
              }
              label={t('settings.general')}
            />
            <SidebarItem
              active={activeTab === 'shortcuts'}
              onClick={() => setActiveTab('shortcuts')}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                </svg>
              }
              label={t('settings.shortcuts')}
            />
          </div>

          <div className="settings-sidebar__bottom">
            <span className="settings-sidebar__app-name">{t('settings.desktop')}</span>
            <span className="settings-sidebar__version">v{packageInfo.version}</span>
          </div>
        </aside>

        <main className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-content__inner">
              <h2 className="settings-content__title">{t('settings.general')}</h2>

              <section className="settings-section" style={{ animationDelay: '30ms' }}>
                <SelectRow
                  label={t('settings.language')}
                  description={t('settings.languageDesc')}
                  value={lang}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'it', label: 'Italiano' },
                    { value: 'es', label: 'Espanol' },
                    { value: 'fr', label: 'Francais' },
                    { value: 'de', label: 'Deutsch' },
                  ]}
                  onChange={handleLanguageChange}
                />
              </section>

              <section className="settings-section" style={{ animationDelay: '60ms' }}>
                <ToggleRow
                  label={t('settings.webgl')}
                  description={t('settings.webglDesc')}
                  checked={useWebGl}
                  onChange={handleToggleWebGl}
                />
              </section>

              <div className="settings-content__subtitle" style={{ animationDelay: '90ms' }}>{t('settings.updates')}</div>

              <section className="settings-section" style={{ animationDelay: '120ms' }}>
                <ToggleRow
                  label={t('settings.checkOnStartup')}
                  description={t('settings.checkOnStartupDesc')}
                  checked={checkOnStartup}
                  onChange={handleToggleCheckOnStartup}
                />
              </section>

              <section className="settings-section settings-section--action" style={{ animationDelay: '180ms' }}>
                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">{t('settings.checkUpdates')}</span>
                    <span className="settings-row__desc">{t('settings.checkUpdatesDesc')}</span>
                  </div>
                  <button
                    className={`settings-check-btn ${updateStatus === t('settings.latest') ? 'settings-check-btn--success' : ''} ${checkingUpdate ? 'settings-check-btn--loading' : ''}`}
                    onClick={() => handleCheckUpdate(false)}
                    disabled={checkingUpdate || downloading}
                  >
                    <span key={checkingUpdate ? 'loading' : updateStatus === t('settings.latest') ? 'success' : 'idle'} className="settings-check-btn__inner-content">
                      {checkingUpdate ? (
                        <span className="settings-check-btn__spinner" />
                      ) : updateStatus === t('settings.latest') ? (
                        <>
                          <svg className="settings-check-btn__success-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{t('settings.upToDate')}</span>
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M23 4v6h-6" />
                            <path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                          <span>{t('settings.checkNow')}</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>
                {updateStatus && updateStatus !== t('settings.latest') && (
                  <div className="settings-update-status">{updateStatus}</div>
                )}
                {updateAvailable && !downloading && (
                  <button
                    className="settings-check-btn"
                    onClick={handleOpenUpdateModal}
                    style={{ marginTop: 'var(--space-sm)', alignSelf: 'flex-start' }}
                  >
                    {t('settings.updater.view')}
                  </button>
                )}
              </section>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="settings-content__inner">
              <h2 className="settings-content__title">{t('settings.shortcuts')}</h2>
              <div className="settings-empty">
                <p>{t('settings.shortcutsSoon')}</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
