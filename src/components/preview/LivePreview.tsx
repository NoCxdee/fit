/* ================================================================
   Fit — LivePreview Component
   ================================================================ */

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { scanPorts, ptyWrite } from '../../utils/ipc';
import { useAppState, useAppDispatch } from '../../stores/appStore';

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
  const { inspectorMode, sessions, activeSessionId } = useAppState();
  const dispatch = useAppDispatch();
  const [inputValue, setInputValue] = useState('');
  const [iframeUrl, setIframeUrl] = useState('');
  const [showPortDropdown, setShowPortDropdown] = useState(false);
  const [checkingPort, setCheckingPort] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [alertTitle, setAlertTitle] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'warning' | 'success'>('warning');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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

  // Handle messages from the injected script
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      console.log('[FIT DEBUG] Parent received message:', e.data);
      if (e.data && e.data.type === 'FIT_INSPECTOR_CAPTURED') {
        let text = e.data.payload;
        if (typeof text === 'string') {
          text = text.trim();
          console.log('[FIT DEBUG] Captured element path/text:', text);
          try {
            navigator.clipboard.writeText(text);
          } catch (err) {
            console.error('Failed to copy to clipboard:', err);
          }
          dispatch({ type: 'SET_CAPTURED_ELEMENT', payload: text });
        }
      } else if (e.data && e.data.type === 'FIT_INSPECTOR_READY') {
        console.log('[FIT DEBUG] Iframe script ready. Syncing inspectorMode:', inspectorMode);
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'FIT_TOGGLE_INSPECTOR', payload: inspectorMode }, '*');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dispatch, inspectorMode]);

  // Handle escape key to cancel inspector mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectorMode) {
        console.log('[FIT DEBUG] Escape pressed. Toggling inspector mode off.');
        dispatch({ type: 'SET_INSPECTOR_MODE', payload: false });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectorMode, dispatch]);

  // Reset inspector mode when preview mounts
  useEffect(() => {
    dispatch({ type: 'SET_INSPECTOR_MODE', payload: false });
  }, [dispatch]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const sessionPreviewUrl = activeSession?.previewUrl || '';

  useEffect(() => {
    if (sessionPreviewUrl) {
      setIframeUrl(sessionPreviewUrl);
      setInputValue(sessionPreviewUrl);
    }
  }, [sessionPreviewUrl]);

  const toggleInspectorMode = () => {
    const newMode = !inspectorMode;
    console.log('[FIT DEBUG] toggleInspectorMode called. Current inspectorMode:', inspectorMode, 'New mode:', newMode);
    dispatch({ type: 'SET_INSPECTOR_MODE', payload: newMode });
    // Tell iframe to toggle if we can't reach document directly (requires user setup in their app or successful injection)
    if (iframeRef.current && iframeRef.current.contentWindow) {
      console.log('[FIT DEBUG] Sending FIT_TOGGLE_INSPECTOR to iframe with payload:', newMode);
      iframeRef.current.contentWindow.postMessage({ type: 'FIT_TOGGLE_INSPECTOR', payload: newMode }, '*');
    } else {
      console.log('[FIT DEBUG] Cannot send postMessage: iframeRef or contentWindow is missing/null', {
        iframeRefExists: !!iframeRef.current,
        contentWindowExists: !!iframeRef.current?.contentWindow
      });
    }
  };

  const handleIframeLoad = () => {
    console.log('[FIT DEBUG] handleIframeLoad fired. iframeRef.current exists:', !!iframeRef.current);
    if (!iframeRef.current) return;
    try {
      console.log('[FIT DEBUG] Trying to access contentDocument...');
      const doc = iframeRef.current.contentDocument;
      console.log('[FIT DEBUG] Access to contentDocument successful. doc is truthy:', !!doc);
      
      let isAboutBlank = true;
      if (doc) {
        try {
          isAboutBlank = doc.location.href === 'about:blank';
        } catch (e) {
          isAboutBlank = false;
        }
      }

      if (doc && !isAboutBlank) {
        // We have access! Inject our inspector script.
        const script = doc.createElement('script');
        script.innerHTML = `
          console.log('[FIT DEBUG Iframe] Script initialized inside iframe.');
          if (!window.__FIT_INSPECTOR_INIT__) {
            window.__FIT_INSPECTOR_INIT__ = true;
            window.__fit_inspector_active = false;
            console.log('[FIT DEBUG Iframe] Initialized window.__fit_inspector_active to false.');
 
            const style = document.createElement('style');
            style.innerHTML = \`
              .fit-inspector-hover {
                outline: 2px dashed #d4a857 !important;
                outline-offset: -2px !important;
                background-color: rgba(212, 168, 87, 0.2) !important;
                cursor: crosshair !important;
              }
            \`;
            document.head.appendChild(style);
 
            const overHandler = (e) => {
              console.log('[FIT DEBUG Iframe] mouseover. active:', window.__fit_inspector_active, 'target:', e.target);
              if (!window.__fit_inspector_active) return;
              e.stopPropagation();
              e.target.classList.add('fit-inspector-hover');
            };
            const outHandler = (e) => {
              if (!window.__fit_inspector_active) return;
              e.target.classList.remove('fit-inspector-hover');
            };
            const clickHandler = (e) => {
              console.log('[FIT DEBUG Iframe] click. active:', window.__fit_inspector_active, 'target:', e.target);
              if (!window.__fit_inspector_active) return;
              e.preventDefault();
              e.stopPropagation();
              
              const target = e.target;
              const data = target.outerHTML;
              
              console.log('[FIT DEBUG Iframe] Captured data to post:', data);
              target.classList.remove('fit-inspector-hover');
              window.parent.postMessage({ type: 'FIT_INSPECTOR_CAPTURED', payload: data }, '*');
            };
 
            document.body.addEventListener('mouseover', overHandler, true);
            document.body.addEventListener('mouseout', outHandler, true);
            document.body.addEventListener('click', clickHandler, true);
            console.log('[FIT DEBUG Iframe] Event listeners registered on body.');
 
            window.addEventListener('message', (e) => {
              console.log('[FIT DEBUG Iframe] received message:', e.data);
              if (e.data && e.data.type === 'FIT_TOGGLE_INSPECTOR') {
                window.__fit_inspector_active = e.data.payload;
                console.log('[FIT DEBUG Iframe] Set window.__fit_inspector_active to:', window.__fit_inspector_active);
                if (!window.__fit_inspector_active) {
                  document.querySelectorAll('.fit-inspector-hover').forEach(el => el.classList.remove('fit-inspector-hover'));
                }
              }
            });
            console.log('[FIT DEBUG Iframe] postMessage message listener registered.');
          }
          // Send ready signal to parent so it syncs initial or loaded state
          window.parent.postMessage({ type: 'FIT_INSPECTOR_READY' }, '*');
        `;
        doc.body.appendChild(script);
 
        // Sync initial state
        if (inspectorMode) {
          console.log('[FIT DEBUG] Syncing initial inspectorMode: true');
          iframeRef.current.contentWindow?.postMessage({ type: 'FIT_TOGGLE_INSPECTOR', payload: true }, '*');
        }
      } else {
        console.warn('[FIT DEBUG] contentDocument is null (cross-origin iframe). Direct script injection is blocked by the Same-Origin Policy. The Element Inspector will rely on the postMessage fallback. Please ensure the inspector client script is loaded in your previewed application.');
      }
    } catch (err) {
      // CORS blocked it
      console.warn('[FIT DEBUG] Cannot inject inspector script due to CORS. Using postMessage fallback.', err);
    }
  };

  useEffect(() => {
    // If inspector mode changes after load, sync it
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'FIT_TOGGLE_INSPECTOR', payload: inspectorMode }, '*');
    }
  }, [inspectorMode]);

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
        dispatch({ type: 'SET_SESSION_PREVIEW_URL', payload: { sessionId: activeSessionId || '', previewUrl: targetUrl } });
        dispatch({ type: 'SET_INSPECTOR_MODE', payload: false });
      } else {
        setAlertTitle(t('preview.portUnreachable'));
        setAlertType('warning');
        setAlertMessage(t('preview.noServer', { port }));
      }
    } catch (e) {
      console.error(e);
      setAlertTitle(t('preview.portUnreachable'));
      setAlertType('warning');
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
          setAlertTitle(t('preview.portUnreachable'));
          setAlertType('warning');
          setAlertMessage(t('preview.recursive'));
          return;
        }
      } catch (e) {}

      setIframeUrl(value);
      setInputValue(value);
      dispatch({ type: 'SET_SESSION_PREVIEW_URL', payload: { sessionId: activeSessionId || '', previewUrl: value } });
      dispatch({ type: 'SET_INSPECTOR_MODE', payload: false });
    }
  };

  return (
    <div className="preview-container">
      <div className="preview-toolbar">
        <button 
          className={`preview-toolbar__btn ${inspectorMode ? 'preview-toolbar__btn--active' : ''}`} 
          onClick={toggleInspectorMode} 
          title="Element Inspector (select and send to terminal)"
          style={inspectorMode ? { color: 'var(--color-accent-amber)' } : {}}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        </button>

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
          onClick={async () => {
            if (!iframeUrl) return;
            try {
              const { open } = await import('@tauri-apps/plugin-shell');
              await open(iframeUrl);
            } catch (error) {
              console.error('Failed to open URL in external browser:', error);
              window.open(iframeUrl, '_blank');
            }
          }}
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
          ref={iframeRef}
          onLoad={handleIframeLoad}
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
              {alertType === 'success' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              )}
              <span>{alertTitle || t('preview.portUnreachable')}</span>
            </div>
            <div className="preview-alert-body">
              {alertMessage}
            </div>
            <div className="preview-alert-actions">
              <button className="preview-alert-btn" onClick={() => { setAlertMessage(null); setAlertTitle(null); }}>
                {t('preview.dismiss')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
