import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { generateId } from '../../utils/generateId';
import { open } from '@tauri-apps/plugin-dialog';
import type { Workspace } from '../../types';
import { WorkspaceMenu } from './WorkspaceMenu';
import { WorkspaceEditModal } from './WorkspaceEditModal';

const COLOR_PRESETS = [
  { name: 'purple', hex: '#a88bc7', bg: '#362145', text: '#a88bc7' },
  { name: 'teal', hex: '#60b0a2', bg: '#164540', text: '#60b0a2' },
  { name: 'orange', hex: '#d4a857', bg: '#4c3b1a', text: '#d4a857' },
  { name: 'violet', hex: '#c97070', bg: '#4a2323', text: '#c97070' },
  { name: 'blue', hex: '#6fa3c9', bg: '#1b3b52', text: '#6fa3c9' },
  { name: 'green', hex: '#8cb87a', bg: '#27451c', text: '#8cb87a' },
];

export function WorkspaceBar() {
  const { workspaces, activeWorkspaceId } = useAppState();
  const dispatch = useAppDispatch();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workspaceId: string } | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);

  const handleAddWorkspace = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Open Workspace Folder',
      });

      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'Workspace';
        const workspace: Workspace = {
          id: generateId('ws'),
          name,
          path: selected,
          color: '#60b0a2', // default to teal preset
        };
        dispatch({ type: 'ADD_WORKSPACE', payload: workspace });
      }
    } catch (error) {
      console.error('Failed to open workspace directory:', error);
    }
  };

  const handleSelectWorkspace = (id: string) => {
    if (id === activeWorkspaceId) return;
    dispatch({ type: 'SET_ACTIVE_WORKSPACE', payload: id });
  };

  const handleContextMenu = (e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      workspaceId,
    });
  };

  return (
    <div className="workspace-bar">
      <div className="workspace-bar__list">
        {workspaces.map(ws => {
          const isActive = ws.id === activeWorkspaceId;
          const matchedPreset = COLOR_PRESETS.find(p => p.hex === ws.color);
          const bg = matchedPreset ? matchedPreset.bg : 'var(--color-canvas-soft)';
          const text = matchedPreset ? matchedPreset.text : 'var(--color-body-strong)';

          return (
            <button
              key={ws.id}
              className={`workspace-bar__item ${isActive ? 'workspace-bar__item--active' : ''}`}
              onClick={() => handleSelectWorkspace(ws.id)}
              onContextMenu={e => handleContextMenu(e, ws.id)}
              title={`${ws.name}\n${ws.path}`}
              style={{
                backgroundColor: bg,
                color: text,
              }}
            >
              {ws.icon ? (
                <img
                  src={ws.icon}
                  alt={ws.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'inherit',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                ws.name.charAt(0).toUpperCase()
              )}
            </button>
          );
        })}

        <button
          className="workspace-bar__add"
          onClick={handleAddWorkspace}
          title="Add workspace"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      <div className="workspace-bar__bottom">
        <button className="workspace-bar__bottom-btn" onClick={() => dispatch({ type: 'TOGGLE_SETTINGS' })} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button className="workspace-bar__bottom-btn" onClick={() => dispatch({ type: 'TOGGLE_ABOUT' })} title="Help">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <WorkspaceMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={() => {
            const ws = workspaces.find(w => w.id === contextMenu.workspaceId);
            if (ws) setEditingWorkspace(ws);
          }}
          onCloseProject={() => {
            dispatch({ type: 'REMOVE_WORKSPACE', payload: contextMenu.workspaceId });
          }}
        />
      )}

      {/* Edit Modal Overlay */}
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
    </div>
  );
}
