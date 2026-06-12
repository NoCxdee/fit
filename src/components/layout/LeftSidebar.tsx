/* ================================================================
   Fit — LeftSidebar Component
   Unified Projects sidebar: workspace accordion + session threads.
   ================================================================ */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { generateId } from '../../utils/generateId';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Workspace, Session } from '../../types';
import { WorkspaceMenu } from './WorkspaceMenu';
import { WorkspaceEditModal } from './WorkspaceEditModal';
import { SessionContextMenu } from './SessionContextMenu';
import { ResizeHandle } from './ResizeHandle';
import { Portal } from '../Portal';

const COLOR_PRESETS = [
  { name: 'purple', hex: '#a88bc7', bg: '#362145', text: '#a88bc7' },
  { name: 'teal', hex: '#60b0a2', bg: '#164540', text: '#60b0a2' },
  { name: 'orange', hex: '#d4a857', bg: '#4c3b1a', text: '#d4a857' },
  { name: 'violet', hex: '#c97070', bg: '#4a2323', text: '#c97070' },
  { name: 'blue', hex: '#6fa3c9', bg: '#1b3b52', text: '#6fa3c9' },
  { name: 'green', hex: '#8cb87a', bg: '#27451c', text: '#8cb87a' },
];

export function LeftSidebar() {
  const { workspaces, activeWorkspaceId, sessions, activeSessionId, panelSizes, activeTabId, openTabs, autoHideSidebar } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const activeTab = openTabs.find(t => t.id === activeTabId);

  const [panelWidth, setPanelWidth] = useState<number>((panelSizes || {})['sessionPanel']?.[0] ?? 240);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const [workspaceContextMenu, setWorkspaceContextMenu] = useState<{ x: number; y: number; workspaceId: string } | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [sessionContextMenu, setSessionContextMenu] = useState<{ sessionId: string; sessionName: string; x: number; y: number } | null>(null);

  // Ensure active workspace is always expanded
  useEffect(() => {
    if (activeWorkspaceId) {
      setExpandedWorkspaces(prev => {
        if (prev.has(activeWorkspaceId)) return prev;
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeStartRef.current = {
      startX: e.clientX,
      startWidth: panelWidthRef.current,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = e.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(220, Math.min(400, resizeStartRef.current.startWidth + delta));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (resizeStartRef.current) {
        dispatch({
          type: 'SET_PANEL_SIZES',
          payload: { key: 'sessionPanel', sizes: [panelWidthRef.current] },
        });
      }
      resizeStartRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [dispatch]);

  const handleAddWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('dialog.openWorkspace'),
      });

      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'Workspace';
        const workspace: Workspace = {
          id: generateId('ws'),
          name,
          path: selected,
          color: '#60b0a2',
        };
        dispatch({ type: 'ADD_WORKSPACE', payload: workspace });
      }
    } catch (error) {
      console.error('Failed to open workspace directory:', error);
    }
  };

  const handleSelectWorkspace = (id: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleWorkspace = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWorkspaces(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleWorkspaceContextMenu = (e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    setWorkspaceContextMenu({ x: e.clientX, y: e.clientY, workspaceId });
  };

  const handleCreateSession = (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    const wsSessions = sessions.filter(s => s.workspaceId === workspaceId);
    const num = wsSessions.length + 1;
    const name = t('session.defaultName', { number: num });

    const session: Session = {
      id: generateId('session'),
      workspaceId,
      name,
      rootPanel: {
        id: generateId('split'),
        type: 'split' as const,
        direction: 'horizontal' as const,
        children: [{
          id: generateId('term'),
          type: 'terminal' as const,
          shell: 'powershell-core',
          cwd: ws.path,
        }],
      },
    };

    dispatch({ type: 'ADD_SESSION', payload: session });
  };

  const handleSelectSession = (sessionId: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
  };

  const handleStartRename = (sessionId: string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  };

  const handleSaveRename = (sessionId: string) => {
    if (editingName.trim()) {
      dispatch({
        type: 'RENAME_SESSION',
        payload: { sessionId, name: editingName.trim() }
      });
    }
    setEditingSessionId(null);
  };

  const handleSessionContextMenu = (e: React.MouseEvent, sessionId: string, name: string) => {
    e.preventDefault();
    setSessionContextMenu({ sessionId, sessionName: name, x: e.clientX, y: e.clientY });
  };

  // Moved helper functions outside the main component to keep it clean

  return (
    <div className="left-sidebar" style={{ width: `${panelWidth}px` }}>
      <ResizeHandle position="right" onResizeStart={handleResizeStart} />

      {/* Header */}
      <div className="left-sidebar__header">
        <span className="left-sidebar__title">PROJECTS</span>
        <div className="left-sidebar__header-actions">
          <button
            className="left-sidebar__header-btn"
            onClick={handleAddWorkspace}
            title={t('workspace.add')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="left-sidebar__list">
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId;
          const isExpanded = expandedWorkspaces.has(ws.id);
          const wsSessions = sessions.filter(s => s.workspaceId === ws.id);

          return (
            <WorkspaceItem
              key={ws.id}
              ws={ws}
              isActive={isActive}
              isExpanded={isExpanded}
              wsSessions={wsSessions}
              activeSessionId={activeSessionId}
              activeTabType={activeTab?.type}
              editingSessionId={editingSessionId}
              editingName={editingName}
              setEditingName={setEditingName}
              onSelectWorkspace={handleSelectWorkspace}
              onToggleWorkspace={handleToggleWorkspace}
              onWorkspaceContextMenu={handleWorkspaceContextMenu}
              onSelectSession={handleSelectSession}
              onSessionContextMenu={handleSessionContextMenu}
              onStartRename={handleStartRename}
              onSaveRename={handleSaveRename}
              onCancelRename={() => setEditingSessionId(null)}
              onCreateSession={handleCreateSession}
              t={t}
            />
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div className="left-sidebar__bottom">
        <button
          className={`left-sidebar__bottom-btn ${autoHideSidebar ? 'left-sidebar__bottom-btn--active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_AUTO_HIDE_SIDEBAR' })}
          title={autoHideSidebar ? 'Disable Auto-Hide Mode' : 'Enable Auto-Hide Mode'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
            <path d="M16 15l-3-3 3-3" style={{ transform: autoHideSidebar ? 'none' : 'rotate(180deg)', transformOrigin: '14.5px 12px', transition: 'transform 0.25s ease' }} />
          </svg>
          <span>Auto-hide</span>
        </button>
        <button className="left-sidebar__bottom-btn" onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} title={t('title.settings')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Settings</span>
        </button>
        <button className="left-sidebar__bottom-btn" onClick={() => dispatch({ type: 'TOGGLE_ABOUT' })} title={t('title.about')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>About</span>
        </button>
      </div>

      {/* Overlays */}
      {workspaceContextMenu && (
        <Portal>
          <WorkspaceMenu
            x={workspaceContextMenu.x}
            y={workspaceContextMenu.y}
            onClose={() => setWorkspaceContextMenu(null)}
            onEdit={() => {
              const ws = workspaces.find(w => w.id === workspaceContextMenu.workspaceId);
              if (ws) setEditingWorkspace(ws);
            }}
            onCloseProject={() => {
              dispatch({ type: 'REMOVE_WORKSPACE', payload: workspaceContextMenu.workspaceId });
            }}
          />
        </Portal>
      )}

      {editingWorkspace && (
        <WorkspaceEditModal
          workspace={editingWorkspace}
          onClose={() => setEditingWorkspace(null)}
          onSave={(name, color, icon) => {
            dispatch({
              type: 'EDIT_WORKSPACE',
              payload: { id: editingWorkspace.id, name, color, icon },
            });
          }}
        />
      )}

      {sessionContextMenu && (
        <Portal>
          <SessionContextMenu
            x={sessionContextMenu.x}
            y={sessionContextMenu.y}
            onClose={() => setSessionContextMenu(null)}
            onRename={() => handleStartRename(sessionContextMenu.sessionId, sessionContextMenu.sessionName)}
            onDelete={() => dispatch({ type: 'REMOVE_SESSION', payload: sessionContextMenu.sessionId })}
          />
        </Portal>
      )}
    </div>
  );
}

interface WorkspaceItemProps {
  ws: Workspace;
  isActive: boolean;
  isExpanded: boolean;
  wsSessions: Session[];
  activeSessionId: string | null;
  activeTabType: string | undefined;
  editingSessionId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  onSelectWorkspace: (id: string) => void;
  onToggleWorkspace: (id: string, e: React.MouseEvent) => void;
  onWorkspaceContextMenu: (e: React.MouseEvent, id: string) => void;
  onSelectSession: (id: string) => void;
  onSessionContextMenu: (e: React.MouseEvent, id: string, name: string) => void;
  onStartRename: (id: string, name: string, e?: React.MouseEvent) => void;
  onSaveRename: (id: string) => void;
  onCancelRename: () => void;
  onCreateSession: (id: string) => void;
  t: any;
}

function WorkspaceItem({
  ws,
  isActive,
  isExpanded,
  wsSessions,
  activeSessionId,
  activeTabType,
  editingSessionId,
  editingName,
  setEditingName,
  onSelectWorkspace,
  onToggleWorkspace,
  onWorkspaceContextMenu,
  onSelectSession,
  onSessionContextMenu,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onCreateSession,
  t,
}: WorkspaceItemProps) {
  const iconUrl = useWorkspaceIcon(ws);
  const colors = getWorkspaceColors(ws);

  return (
    <div className={`left-sidebar__workspace ${isActive ? 'left-sidebar__workspace--active' : ''}`}>
      {/* Workspace Header */}
      <div
        className="left-sidebar__workspace-header"
        onClick={() => onSelectWorkspace(ws.id)}
        onContextMenu={e => onWorkspaceContextMenu(e, ws.id)}
      >
        <button
          className="left-sidebar__workspace-chevron"
          onClick={e => onToggleWorkspace(ws.id, e)}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div
          className="left-sidebar__workspace-avatar"
          style={{ backgroundColor: iconUrl ? 'transparent' : colors.bg, color: colors.text }}
        >
          {iconUrl ? (
            <img src={iconUrl} alt={ws.name} style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
          ) : (
            getWorkspaceInitials(ws.name)
          )}
        </div>

        <span className="left-sidebar__workspace-name">{ws.name}</span>
      </div>

      {/* Sessions */}
      {isExpanded && (
        <div className="left-sidebar__workspace-sessions">
          {wsSessions.length === 0 ? (
            <div className="left-sidebar__no-sessions">{t('session.noSessions', { defaultValue: 'No sessions yet' })}</div>
          ) : (
            wsSessions.map(session => {
              const isSessionActive = session.id === activeSessionId && activeTabType === 'session';
              return (
                <div
                  key={session.id}
                  className={`left-sidebar__session ${isSessionActive ? 'left-sidebar__session--active' : ''}`}
                  onClick={() => onSelectSession(session.id)}
                  onContextMenu={e => onSessionContextMenu(e, session.id, session.name)}
                >
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => onSaveRename(session.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') onSaveRename(session.id);
                        else if (e.key === 'Escape') onCancelRename();
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      className="left-sidebar__session-input"
                    />
                  ) : (
                    <span
                      className="left-sidebar__session-name"
                      onDoubleClick={e => onStartRename(session.id, session.name, e)}
                    >
                      {session.name}
                    </span>
                  )}
                </div>
              );
            })
          )}

          {/* New Session for this workspace */}
          <button
            className="left-sidebar__new-session"
            onClick={() => onCreateSession(ws.id)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{t('session.newSession')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

function getWorkspaceInitials(name: string) {
  return name.charAt(0).toUpperCase();
}

function getWorkspaceColors(ws: Workspace) {
  const matched = COLOR_PRESETS.find(p => p.hex === ws.color);
  if (matched) return { bg: matched.bg, text: matched.text };
  return { bg: 'var(--color-canvas-soft)', text: 'var(--color-body-strong)' };
}

function useWorkspaceIcon(ws: Workspace) {
  const [iconUrl, setIconUrl] = useState<string | null>(ws.icon || null);
  const candidates = [
    'favicon.ico',
    'logo.png',
    'icon.png',
    'public/favicon.ico',
    'public/icon.png',
    'src/app/favicon.ico',
    'app/favicon.ico',
    'assets/logo.png',
    'src-tauri/icons/128x128.png',
  ];

  useEffect(() => {
    if (ws.icon) { setIconUrl(ws.icon); return; }
    let cancelled = false;
    const find = async () => {
      for (const candidate of candidates) {
        const fullPath = `${ws.path}/${candidate}`.replace(/\\/g, '/');
        try {
          const url = convertFileSrc(fullPath);
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = url;
          });
          if (!cancelled) setIconUrl(url);
          return;
        } catch {
          continue;
        }
      }
    };
    find();
    return () => { cancelled = true; };
  }, [ws.path, ws.icon]);

  return iconUrl;
}
