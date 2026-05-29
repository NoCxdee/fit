/* ================================================================
   Fit — TerminalInstance Component
   ================================================================ */

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { listen } from '@tauri-apps/api/event';
import { ptySpawn, ptyWrite, ptyResize, ptyKill, getClipboardFiles } from '../../utils/ipc';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  terminalId: string;
  shell: string;
}

export function TerminalInstance({ terminalId, shell }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webGlAddonRef = useRef<WebglAddon | null>(null);
  const { workspaces, activeWorkspaceId, sessions, activeSessionId, useWebGl } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const cwd = activeWorkspace ? activeWorkspace.path : '';

  useEffect(() => {
    if (!containerRef.current) return;

    let isDestroyed = false;
    let unlistenOutput: (() => void) | null = null;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono Regular','JetBrains Mono',Consolas,monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      theme: {
        background: '#2b2622',
        foreground: '#f7f5f0',
        cursor: '#d4a857',
        cursorAccent: '#2b2622',
        selectionBackground: 'rgba(212, 168, 87, 0.3)',
        black: '#2b2622',
        red: '#e76c5f',
        green: '#8cb87a',
        yellow: '#d4a857',
        blue: '#6fa3c9',
        magenta: '#a88bc7',
        cyan: '#60b0a2',
        white: '#f7f5f0',
        brightBlack: '#aea69c',
        brightRed: '#e76c5f',
        brightGreen: '#8cb87a',
        brightYellow: '#d4a857',
        brightBlue: '#6fa3c9',
        brightMagenta: '#a88bc7',
        brightCyan: '#60b0a2',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(containerRef.current);

    const handleClipboardPaste = async () => {
      try {
        const files = await getClipboardFiles();
        if (files && files.length > 0) {
          const formatted = files.map(f => `"${f}"`).join(', ');
          await ptyWrite(terminalId, formatted);
        } else {
          const text = await navigator.clipboard.readText();
          if (text) {
            await ptyWrite(terminalId, text);
          }
        }
      } catch (err) {
        console.error('Failed to parse clipboard files:', err);
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            await ptyWrite(terminalId, text);
          }
        } catch (clipErr) {
          console.error('Clipboard text fallback failed:', clipErr);
        }
      }
    };

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        handleClipboardPaste();
        return false;
      }
      return true;
    });

    if (useWebGl) {
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
        webGlAddonRef.current = webgl;
      } catch (e) {
        console.warn('WebGL addon failed to load:', e);
      }
    }

    let vp: any = null;
    if ((term as any).viewport) {
      vp = (term as any).viewport;
    } else if ((term as any)._core?.viewport) {
      vp = (term as any)._core.viewport;
    } else {
      const targets = [term, (term as any)._core].filter(Boolean);
      for (const target of targets) {
        const keys = Object.getOwnPropertyNames(target);
        for (const key of keys) {
          try {
            const val = (target as any)[key];
            if (val && typeof val === 'object' && typeof val.syncScrollArea === 'function') {
              vp = val;
              break;
            }
          } catch (e) {}
        }
        if (vp) break;
      }
    }

    if (vp && typeof vp.syncScrollArea === 'function') {
      const origSync = vp.syncScrollArea;
      vp.syncScrollArea = function (...args: any[]) {
        if (isDestroyed) return;
        try {
          return origSync.apply(this, args);
        } catch (e: any) {
          if (
            e instanceof TypeError &&
            (e.message?.includes('dimensions') ||
              e.message?.includes('undefined') ||
              e.message?.includes('null'))
          ) {
            return;
          }
          console.warn('xterm syncScrollArea exception:', e);
        }
      };
    }

    const tryFit = () => {
      try {
        if (!isDestroyed && fitAddonRef.current && containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddonRef.current.fit();
        }
      } catch (e) {}
    };

    const fitTimeout = setTimeout(tryFit, 50);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    async function setupPty() {
      try {
        let attempts = 0;
        while ((!containerRef.current || containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) && attempts < 25) {
          await new Promise(r => setTimeout(r, 20));
          attempts++;
        }

        if (isDestroyed) return;

        try {
          if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
            fitAddon.fit();
          }
        } catch (e) {}

        if (isDestroyed) return;

        const unsub = await listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (!isDestroyed && event.payload.pty_id === terminalId) {
            term.write(event.payload.data);
          }
        });
        if (isDestroyed) {
          unsub();
          return;
        } else {
          unlistenOutput = unsub;
        }

        await ptySpawn(terminalId, shell, cwd, term.cols, term.rows);

        if (isDestroyed) return;

        term.onData((data) => {
          if (!isDestroyed) {
            ptyWrite(terminalId, data).catch(console.error);
          }
        });

        term.onResize(({ cols, rows }) => {
          if (!isDestroyed && cols > 0 && rows > 0) {
            ptyResize(terminalId, cols, rows).catch(console.error);
          }
        });

        setIsReady(true);
      } catch (err) {
        if (!isDestroyed) {
          console.error('Failed to spawn PTY:', err);
          term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
        }
      }
    }

    setupPty();

    const handleResize = () => tryFit();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      if (!isDestroyed) {
        requestAnimationFrame(tryFit);
      }
    });
    observer.observe(containerRef.current);

    return () => {
      isDestroyed = true;
      clearTimeout(fitTimeout);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (unlistenOutput) unlistenOutput();
      ptyKill(terminalId).catch(console.error);
      if (webGlAddonRef.current) {
        try {
          webGlAddonRef.current.dispose();
        } catch (e) {}
        webGlAddonRef.current = null;
      }
      try {
        term.dispose();
      } catch (e) {}
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId, useWebGl]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !isReady) return;

    if (useWebGl) {
      if (!webGlAddonRef.current) {
        try {
          const webgl = new WebglAddon();
          term.loadAddon(webgl);
          webGlAddonRef.current = webgl;
        } catch (e) {
          console.warn('WebGL addon failed to load:', e);
        }
      }
    } else {
      if (webGlAddonRef.current) {
        try {
          webGlAddonRef.current.dispose();
        } catch (e) {}
        webGlAddonRef.current = null;
      }
    }
  }, [useWebGl, isReady]);

  // Listen to Speech-to-Text transcription event
  useEffect(() => {
    const handleTranscription = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      const activeEl = document.activeElement;
      const isFocused = (activeEl instanceof Node && containerRef.current?.contains(activeEl)) || 
                        (e.target instanceof Node && containerRef.current?.contains(e.target));
      console.log('[STT Terminal] Received transcription event. terminalId:', terminalId, 'isReady:', isReady, 'isFocused:', isFocused);
      if (isFocused && termRef.current && isReady) {
        const text = customEvent.detail.text;
        console.log('[STT Terminal] Writing text to PTY:', text);
        ptyWrite(terminalId, text).catch(console.error);
      }
    };
    window.addEventListener('fit-speech-transcription', handleTranscription);
    return () => window.removeEventListener('fit-speech-transcription', handleTranscription);
  }, [terminalId, isReady]);

  const handleClose = () => {
    if (activeSessionId) {
      dispatch({
        type: 'REMOVE_TERMINAL_FROM_SESSION',
        payload: { sessionId: activeSessionId, terminalId }
      });
    }
  };

  const handleSplitRight = () => {
    if (activeSessionId) {
      dispatch({
        type: 'SET_SESSION_SPLIT_DIRECTION',
        payload: { sessionId: activeSessionId, splitDirection: 'horizontal' }
      });
      dispatch({
        type: 'ADD_TERMINAL_TO_SESSION',
        payload: {
          sessionId: activeSessionId,
          terminal: {
            id: `term-${Date.now()}`,
            shell: shell,
            cwd: cwd,
          }
        }
      });
    }
  };

  const handleSplitDown = () => {
    if (activeSessionId) {
      dispatch({
        type: 'SET_SESSION_SPLIT_DIRECTION',
        payload: { sessionId: activeSessionId, splitDirection: 'vertical' }
      });
      dispatch({
        type: 'ADD_TERMINAL_TO_SESSION',
        payload: {
          sessionId: activeSessionId,
          terminal: {
            id: `term-${Date.now()}`,
            shell: shell,
            cwd: cwd,
          }
        }
      });
    }
  };

  const handleTogglePreview = () => {
    if (activeSessionId) {
      dispatch({
        type: 'TOGGLE_SESSION_PREVIEW',
        payload: { sessionId: activeSessionId }
      });
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const terminalCount = activeSession ? activeSession.terminals.length : 0;

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div className="terminal-header__shell">
          <span className={`terminal-header__dot ${isReady ? 'terminal-header__dot--ready' : ''}`} />
        </div>
        <div className="terminal-header__actions">
          <button className="tab-bar__toolbar-btn" onClick={handleSplitRight} title={t('terminal.splitRight')} style={{ width: '22px', height: '22px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
          <button className="tab-bar__toolbar-btn" onClick={handleSplitDown} title={t('terminal.splitDown')} style={{ width: '22px', height: '22px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </button>
          <button 
            className={`tab-bar__toolbar-btn ${activeSession?.showPreview ? 'tab-bar__toolbar-btn--active' : ''}`}
            onClick={handleTogglePreview} 
            title={t('terminal.togglePreview')} 
            style={{ width: '22px', height: '22px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
          {terminalCount > 1 && (
            <button className="tab-bar__toolbar-btn" onClick={handleClose} title={t('terminal.close')} style={{ width: '22px', height: '22px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div 
        className="terminal-wrapper" 
        style={{ padding: '8px 12px 8px 12px', display: 'flex', flexDirection: 'column' }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </div>
  );
}
