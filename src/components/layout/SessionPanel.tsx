/* ================================================================
   Fit — SessionPanel Component
   ================================================================ */

import { useState, useRef, useCallback } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { generateId } from '../../utils/generateId';
import type { Session, Workspace } from '../../types';
import { WorkspaceMenu } from './WorkspaceMenu';
import { WorkspaceEditModal } from './WorkspaceEditModal';
import { ResizeHandle } from './ResizeHandle';
import { SessionContextMenu } from './SessionContextMenu';

export function SessionPanel() {
  const { workspaces, activeWorkspaceId, sessions, activeSessionId, panelSizes, activeTabId, openTabs } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const activeTab = openTabs.find(t => t.id === activeTabId);

  const [panelWidth, setPanelWidth] = useState<number>((panelSizes || {})['sessionPanel']?.[0] ?? 220);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeStartRef.current = {
      startX: e.clientX,
      startWidth: panelWidthRef.current,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = e.clientX - resizeStartRef.current.startX;
      const newWidth = Math.max(200, Math.min(400, resizeStartRef.current.startWidth + delta));
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

  const [optionsMenu, setOptionsMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [sessionContextMenu, setSessionContextMenu] = useState<{ sessionId: string; sessionName: string; x: number; y: number } | null>(null);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const workspaceSessions = sessions.filter(s => s.workspaceId === activeWorkspaceId);

  const handleStartRename = (sessionId: string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingName(currentName);
  };

  const handleContextMenu = (e: React.MouseEvent, sessionId: string, name: string) => {
    e.preventDefault();
    setSessionContextMenu({
      sessionId,
      sessionName: name,
      x: e.clientX,
      y: e.clientY,
    });
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

  if (!activeWorkspace) return null;

  const handleCreateInstantSession = () => {
    if (!activeWorkspaceId) return;

    const num = workspaceSessions.length + 1;
    const name = t('session.defaultName', { number: num });

    const session: Session = {
      id: generateId('session'),
      workspaceId: activeWorkspaceId,
      name,
      rootPanel: {
        id: generateId('split'),
        type: 'split' as const,
        direction: 'horizontal' as const,
        children: [{
          id: generateId('term'),
          type: 'terminal' as const,
          shell: 'powershell-core',
          cwd: activeWorkspace.path,
        }],
      },
    };

    dispatch({ type: 'ADD_SESSION', payload: session });
  };

  const handleSelectSession = (sessionId: string) => {
    dispatch({ type: 'SET_ACTIVE_SESSION', payload: sessionId });
  };

  const handleOpenOptions = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setOptionsMenu({
      x: rect.left,
      y: rect.bottom + 4,
    });
  };

  return (
    <div className="session-panel" style={{ width: `${panelWidth}px` }}>
      <ResizeHandle position="right" onResizeStart={handleResizeStart} />
      <div className="session-panel__header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="session-panel__workspace-name">
            {activeWorkspace.name}
          </div>
          <div className="session-panel__workspace-path" title={activeWorkspace.path}>
            ~{activeWorkspace.path.replace(/^[A-Z]:\\Users\\[^\\]+/i, '')}
          </div>
        </div>
        <button
          className="session-panel__menu-btn"
          onClick={handleOpenOptions}
          title={t('session.workspaceOptions')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>
      </div>

      <button
        className="session-panel__new-session"
        onClick={handleCreateInstantSession}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        {t('session.newSession')}
      </button>

      <div className="session-panel__list">
        {workspaceSessions.map(session => (
          <div
            key={session.id}
            className={`session-panel__item ${
              (session.id === activeSessionId && activeTab?.type === 'session') ? 'session-panel__item--active' : ''
            }`}
            onClick={() => handleSelectSession(session.id)}
            onContextMenu={(e) => handleContextMenu(e, session.id, session.name)}
          >
            {editingSessionId === session.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleSaveRename(session.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveRename(session.id);
                  } else if (e.key === 'Escape') {
                    setEditingSessionId(null);
                  }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-ink)',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  padding: '2px 4px',
                  width: '100%',
                  outline: 'none',
                  flex: 1,
                }}
              />
            ) : (
              <div 
                onDoubleClick={(e) => handleStartRename(session.id, session.name, e)}
                style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                title={t('session.renameHint')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
                  {session.name}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8, flexShrink: 0 }}>
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
            )}
            <button
              className="session-panel__archive-btn"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'REMOVE_SESSION', payload: session.id });
              }}
              title={t('session.archive')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {optionsMenu && (
        <WorkspaceMenu
          x={optionsMenu.x}
          y={optionsMenu.y}
          onClose={() => setOptionsMenu(null)}
          onEdit={() => {
            setEditingWorkspace(activeWorkspace);
          }}
          onCloseProject={() => {
            dispatch({ type: 'REMOVE_WORKSPACE', payload: activeWorkspaceId! });
          }}
        />
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
        <SessionContextMenu
          x={sessionContextMenu.x}
          y={sessionContextMenu.y}
          onClose={() => setSessionContextMenu(null)}
          onRename={() => handleStartRename(sessionContextMenu.sessionId, sessionContextMenu.sessionName)}
          onDelete={() => dispatch({ type: 'REMOVE_SESSION', payload: sessionContextMenu.sessionId })}
        />
      )}
    </div>
  );
}
