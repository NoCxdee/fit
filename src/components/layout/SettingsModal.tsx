/* ================================================================
   Fit — SettingsModal Component
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listen } from '@tauri-apps/api/event';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation, type Lang } from '../../i18n';
import { checkUpdate, installUpdate, getModelStatus, downloadModel, deleteModel } from '../../utils/ipc';
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
  const { 
    settingsOpen, useWebGl, sttShortcut, sttMicId, sttVolume, sttPushToTalk,
    sttAutoUnload, sttOverlayPos, sttPasteMethod, sttMuteSystem 
  } = useAppState();
  const dispatch = useAppDispatch();
  const { t, lang, setLang } = useTranslation();

  const [activeTab, setActiveTab] = useState<'general' | 'speech'>('general');
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [modelStatus, setModelStatus] = useState<{ downloaded: boolean; loaded: boolean; sizeBytes: number; path: string } | null>(null);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [isShortcutBinding, setIsShortcutBinding] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);


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

  const checkModelStatus = async () => {
    try {
      const status = await getModelStatus();
      setModelStatus(status);
    } catch (e) {
      console.error('Failed to get model status:', e);
    }
  };

  useEffect(() => {
    if (settingsOpen) {
      checkModelStatus();
      
      // Request mic permission to get real device names
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Stop stream tracks immediately so the microphone indicator doesn't stay active in OS
          stream.getTracks().forEach(track => track.stop());
          return navigator.mediaDevices.enumerateDevices();
        })
        .then(devices => {
          const mics = devices.filter(d => d.kind === 'audioinput');
          // Deduplicate by groupId so the same physical mic doesn't appear multiple times
          const seen = new Set<string>();
          const unique = mics.filter(m => {
            if (!m.groupId || seen.has(m.groupId)) return false;
            seen.add(m.groupId);
            return true;
          });
          setMicrophones(unique.length > 0 ? unique : mics);
        })
        .catch(err => {
          console.warn('Microphone permission request failed or rejected, listing default names:', err);
          // Fallback: enumerate whatever is accessible without explicit label permission
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const mics = devices.filter(d => d.kind === 'audioinput');
            const seen = new Set<string>();
            const unique = mics.filter(m => {
              if (!m.groupId || seen.has(m.groupId)) return false;
              seen.add(m.groupId);
              return true;
            });
            setMicrophones(unique.length > 0 ? unique : mics);
          });
        });
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;

    let unlistenProgress: any = null;
    let unlistenComplete: any = null;

    async function bindListeners() {
      unlistenProgress = await listen<number>('model-download-progress', (e) => {
        setModelProgress(e.payload);
      });
      unlistenComplete = await listen<void>('model-download-complete', () => {
        setModelProgress(null);
        checkModelStatus();
      });
    }

    bindListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
    };
  }, [settingsOpen]);

  // Listen for keydown when binding shortcut
  useEffect(() => {
    if (!isShortcutBinding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys: string[] = [];
      if (e.ctrlKey) keys.push('Control');
      if (e.shiftKey) keys.push('Shift');
      if (e.altKey) keys.push('Alt');
      if (e.metaKey) keys.push('Meta');

      // Filter out modifier names from e.key
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        const keyName = e.key === ' ' ? 'Space' : e.key;
        keys.push(keyName);
      }

      if (keys.length > 0) {
        const binding = keys.join('+');
        dispatch({ type: 'SET_STT_SHORTCUT', payload: binding });
        setIsShortcutBinding(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isShortcutBinding, dispatch]);

  const handleModelDownload = async () => {
    try {
      setModelProgress(0);
      await downloadModel();
    } catch (e) {
      console.error(e);
      setModelProgress(null);
    }
  };

  const handleModelDelete = async () => {
    try {
      await deleteModel();
      checkModelStatus();
      setIsConfirmingDelete(false);
    } catch (e) {
      console.error(e);
    }
  };

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
      setIsShortcutBinding(false);
      setIsConfirmingDelete(false);
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    }
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
        // Automatically open the update modal directly
        dispatch({ type: 'TOGGLE_SETTINGS' });
        dispatch({
          type: 'SET_PENDING_UPDATE',
          payload: { version: result.version, body: result.body },
        });
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
              active={activeTab === 'speech'}
              onClick={() => setActiveTab('speech')}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              }
              label={t('settings.speech')}
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

          {activeTab === 'speech' && (
            <div className="settings-content__inner">
              <h2 className="settings-content__title">{t('settings.speech')}</h2>

              <div className="settings-content__subtitle" style={{ animationDelay: '30ms' }}>{t('settings.stt.model')}</div>
              
              <section className="settings-section" style={{ animationDelay: '60ms' }}>
                <div className="stt-model-card">
                  <div className="stt-model-card__header">
                    <div className="stt-model-card__title-row">
                      <span className="stt-model-card__title">Parakeet V3</span>
                      {modelStatus?.downloaded ? (
                        <span className="stt-model-badge stt-model-badge--active">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{t('settings.stt.modelActive')}</span>
                        </span>
                      ) : modelProgress !== null ? (
                        <span className="stt-model-badge stt-model-badge--downloading">
                          <span className="stt-model-badge__spinner" />
                          <span>{t('settings.stt.modelDownloading')} {Math.round(modelProgress)}%</span>
                        </span>
                      ) : (
                        <button className="stt-model-download-btn" onClick={handleModelDownload}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" x2="12" y1="15" y2="3" />
                          </svg>
                          <span>{t('settings.stt.modelDownload')} (456 MB)</span>
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <span className="stt-model-card__desc">Veloce e accurato</span>
                    </div>
                  </div>

                  <div className="stt-model-card__footer">
                    <div className="stt-model-card__footer-left">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <span>{t('settings.stt.multilingual')}</span>
                    </div>
                    {modelStatus?.downloaded && (
                      isConfirmingDelete ? (
                        <div className="stt-model-delete-confirm">
                          <span className="stt-model-delete-confirm__msg">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stt-model-delete-confirm__icon">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            <span>{lang === 'it' ? 'Eliminare?' : 'Delete?'}</span>
                          </span>
                          <div className="stt-model-delete-confirm__actions">
                            <button 
                              className="stt-model-btn stt-model-btn--confirm-delete" 
                              onClick={handleModelDelete}
                            >
                              {lang === 'it' ? 'Sì' : 'Yes'}
                            </button>
                            <button 
                              className="stt-model-btn stt-model-btn--cancel" 
                              onClick={() => setIsConfirmingDelete(false)}
                            >
                              {lang === 'it' ? 'No' : 'No'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="stt-model-delete-btn" onClick={() => setIsConfirmingDelete(true)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                          <span>{t('settings.stt.modelDelete')}</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </section>

              <div className="settings-content__subtitle" style={{ animationDelay: '90ms' }}>{t('settings.stt.microphone')}</div>

              <section className="settings-section" style={{ animationDelay: '120ms' }}>
                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">{t('settings.stt.microphoneDesc')}</span>
                  </div>
                  <div className="settings-select" style={{ minWidth: '180px' }}>
                    <select 
                      className="settings-select__native" 
                      value={sttMicId} 
                      onChange={(e) => dispatch({ type: 'SET_STT_MIC_ID', payload: e.target.value })}
                      style={{
                        width: '100%',
                        background: 'var(--color-canvas-soft)',
                        border: '1px solid var(--color-hairline)',
                        color: 'var(--color-primary)',
                        padding: '5px var(--space-sm)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-caption)',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="default">{lang === 'it' ? 'Dispositivo predefinito' : 'Default device'}</option>
                      {microphones.map(mic => {
                        // Clean label: remove USB hardware IDs like "(03f0:078b)" or "(xxxx:yyyy)"
                        const cleanLabel = (mic.label || `Microphone (${mic.deviceId.slice(0, 5)}...)`)
                          .replace(/\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)\s*/g, '')
                          .trim();
                        return (
                          <option key={mic.deviceId} value={mic.deviceId}>{cleanLabel}</option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </section>

              <section className="settings-section" style={{ animationDelay: '150ms' }}>
                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">{t('settings.stt.pushToTalk')}</span>
                    <span className="settings-row__desc">{t('settings.stt.pushToTalkDesc')}</span>
                  </div>
                  <Toggle 
                    checked={sttPushToTalk} 
                    onChange={() => dispatch({ type: 'SET_STT_PUSH_TO_TALK', payload: !sttPushToTalk })} 
                  />
                </div>
              </section>

              <section className="settings-section" style={{ animationDelay: '200ms' }}>
                <ToggleRow
                  label={t('settings.stt.muteSystem')}
                  description={t('settings.stt.muteSystemDesc')}
                  checked={sttMuteSystem}
                  onChange={() => dispatch({ type: 'SET_STT_MUTE_SYSTEM', payload: !sttMuteSystem })}
                />
              </section>

              <div className="settings-content__subtitle" style={{ animationDelay: '220ms' }}>{lang === 'it' ? 'Avanzate' : 'Advanced'}</div>

              <section className="settings-section" style={{ animationDelay: '240ms' }}>
                <SelectRow
                  label={t('settings.stt.autoUnload')}
                  description={t('settings.stt.autoUnloadDesc')}
                  value={sttAutoUnload}
                  options={[
                    { value: 'immediate', label: lang === 'it' ? 'Immediatamente' : 'Immediate' },
                    { value: '5min', label: lang === 'it' ? 'Dopo 5 minuti' : 'After 5 minutes' },
                    { value: '10min', label: lang === 'it' ? 'Dopo 10 minuti' : 'After 10 minutes' },
                    { value: 'never', label: lang === 'it' ? 'Mai' : 'Never' },
                  ]}
                  onChange={(val) => dispatch({ type: 'SET_STT_AUTO_UNLOAD', payload: val as any })}
                />
              </section>

              <section className="settings-section" style={{ animationDelay: '260ms' }}>
                <SelectRow
                  label={t('settings.stt.overlayPos')}
                  description={t('settings.stt.overlayPosDesc')}
                  value={sttOverlayPos}
                  options={[
                    { value: 'bottom', label: lang === 'it' ? 'In basso' : 'Bottom' },
                    { value: 'top', label: lang === 'it' ? 'In alto' : 'Top' },
                    { value: 'center', label: lang === 'it' ? 'Al centro' : 'Center' },
                    { value: 'none', label: lang === 'it' ? 'Nessuna' : 'None' },
                  ]}
                  onChange={(val) => dispatch({ type: 'SET_STT_OVERLAY_POS', payload: val as any })}
                />
              </section>

              <section className="settings-section" style={{ animationDelay: '280ms' }}>
                <SelectRow
                  label={t('settings.stt.pasteMethod')}
                  description={t('settings.stt.pasteMethodDesc')}
                  value={sttPasteMethod}
                  options={[
                    { value: 'clipboard', label: lang === 'it' ? 'Appunti (Ctrl+V)' : 'Clipboard (Ctrl+V)' },
                    { value: 'direct', label: lang === 'it' ? 'Digitazione diretta' : 'Direct typing' },
                  ]}
                  onChange={(val) => dispatch({ type: 'SET_STT_PASTE_METHOD', payload: val as any })}
                />
              </section>

              <div className="settings-content__subtitle" style={{ animationDelay: '300ms' }}>{t('settings.shortcuts')}</div>

              <section className="settings-section" style={{ animationDelay: '320ms' }}>
                <div className="settings-row">
                  <div className="settings-row__text">
                    <span className="settings-row__label">{t('settings.stt.shortcut')}</span>
                    <span className="settings-row__desc">{t('settings.stt.shortcutDesc')}</span>
                  </div>
                  <button 
                    className={`settings-check-btn ${isShortcutBinding ? 'settings-check-btn--loading' : ''}`}
                    onClick={() => setIsShortcutBinding(!isShortcutBinding)}
                    style={{ minWidth: '120px' }}
                  >
                    {isShortcutBinding ? (
                      <span>{lang === 'it' ? 'Premi tasto...' : 'Press key...'}</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{sttShortcut}</span>
                    )}
                  </button>
                </div>
              </section>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
