/* ================================================================
   Fit — SettingsModal Component
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation, type Lang } from '../../i18n';
import { checkUpdate, installUpdate } from '../../utils/ipc';
import packageInfo from '../../../package.json';
import { useDictation, type ModelInfo } from '../../hooks/useDictation';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <label className={`settings-toggle${disabled ? ' settings-toggle--disabled' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
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
  disabled,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  disabled?: boolean;
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
    if (open && !disabled) {
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
  }, [open, disabled]);

  return (
    <div className="settings-row" style={disabled ? { opacity: 0.5 } : undefined}>
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      <div className="settings-select" style={disabled ? { pointerEvents: 'none', cursor: 'not-allowed' } : undefined}>
        <button ref={triggerRef} className="settings-select__trigger" onClick={() => !disabled && setOpen(!open)} disabled={disabled}>
          <span>{options.find(o => o.value === value)?.label || value}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && !disabled && menuPos && createPortal(
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

function ShortcutRow({
  label,
  description,
  value,
  onChange,
  recordingPlaceholder,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (val: string) => void;
  recordingPlaceholder: string;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const lowerKey = e.key.toLowerCase();
      if (['control', 'shift', 'alt', 'meta'].includes(lowerKey)) {
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');

      let keyName = e.key;
      if (keyName === ' ') {
        keyName = 'Space';
      } else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
      } else {
        keyName = keyName.charAt(0).toUpperCase() + keyName.slice(1);
      }

      parts.push(keyName);
      const comboStr = parts.join('+');
      onChange(comboStr);
      setIsRecording(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isRecording, onChange]);

  useEffect(() => {
    if (!isRecording) return;

    function handleClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsRecording(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRecording]);

  return (
    <div className="settings-row">
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      <div className="settings-shortcut-recorder">
        <button
          ref={buttonRef}
          className={`settings-shortcut-btn recording-shortcut-input ${isRecording ? 'settings-shortcut-btn--recording' : ''}`}
          onClick={() => setIsRecording(!isRecording)}
        >
          {isRecording ? recordingPlaceholder : value || 'None'}
        </button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="settings-row" style={disabled ? { opacity: 0.5 } : undefined}>
      <div className="settings-row__text">
        <span className="settings-row__label">{label}</span>
        {description && <span className="settings-row__desc">{description}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
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
    settingsOpen, useWebGl, autoSave, linkOpeningMode
  } = useAppState();
  const dispatch = useAppDispatch();
  const { t, lang, setLang } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'dictation'>('general');
  const dictation = useDictation();
  const filteredModels = dictation.models.filter(model => model.id === 'parakeet-tdt-0.6b-v3');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const renderModelCard = (model: ModelInfo) => {
    const isSelected = dictation.settings?.selectedModel === model.id;
    const isDownloaded = model.is_downloaded;
    const pct = dictation.downloadProgress[model.id];
    const phase = dictation.downloadPhase[model.id];
    const isDownloading = pct !== undefined || phase !== undefined;
    const isLoading = dictation.modelLoadingState.activeModelId === model.id && dictation.modelLoadingState.isLoading;
    const isLoaded = dictation.modelLoadingState.activeModelId === model.id && !dictation.modelLoadingState.isLoading;

    return (
      <div key={model.id} className={`settings-model-card ${isSelected ? 'settings-model-card--selected' : ''} ${isDownloaded ? 'settings-model-card--downloaded' : ''}`}>
        {/* Top row: name + badges + size */}
        <div className="settings-model-card__header">
          <div className="settings-model-card__title-row">
            <span className="settings-model-card__name">{model.name}</span>
            {model.is_recommended && (
              <span className="settings-model-card__badge settings-model-card__badge--recommended">
                {t('settings.dictation.recommended')}
              </span>
            )}
            {isLoaded && (
              <span className="settings-model-card__badge settings-model-card__badge--loaded">
                {t('settings.dictation.ramActive')}
              </span>
            )}
            {isLoading && (
              <span className="settings-model-card__badge settings-model-card__badge--loading">
                {t('settings.dictation.loadingRam')}
              </span>
            )}
          </div>
          <span className="settings-model-card__size">{model.size_mb} MB</span>
        </div>

        {/* Description */}
        <p className="settings-model-card__desc">{model.description}</p>

        {/* Download progress bar */}
        {isDownloading && (
          <div className="settings-model-card__progress">
            <div className="settings-model-card__progress-text">
              <span>
                {phase === 'verifying' ? t('settings.dictation.verifying')
                  : phase === 'extracting' ? t('settings.dictation.extracting')
                  : t('settings.dictation.downloading')}
              </span>
              {phase === 'downloading' || !phase ? (
                <span>{pct ?? 0}%</span>
              ) : null}
            </div>
            <div className="settings-model-card__progress-bar">
              {phase === 'verifying' || phase === 'extracting' ? (
                <div className="settings-model-card__progress-fill settings-model-card__progress-fill--indeterminate" />
              ) : (
                <div 
                  className="settings-model-card__progress-fill" 
                  style={{ width: `${pct ?? 0}%` }} 
                />
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="settings-model-card__actions">
          {isDownloaded ? (
            <>
              {isSelected ? (
                <button className="settings-model-card__btn settings-model-card__btn--active" disabled>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: '4px' }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t('settings.dictation.active')}
                </button>
              ) : (
                <button 
                  className="settings-model-card__btn settings-model-card__btn--select"
                  onClick={() => dictation.selectModel(model.id)}
                  disabled={isLoading}
                >
                  {t('settings.dictation.select')}
                </button>
              )}

              {isLoaded && (
                <button 
                  className="settings-model-card__btn settings-model-card__btn--unload"
                  onClick={() => dictation.unloadModel()}
                  title="Unload from RAM to free memory"
                >
                  {t('settings.dictation.freeRam')}
                </button>
              )}

              <div style={{ flex: 1 }} />

              {confirmDeleteId === model.id ? (
                <div className="settings-model-card__confirm-bar">
                  <span className="settings-model-card__confirm-text">
                    {t('settings.dictation.deleteConfirm')
                      .replace('{name}', model.name)
                      .replace('{size}', String(model.size_mb))}
                  </span>
                  <div className="settings-model-card__confirm-actions">
                    <button
                      className="settings-model-card__btn settings-model-card__btn--confirm-yes"
                      onClick={() => {
                        dictation.deleteModel(model.id);
                        setConfirmDeleteId(null);
                      }}
                    >
                      {t('settings.dictation.delete')}
                    </button>
                    <button
                      className="settings-model-card__btn settings-model-card__btn--confirm-no"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  className="settings-model-card__btn settings-model-card__btn--delete"
                  onClick={() => setConfirmDeleteId(model.id)}
                  title={t('settings.dictation.delete')}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  <span>{t('settings.dictation.delete')}</span>
                </button>
              )}
            </>
          ) : (
            <>
              {isDownloading ? (
                <>
                  {(!phase || phase === 'downloading') && (
                    <button 
                      className="settings-model-card__btn settings-model-card__btn--cancel"
                      onClick={() => dictation.cancelDownload(model.id)}
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : (
                <button 
                  className="settings-model-card__btn settings-model-card__btn--download"
                  onClick={() => dictation.downloadModel(model.id)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '5px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {t('settings.dictation.download')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

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
    if (settingsOpen) {
      dictation.refreshDevices();
    } else {
      setUpdateStatus(null);
      setUpdateAvailable(null);
      setCheckingUpdate(false);
      setDownloading(false);
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    }
  }, [settingsOpen, dictation.refreshDevices]);



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

  const handleToggleAutoSave = () => {
    dispatch({ type: 'SET_AUTO_SAVE', payload: !autoSave });
  };

  const handleLanguageChange = (val: string) => {
    setLang(val as Lang);
  };

  const handleLinkOpeningModeChange = (val: string) => {
    dispatch({ type: 'SET_LINK_OPENING_MODE', payload: val as 'browser' | 'preview' });
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
              active={activeTab === 'dictation'}
              onClick={() => setActiveTab('dictation')}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              }
              label={t('settings.dictation')}
            />
          </div>

          <div className="settings-sidebar__bottom">
            <span className="settings-sidebar__app-name">{t('settings.desktop')}</span>
            <span className="settings-sidebar__version">v{packageInfo.version}</span>
          </div>
        </aside>

        <main className="settings-content">
          <div className="settings-content__inner">
            {activeTab === 'general' && (
              <>
                <h2 className="settings-content__title">{t('settings.general')}</h2>

                <section className="settings-section" style={{ animationDelay: '30ms' }}>
                  <SelectRow
                    label={t('settings.language')}
                    description={t('settings.languageDesc')}
                    value={lang}
                    options={[
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Espanol' },
                      { value: 'fr', label: 'Francais' },
                      { value: 'de', label: 'Deutsch' },
                    ]}
                    onChange={handleLanguageChange}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '45ms' }}>
                  <SelectRow
                    label={t('settings.linkOpeningMode')}
                    description={t('settings.linkOpeningModeDesc')}
                    value={linkOpeningMode || 'browser'}
                    options={[
                      { value: 'browser', label: t('settings.linkOpeningMode.browser') },
                      { value: 'preview', label: t('settings.linkOpeningMode.preview') },
                    ]}
                    onChange={handleLinkOpeningModeChange}
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

                <div className="settings-content__subtitle" style={{ animationDelay: '75ms' }}>{t('settings.codeEditor')}</div>

                <section className="settings-section" style={{ animationDelay: '90ms' }}>
                  <ToggleRow
                    label={t('settings.autosave')}
                    description={t('settings.autosaveDesc')}
                    checked={autoSave}
                    onChange={handleToggleAutoSave}
                  />
                </section>

                <div className="settings-content__subtitle" style={{ animationDelay: '105ms' }}>{t('settings.updates')}</div>

                <section className="settings-section" style={{ animationDelay: '120ms' }}>
                  <ToggleRow
                    label={t('settings.checkOnStartup')}
                    description={t('settings.checkOnStartupDesc')}
                    checked={checkOnStartup}
                    onChange={handleToggleCheckOnStartup}
                  />
                </section>

                <section className="settings-section settings-section--action" style={{ animationDelay: '135ms' }}>
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
              </>
            )}

            {activeTab === 'dictation' && (
              <>
                <h2 className="settings-content__title">{t('settings.dictation.title')}</h2>

                {/* ── Shortcut & Popup Position Row ── */}
                <section className="settings-section" style={{ animationDelay: '30ms' }}>
                  <ShortcutRow
                    label={t('settings.dictation.hotkey')}
                    description={t('settings.dictation.hotkeyDesc')}
                    value={dictation.shortcut}
                    onChange={(val) => dictation.setShortcut(val)}
                    recordingPlaceholder={t('settings.dictation.hotkeyRecording')}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '60ms' }}>
                  <SelectRow
                    label={t('settings.dictation.popupPosition')}
                    description={t('settings.dictation.popupPositionDesc')}
                    value={dictation.popupPosition}
                    options={[
                      { value: 'bottom-left', label: t('settings.dictation.posBottomLeft') },
                      { value: 'bottom-center', label: t('settings.dictation.posBottomCenter') },
                      { value: 'bottom-right', label: t('settings.dictation.posBottomRight') },
                      { value: 'top-left', label: t('settings.dictation.posTopLeft') },
                      { value: 'top-center', label: t('settings.dictation.posTopCenter') },
                      { value: 'top-right', label: t('settings.dictation.posTopRight') },
                    ]}
                    onChange={(val) => dictation.setPopupPosition(val)}
                  />
                </section>

                {/* ── Audio Settings ── */}
                <div className="settings-content__subtitle" style={{ animationDelay: '90ms' }}>Audio & Engine</div>

                <section className="settings-section" style={{ animationDelay: '120ms' }}>
                  <SelectRow
                    label={t('settings.dictation.mic')}
                    description={t('settings.dictation.micDesc')}
                    value={dictation.settings?.selectedMicrophone || 'default'}
                    options={dictation.microphones.map(mic => ({
                      value: mic.name === 'Default' ? 'default' : mic.name,
                      label: mic.name
                    }))}
                    onChange={(val) => dictation.updateSetting('selectedMicrophone', val === 'default' ? null : val)}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '150ms' }}>
                  <SelectRow
                    label={t('settings.dictation.mode')}
                    description={t('settings.dictation.modeDesc')}
                    value={dictation.settings?.alwaysOnMicrophone ? 'always_on' : 'on_demand'}
                    options={[
                      { value: 'on_demand', label: t('settings.dictation.onDemand') },
                      { value: 'always_on', label: t('settings.dictation.alwaysOn') },
                    ]}
                    onChange={(val) => dictation.updateSetting('alwaysOnMicrophone', val === 'always_on')}
                    disabled={true}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '180ms' }}>
                  <SelectRow
                    label={t('settings.dictation.language')}
                    description={t('settings.dictation.languageDesc')}
                    value={dictation.settings?.selectedLanguage || 'auto'}
                    options={[
                      { value: 'auto', label: 'Auto Detect' },
                      { value: 'en', label: 'English' },
                      { value: 'es', label: 'Español' },
                      { value: 'fr', label: 'Français' },
                      { value: 'de', label: 'Deutsch' }
                    ]}
                    onChange={(val) => dictation.updateSetting('selectedLanguage', val)}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '210ms' }}>
                  <SelectRow
                    label={t('settings.dictation.unload')}
                    description={t('settings.dictation.unloadDesc')}
                    value={dictation.settings?.modelUnloadTimeout || 'immediately'}
                    options={[
                      { value: 'immediately', label: 'Immediately' },
                      { value: 'sec_15', label: '15 Seconds' },
                      { value: 'min_2', label: '2 Minutes' },
                      { value: 'min_5', label: '5 Minutes' },
                      { value: 'min_10', label: '10 Minutes' },
                      { value: 'min_15', label: '15 Minutes' },
                      { value: 'hour_1', label: '1 Hour' },
                      { value: 'never', label: 'Never' },
                    ]}
                    onChange={(val) => dictation.updateSetting('modelUnloadTimeout', val as any)}
                    disabled={true}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '240ms' }}>
                  <SelectRow
                    label={t('settings.dictation.accelerator')}
                    description={t('settings.dictation.acceleratorDesc')}
                    value={dictation.settings?.ortAccelerator || 'auto'}
                    options={[
                      { value: 'auto', label: 'Auto (Recommended)' },
                      { value: 'cpu', label: 'CPU (Universal)' },
                      { value: 'directml', label: 'GPU (DirectML)' }
                    ]}
                    onChange={(val) => dictation.updateSetting('ortAccelerator', val as any)}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '260ms' }}>
                  <ToggleRow
                    label={t('settings.dictation.muteSystem')}
                    description={t('settings.dictation.muteSystemDesc')}
                    checked={dictation.settings?.muteWhileRecording || false}
                    disabled={dictation.settings?.dictationFeedbackSound ?? true}
                    onChange={() => {
                      const current = dictation.settings?.muteWhileRecording || false;
                      if (!current && (dictation.settings?.dictationFeedbackSound ?? true)) {
                        dictation.updateSetting('dictationFeedbackSound', false);
                      }
                      dictation.updateSetting('muteWhileRecording', !current);
                    }}
                  />
                </section>

                <section className="settings-section" style={{ animationDelay: '260ms' }}>
                  <ToggleRow
                    label={t('settings.dictation.feedbackSound')}
                    description={t('settings.dictation.feedbackSoundDesc')}
                    checked={dictation.settings?.dictationFeedbackSound ?? true}
                    disabled={dictation.settings?.muteWhileRecording || false}
                    onChange={() => {
                      const current = dictation.settings?.dictationFeedbackSound ?? true;
                      if (!current && (dictation.settings?.muteWhileRecording || false)) {
                        dictation.updateSetting('muteWhileRecording', false);
                      }
                      dictation.updateSetting('dictationFeedbackSound', !current);
                    }}
                  />
                </section>

                {/* ── Models ── */}
                {filteredModels.some(m => m.is_downloaded) && (
                  <>
                    <div className="settings-content__subtitle" style={{ animationDelay: '270ms' }}>
                      {t('settings.dictation.downloadedHeader')}
                    </div>
                    <div className="settings-models-list" style={{ animationDelay: '290ms', marginBottom: 'var(--space-lg)' }}>
                      {filteredModels
                        .filter(model => model.is_downloaded)
                        .map(model => renderModelCard(model))}
                    </div>
                  </>
                )}

                {filteredModels.some(m => !m.is_downloaded && m.is_recommended) && (
                  <>
                    <div className="settings-content__subtitle" style={{ animationDelay: '310ms' }}>
                      {t('settings.dictation.recommendedHeader')}
                    </div>
                    <div className="settings-models-list" style={{ animationDelay: '330ms', marginBottom: 'var(--space-lg)' }}>
                      {filteredModels
                        .filter(model => !model.is_downloaded && model.is_recommended)
                        .map(model => renderModelCard(model))}
                    </div>
                  </>
                )}

                {filteredModels.some(m => !m.is_downloaded && !m.is_recommended) && (
                  <>
                    <div className="settings-content__subtitle" style={{ animationDelay: '350ms' }}>
                      {t('settings.dictation.otherHeader')}
                    </div>
                    <div className="settings-models-list" style={{ animationDelay: '370ms' }}>
                      {filteredModels
                        .filter(model => !model.is_downloaded && !model.is_recommended)
                        .map(model => renderModelCard(model))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
