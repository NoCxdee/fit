/* ================================================================
   Fit — LivePreview Component
   ================================================================ */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { scanPorts } from '../../utils/ipc';

const PRESET_PORTS = [
  { name: 'Vite', port: 5173 },
  { name: 'Vite (alt)', port: 5174 },
  { name: 'Next.js', port: 3000 },
  { name: 'Next.js (alt)', port: 3001 },
  { name: 'Vite preview', port: 4173 },
  { name: 'Angular', port: 4200 },
  { name: 'Astro', port: 4321 },
  { name: 'Live Server', port: 5500 },
  { name: 'Storybook', port: 6006 },
  { name: 'Webpack', port: 8080 },
  { name: 'Metro', port: 8081 },
  { name: 'Django / FastAPI', port: 8000 },
  { name: 'Jupyter', port: 8888 },
  { name: 'Flask', port: 5000 },
  { name: 'Gradio', port: 7860 },
  { name: 'Ollama', port: 11434 },
];

export function LivePreview() {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [checkingPort, setCheckingPort] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(true);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const handleDropdownScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setShowTopGradient(target.scrollTop > 2);
    setShowBottomGradient(target.scrollTop + target.clientHeight < target.scrollHeight - 2);
  };

  useEffect(() => {
    if (showPortDropdown && dropdownRef.current) {
      const el = dropdownRef.current;
      const timer = setTimeout(() => {
        setShowTopGradient(el.scrollTop > 2);
        setShowBottomGradient(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showPortDropdown]);

  const handleSelectPort = async (port: number) => {
    setCheckingPort(port);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const active = await scanPorts();
      const isActive = active.some(p => p.port === port);
      
      if (isActive) {
        const targetUrl = `http://localhost:${port}`;
        setIframeUrl(targetUrl);
        setInputValue(targetUrl);
        setShowPortDropdown(false);
      } else {
        setAlertMessage(t('preview.noServer', { port }));
      }
    } catch (e) {
      console.error(e);
      setAlertMessage(t('preview.errorVerify', { port }));
    } finally {
      setCheckingPort(null);
    }
  };

  const handleRefresh = () => {
    const current = iframeUrl;
    setIframeUrl('');
    setTimeout(() => setIframeUrl(current), 50);
  };

  const handleUrlSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget as HTMLInputElement;
      let value = input.value.trim();
      if (!value) return;
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        value = `http://${value}`;
      }

      try {
        const parsedUrl = new URL(value);
        const currentOrigin = window.location.origin;
        const parsedOrigin = parsedUrl.origin;
        if (parsedOrigin === currentOrigin || parsedUrl.port === window.location.port) {
          setAlertMessage(t('preview.recursive'));
          return;
        }
      } catch (e) {}

      setIframeUrl(value);
      setInputValue(value);
    }
  };

  return (
    <div className="preview-container">
      <div className="preview-toolbar">
        <button className="preview-toolbar__btn" onClick={handleRefresh} title={t('preview.refresh')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="preview-toolbar__ports"
            onClick={() => setShowPortDropdown(!showPortDropdown)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {t('preview.ports')}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showPortDropdown && (
            <div className="port-dropdown-container">
              <div className={`port-dropdown__scroll-gradient port-dropdown__scroll-gradient--top ${showTopGradient ? 'visible' : ''}`} />
              <div
                ref={dropdownRef}
                className="port-dropdown"
                onScroll={handleDropdownScroll}
              >
                {PRESET_PORTS.map(({ name, port }) => (
                  <button
                    key={port}
                    className="port-dropdown__item"
                    onClick={() => checkingPort === null && handleSelectPort(port)}
                    disabled={checkingPort !== null}
                  >
                    <span>{name}</span>
                    {checkingPort === port ? (
                      <span className="port-dropdown__checking">{t('preview.checking')}</span>
                    ) : (
                      <span className="port-dropdown__item-port">:{port}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className={`port-dropdown__scroll-gradient port-dropdown__scroll-gradient--bottom ${showBottomGradient ? 'visible' : ''}`} />
            </div>
          )}
        </div>

        <input
          className="preview-toolbar__url"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleUrlSubmit}
          placeholder={t('preview.placeholder')}
        />

        <button
          className="preview-toolbar__btn"
          onClick={() => iframeUrl && window.open(iframeUrl, '_blank')}
          title={t('preview.openBrowser')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      </div>

      {iframeUrl ? (
        <iframe
          className="preview-iframe"
          src={iframeUrl}
          title="Live Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : (
        <div className="preview-empty">
          <div className="preview-empty__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div className="preview-empty__title">{t('preview.nothing')}</div>
          <div className="preview-empty__desc">
            {t('preview.subtitle', { ports: t('preview.ports') })}
          </div>
        </div>
      )}

      {showPortDropdown && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setShowPortDropdown(false)}
        />
      )}

      {alertMessage && (
        <div className="preview-alert-overlay">
          <div className="preview-alert-card">
            <div className="preview-alert-header">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{t('preview.portUnreachable')}</span>
            </div>
            <div className="preview-alert-body">
              {alertMessage}
            </div>
            <div className="preview-alert-actions">
              <button className="preview-alert-btn" onClick={() => setAlertMessage(null)}>
                {t('preview.dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
