/* ================================================================
   Fit — App Store (useSyncExternalStore + Selectors)
   Global state management with granular re-render control.
   Zero external dependencies.
   ================================================================ */

import { useSyncExternalStore, useRef, type Dispatch, type ReactNode, createContext, useContext } from 'react';
import type { AppState, AppAction, GitStatusResult, Workspace, Session, Tab, PanelNode, TerminalPanel, SplitPanel, SplitDirection } from '../types';
import { generateId } from '../utils/generateId';

// ── Initial State ────────────────────────────────────────────────
const initialState: AppState = {
  workspaces: [],
  activeWorkspaceId: null,
  sessions: [],
  activeSessionId: null,
  openTabs: [],
  activeTabId: null,
  fileDrawerOpen: false,
  drawerTab: 'files',
  gitStatus: null,
  panelSizes: {},
  useWebGl: false,
  autoSave: false,
  settingsOpen: false,
  aboutOpen: false,
  pendingUpdate: null,
  inspectorMode: false,
  capturedElement: null,
  autoHideSidebar: false,
  linkOpeningMode: 'browser',
};

// ── Grid restructure keep-alive ──────────────────────────────────
// When a grid split rebuilds the panel tree, terminal instances are
// unmounted and remounted, which normally kills the PTY.  This set
// tracks terminal ids that are being restructured so the cleanup can
// skip `ptyKill` and the Rust backend keeps the child process alive.
const gridKeepAlive = new Set<string>();

export function markGridKeepAlive(ids: string[]) {
  ids.forEach(id => gridKeepAlive.add(id));
}

export function consumeGridKeepAlive(id: string): boolean {
  return gridKeepAlive.delete(id);
}

// ── Reducer ──────────────────────────────────────────────────────
// ── Reducer Helpers ──────────────────────────────────────────────

function makeTerminalPanel(shell: string, cwd: string): TerminalPanel {
  return {
    id: generateId('term'),
    type: 'terminal',
    shell,
    cwd,
  };
}

/** Wrap a terminal in a root SplitPanel so that split operations can
 *  add siblings without changing the terminal's parent in the React tree. */
function makeSessionRoot(shell: string, cwd: string): SplitPanel {
  return {
    id: generateId('split'),
    type: 'split',
    direction: 'horizontal',
    children: [makeTerminalPanel(shell, cwd)],
  };
}

function handleAddWorkspace(state: AppState, workspace: Workspace): AppState {
  const newSession = {
    id: generateId('session'),
    workspaceId: workspace.id,
    name: 'session 1',
    rootPanel: makeSessionRoot('powershell-core', workspace.path),
  };
  const newTab = {
    id: `tab-session-${newSession.id}`,
    type: 'session' as const,
    title: newSession.name,
    sessionId: newSession.id,
    workspaceId: newSession.workspaceId,
  };
  return {
    ...state,
    workspaces: [...state.workspaces, workspace],
    activeWorkspaceId: workspace.id,
    sessions: [...state.sessions, newSession],
    activeSessionId: newSession.id,
    openTabs: [...state.openTabs, newTab],
    activeTabId: newTab.id,
    fileDrawerOpen: true,
    drawerTab: 'files',
  };
}

function handleSetActiveWorkspace(state: AppState, workspaceId: string): AppState {
  if (state.activeWorkspaceId === workspaceId) {
    return state;
  }
  const workspaceSessions = state.sessions.filter(s => s.workspaceId === workspaceId);
  let targetSession = workspaceSessions.find(s => s.id === state.activeSessionId) || workspaceSessions[0];
  let newSessions = state.sessions;
  let newTabs = state.openTabs;

  if (!targetSession) {
    const workspace = state.workspaces.find(w => w.id === workspaceId);
      targetSession = {
        id: generateId('session'),
        workspaceId,
        name: 'session 1',
        rootPanel: makeSessionRoot('powershell-core', workspace?.path || ''),
      };
    newSessions = [...state.sessions, targetSession];
    newTabs = [...state.openTabs, {
      id: `tab-session-${targetSession.id}`,
      type: 'session' as const,
      title: targetSession.name,
      sessionId: targetSession.id,
      workspaceId,
    }];
  }

  const targetSessionId = targetSession.id;
  const sessionTabs = newTabs.filter(t => t.sessionId === targetSessionId);
  const newActiveTabId = sessionTabs.length > 0 ? sessionTabs[0].id : `tab-session-${targetSessionId}`;

  return {
    ...state,
    activeWorkspaceId: workspaceId,
    activeSessionId: targetSessionId,
    activeTabId: newActiveTabId,
    gitStatus: null,
    sessions: newSessions,
    openTabs: newTabs,
    fileDrawerOpen: true,
    drawerTab: 'files',
  };
}

function handleRemoveWorkspace(state: AppState, workspaceId: string): AppState {
  const remainingWorkspaces = state.workspaces.filter(w => w.id !== workspaceId);
  const nextActiveWorkspaceId =
    state.activeWorkspaceId === workspaceId
      ? remainingWorkspaces[0]?.id ?? null
      : state.activeWorkspaceId;

  const remainingSessions = state.sessions.filter(s => s.workspaceId !== workspaceId);
  const remainingTabs = state.openTabs.filter(t => t.workspaceId !== workspaceId);

  let newSessions = remainingSessions;
  let newTabs = remainingTabs;
  let nextActiveSessionId = state.activeSessionId;
  let nextActiveTabId = state.activeTabId;

  if (state.activeWorkspaceId === workspaceId) {
    if (nextActiveWorkspaceId) {
      const wsSessions = remainingSessions.filter(s => s.workspaceId === nextActiveWorkspaceId);
      const nextSession = wsSessions[0];
      if (nextSession) {
        nextActiveSessionId = nextSession.id;
        const sessionTabs = remainingTabs.filter(t => t.sessionId === nextSession.id);
        nextActiveTabId = sessionTabs[0]?.id ?? `tab-session-${nextSession.id}`;
      } else {
        const ws = remainingWorkspaces.find(w => w.id === nextActiveWorkspaceId);
          const autoSession = {
            id: generateId('session'),
            workspaceId: nextActiveWorkspaceId,
            name: 'session 1',
            rootPanel: makeSessionRoot('powershell-core', ws?.path || ''),
          };
        newSessions = [...remainingSessions, autoSession];
        newTabs = [...remainingTabs, {
          id: `tab-session-${autoSession.id}`,
          type: 'session' as const,
          title: autoSession.name,
          sessionId: autoSession.id,
          workspaceId: autoSession.workspaceId,
        }];
        nextActiveSessionId = autoSession.id;
        nextActiveTabId = `tab-session-${autoSession.id}`;
      }
    } else {
      nextActiveSessionId = null;
      nextActiveTabId = null;
    }
  }

  return {
    ...state,
    workspaces: remainingWorkspaces,
    activeWorkspaceId: nextActiveWorkspaceId,
    sessions: newSessions,
    openTabs: newTabs,
    activeSessionId: nextActiveSessionId,
    activeTabId: nextActiveTabId,
    gitStatus: null,
    fileDrawerOpen: nextActiveWorkspaceId === null ? false : state.fileDrawerOpen,
  };
}

function handleRemoveSession(state: AppState, sessionId: string): AppState {
  const remainingSessions = state.sessions.filter(s => s.id !== sessionId);
  const remainingTabs = state.openTabs.filter(t => t.sessionId !== sessionId);

  let nextActiveSessionId = state.activeSessionId;
  let nextActiveTabId = state.activeTabId;

  if (state.activeSessionId === sessionId) {
    const workspaceSessions = remainingSessions.filter(s => s.workspaceId === state.activeWorkspaceId);
    const nextSession = workspaceSessions[0] || remainingSessions[0];
    nextActiveSessionId = nextSession?.id ?? null;

    if (nextActiveSessionId) {
      const sessionTabs = remainingTabs.filter(t => t.sessionId === nextActiveSessionId);
      nextActiveTabId = sessionTabs[0]?.id ?? `tab-session-${nextActiveSessionId}`;
    } else {
      nextActiveTabId = null;
    }
  }

  return {
    ...state,
    sessions: remainingSessions,
    openTabs: remainingTabs,
    activeSessionId: nextActiveSessionId,
    activeTabId: nextActiveTabId,
  };
}

// ── Panel Tree Helpers ───────────────────────────────────────────

/** Count total terminal leaf nodes in a panel tree. */
export function countTerminals(node: PanelNode): number {
  if (node.type === 'terminal') return 1;
  return node.children.reduce((sum, c) => sum + countTerminals(c), 0);
}

/** Collect all terminal panel IDs in the tree (for use by external code that needs the flat list). */
export function collectTerminalIds(node: PanelNode): string[] {
  if (node.type === 'terminal') return [node.id];
  return node.children.flatMap(collectTerminalIds);
}

/**
 * Find the parent SplitPanel (and child index) for a given node id.
 * Returns null if the id is the root or not found.
 */
function findParentAndIndex(root: PanelNode, targetId: string): { parent: SplitPanel; index: number } | null {
  if (root.type !== 'split') return null;
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === targetId) {
      return { parent: root, index: i };
    }
    const found = findParentAndIndex(root.children[i], targetId);
    if (found) return found;
  }
  return null;
}

/** Find a TerminalPanel node by id. Returns null if not found. */
function findTerminalInTree(root: PanelNode, targetId: string): TerminalPanel | null {
  if (root.type === 'terminal') return root.id === targetId ? root : null;
  for (const c of root.children) {
    const found = findTerminalInTree(c, targetId);
    if (found) return found;
  }
  return null;
}

/** Deep-clone a panel tree. */
function clonePanel(node: PanelNode): PanelNode {
  if (node.type === 'terminal') return { ...node };
  return { ...node, children: node.children.map(clonePanel) };
}

/**
 * Replace a terminal node in the tree with a new node.
 * Returns a new root (immutable update).
 */
function replacePanelNode(root: PanelNode, targetId: string, newNode: PanelNode): PanelNode {
  if (root.id === targetId) return newNode;
  if (root.type !== 'split') return root;
  return {
    ...root,
    children: root.children.map(c => replacePanelNode(c, targetId, newNode)),
  };
}

/**
 * Remove a terminal node from the tree.
 * Splits are never collapsed (left in place even with 1 child) so that
 * React can track the remaining panel by its stable key and avoid
 * remounting TerminalInstance components.
 * Returns null if the last terminal would be removed.
 */
function removePanelNode(root: PanelNode, targetId: string): PanelNode | null {
  if (root.id === targetId) return null;

  function remove(node: PanelNode): PanelNode | null {
    if (node.type === 'terminal') {
      return node.id === targetId ? null : node;
    }
    const newChildren = node.children
      .map(remove)
      .filter((c): c is PanelNode => c !== null);
    if (newChildren.length === 0) return null;
    return { ...node, children: newChildren };
  }

  return remove(root);
}

/** Build a flat TerminaConfig[] from a panel tree (for legacy interop). */
export function flattenPanelTree(node: PanelNode): { id: string; shell: string; cwd: string }[] {
  if (node.type === 'terminal') return [{ id: node.id, shell: node.shell, cwd: node.cwd }];
  return node.children.flatMap(flattenPanelTree);
}

/** Create a grid of cols x rows terminal panels. */
function createGridPanelNode(template: TerminalPanel, cols: number, rows: number): SplitPanel {
  const makeTerm = () => ({
    id: generateId('term'),
    type: 'terminal' as const,
    shell: template.shell,
    cwd: template.cwd,
  });

  // Outer: horizontal split with `cols` children
  // Each child: vertical split with `rows` terminals
  if (rows === 1) {
    return {
      id: generateId('split'),
      type: 'split',
      direction: 'horizontal',
      children: Array.from({ length: cols }, () => makeTerm()),
    };
  }

  const columns = Array.from({ length: cols }, () => {
    const terms = Array.from({ length: rows }, () => makeTerm());
    if (terms.length === 1) return terms[0];
    return {
      id: generateId('split'),
      type: 'split' as const,
      direction: 'vertical' as const,
      children: terms,
    };
  });

  return {
    id: generateId('split'),
    type: 'split',
    direction: 'horizontal',
    children: columns,
  };
}

/** Build a cols×rows grid tree from a flat array of terminals,
 *  distributing them row-by-row into columns.  Existing terminal ids
 *  are preserved so React can keep their components mounted and the
 *  Rust backend can reuse the running PTYs. */
function buildGridFromTerminals(terms: TerminalPanel[], cols: number, rows: number, rootId: string): PanelNode {
  const targetTotal = cols * rows;
  if (terms.length === 0) return { id: rootId, type: 'split', direction: 'vertical', children: [] };

  const gridRows: PanelNode[] = [];
  for (let r = 0; r < rows; r++) {
    const rowTerms = terms.slice(r * cols, Math.min((r + 1) * cols, terms.length));
    if (rowTerms.length === 0) break;
    if (cols === 1) {
      gridRows.push(rowTerms[0]);
    } else {
      gridRows.push({
        id: generateId('split'),
        type: 'split',
        direction: 'horizontal' as const,
        children: rowTerms,
      });
    }
  }

  if (gridRows.length === 1) return gridRows[0];
  return {
    id: rootId,
    type: 'split',
    direction: 'vertical',
    children: gridRows,
  };
}

function handleSetActiveSession(state: AppState, sessionId: string): AppState {
  const tabId = `tab-session-${sessionId}`;
  const existingTab = state.openTabs.find(t => t.id === tabId);
  if (!existingTab) {
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return state;
    const tab = {
      id: tabId,
      type: 'session' as const,
      title: session.name,
      sessionId: sessionId,
      workspaceId: session.workspaceId,
    };
    return {
      ...state,
      activeSessionId: sessionId,
      openTabs: [...state.openTabs, tab],
      activeTabId: tabId,
    };
  }
  return {
    ...state,
    activeSessionId: sessionId,
    activeTabId: tabId,
  };
}

function handleOpenTab(state: AppState, payload: any): AppState {
  const workspaceId = payload.workspaceId || state.activeWorkspaceId || '';
  const sessionId = payload.sessionId || state.activeSessionId || '';

  // Build a unique tab ID incorporating the session ID to avoid key collisions
  let tabId = payload.id;
  if (payload.type !== 'session') {
    tabId = `${payload.id}-${sessionId}`;
  }

  const existing = state.openTabs.find(t =>
    t.workspaceId === workspaceId &&
    t.sessionId === sessionId &&
    t.type === payload.type &&
    ((t.filePath && t.filePath === payload.filePath) ||
      (t.sessionId && t.sessionId === payload.sessionId && t.type === 'session') ||
      (t.previewUrl !== undefined && payload.type === 'preview'))
  );
  if (existing) {
    return { ...state, activeTabId: existing.id };
  }
  const newTab = { ...payload, id: tabId, workspaceId, sessionId };
  return {
    ...state,
    openTabs: [...state.openTabs, newTab],
    activeTabId: newTab.id,
  };
}

function handleCloseTab(state: AppState, tabId: string): AppState {
  const newTabs = state.openTabs.filter(t => t.id !== tabId);
  let newActiveTabId = state.activeTabId;
  if (state.activeTabId === tabId) {
    const currentSessionTabs = newTabs.filter(t => t.sessionId === state.activeSessionId);
    const oldSessionTabs = state.openTabs.filter(t => t.sessionId === state.activeSessionId);
    const sessionIdx = oldSessionTabs.findIndex(t => t.id === tabId);
    const newIdx = Math.min(sessionIdx, currentSessionTabs.length - 1);
    newActiveTabId = currentSessionTabs[newIdx]?.id ?? null;
  }
  return {
    ...state,
    openTabs: newTabs,
    activeTabId: newActiveTabId,
  };
}

function handleReorderTabs(state: AppState, payload: { dragIndex: number; hoverIndex: number }): AppState {
  const { activeSessionId } = state;
  const sessionTabs = state.openTabs.filter(t => t.sessionId === activeSessionId);
  const otherTabs = state.openTabs.filter(t => t.sessionId !== activeSessionId);
  
  const { dragIndex, hoverIndex } = payload;
  if (dragIndex < 0 || dragIndex >= sessionTabs.length || hoverIndex < 0 || hoverIndex >= sessionTabs.length) {
    return state;
  }
  const newSessionTabs = [...sessionTabs];
  const [draggedTab] = newSessionTabs.splice(dragIndex, 1);
  newSessionTabs.splice(hoverIndex, 0, draggedTab);
  
  return {
    ...state,
    openTabs: [...otherTabs, ...newSessionTabs],
  };
}

function handleLoadState(state: AppState, payload: any): AppState {
  // Migrate sessions: convert legacy terminals[]+splitDirection to rootPanel tree,
  // and ensure rootPanel is always a SplitPanel (never bare Terminal).
  const migratedSessions = (payload.sessions || []).map((s: any) => {
    if (s.rootPanel?.type === 'split') return s;
    if (s.rootPanel?.type === 'terminal') {
      const { rootPanel: bare, ...rest } = s;
      const wrapped: SplitPanel = {
        id: generateId('split'),
        type: 'split',
        direction: 'horizontal',
        children: [bare],
      };
      return { ...rest, rootPanel: wrapped };
    }
    const terms: TerminalPanel[] = (s.terminals || []).map((t: any) => ({
      id: t.id,
      type: 'terminal' as const,
      shell: t.shell,
      cwd: t.cwd,
    }));
    if (terms.length === 0) return s;
    const dir: SplitDirection = s.splitDirection === 'vertical' ? 'vertical' : 'horizontal';
    const rootPanel: SplitPanel = {
      id: generateId('split'),
      type: 'split',
      direction: dir,
      children: terms,
    };
    const { terminals, splitDirection, ...rest } = s;
    return { ...rest, rootPanel };
  });
  const loadedTabs = payload.openTabs || [];
  const migratedTabs = loadedTabs.map((t: any) => {
    let updated = { ...t };
    if (!updated.workspaceId) {
      if (updated.type === 'session' && updated.sessionId) {
        const session = payload.sessions?.find((s: any) => s.id === updated.sessionId);
        if (session) updated.workspaceId = session.workspaceId;
      } else {
        updated.workspaceId = payload.activeWorkspaceId ?? '';
      }
    }
    if (!updated.sessionId) {
      const wsSessions = payload.sessions?.filter((s: any) => s.workspaceId === updated.workspaceId);
      if (wsSessions && wsSessions.length > 0) {
        updated.sessionId = wsSessions[0].id;
      } else if (payload.activeSessionId) {
        updated.sessionId = payload.activeSessionId;
      }
    }
    return updated;
  });
  return {
    ...payload,
    sessions: migratedSessions,
    openTabs: migratedTabs,
    useWebGl: payload.useWebGl !== undefined ? payload.useWebGl : false,
    autoSave: payload.autoSave !== undefined ? payload.autoSave : false,
    settingsOpen: false,
    aboutOpen: false,
    pendingUpdate: null,
    fileDrawerOpen: payload.activeWorkspaceId ? true : (payload.fileDrawerOpen ?? false),
    drawerTab: payload.activeWorkspaceId ? 'files' : (payload.drawerTab || 'files'),
    gitStatus: null,
    panelSizes: payload.panelSizes || {},
    autoHideSidebar: payload.autoHideSidebar !== undefined ? payload.autoHideSidebar : false,
    linkOpeningMode: payload.linkOpeningMode !== undefined ? payload.linkOpeningMode : 'browser',
  };
}

// ── Reducer ──────────────────────────────────────────────────────
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INSPECTOR_MODE':
      return { ...state, inspectorMode: action.payload, capturedElement: null };
    
    case 'SET_CAPTURED_ELEMENT':
      return { ...state, capturedElement: action.payload, inspectorMode: false };
    case 'ADD_WORKSPACE':
      return handleAddWorkspace(state, action.payload);

    case 'EDIT_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map(w =>
          w.id === action.payload.id
            ? { ...w, name: action.payload.name, color: action.payload.color, icon: action.payload.icon }
            : w
        ),
      };

    case 'SET_ACTIVE_WORKSPACE':
      return handleSetActiveWorkspace(state, action.payload);

    case 'REMOVE_WORKSPACE':
      return handleRemoveWorkspace(state, action.payload);

    case 'ADD_SESSION': {
      const tab = {
        id: `tab-session-${action.payload.id}`,
        type: 'session' as const,
        title: action.payload.name,
        sessionId: action.payload.id,
        workspaceId: action.payload.workspaceId,
      };
      return {
        ...state,
        sessions: [...state.sessions, action.payload],
        activeSessionId: action.payload.id,
        openTabs: [...state.openTabs, tab],
        activeTabId: tab.id,
      };
    }

    case 'REMOVE_SESSION':
      return handleRemoveSession(state, action.payload);

    case 'RENAME_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId ? { ...s, name: action.payload.name } : s
        ),
        openTabs: state.openTabs.map(t =>
          t.sessionId === action.payload.sessionId && t.type === 'session'
            ? { ...t, title: action.payload.name }
            : t
        ),
      };

    case 'SET_ACTIVE_SESSION':
      return handleSetActiveSession(state, action.payload);

    case 'SPLIT_TERMINAL': {
      return {
        ...state,
        sessions: state.sessions.map(s => {
          if (s.id !== action.payload.sessionId) return s;
          const existing = findTerminalInTree(s.rootPanel, action.payload.terminalId);
          if (!existing) return s;
          const newTerm: TerminalPanel = {
            id: generateId('term'),
            type: 'terminal',
            shell: existing.shell,
            cwd: existing.cwd,
          };
          const parentInfo = findParentAndIndex(s.rootPanel, action.payload.terminalId);

          // Case 1: terminal is child of a SplitPanel → try to add sibling
          if (parentInfo) {
            const { parent, index } = parentInfo;
            // Parent has solo 1 child → change direction + add sibling (no remount)
            if (parent.children.length === 1) {
              const updatedParent: SplitPanel = {
                ...parent,
                direction: action.payload.direction,
                children: [
                  ...parent.children.slice(0, index + 1),
                  newTerm,
                ],
              };
              return { ...s, rootPanel: replacePanelNode(s.rootPanel, parent.id, updatedParent) };
            }
            // Parent has multiple children, direction matches → add sibling
            if (parent.direction === action.payload.direction) {
              const updatedParent: SplitPanel = {
                ...parent,
                children: [
                  ...parent.children.slice(0, index + 1),
                  newTerm,
                  ...parent.children.slice(index + 1),
                ],
              };
              return { ...s, rootPanel: replacePanelNode(s.rootPanel, parent.id, updatedParent) };
            }
            // Parent has multiple children, direction differs → need nested split (remount)
          }

          // Case 2: no matching parent or direction mismatch → wrap in nested split
          const split: SplitPanel = {
            id: generateId('split'),
            type: 'split',
            direction: action.payload.direction,
            children: [
              clonePanel(existing),
              newTerm,
            ],
          };
          return { ...s, rootPanel: replacePanelNode(s.rootPanel, action.payload.terminalId, split) };
        }),
      };
    }

    case 'SPLIT_TERMINAL_GRID': {
      return {
        ...state,
        sessions: state.sessions.map(s => {
          if (s.id !== action.payload.sessionId) return s;
          const { cols, rows } = action.payload;
          const targetTotal = cols * rows;

          // Collect existing terminals and their data
          const existingTerms = flattenPanelTree(s.rootPanel);
          const existingTemplate = existingTerms[0] ?? { id: generateId('term'), shell: 'powershell-core', cwd: '' };

          // Build the list of terminals for the grid, reusing existing IDs
          const termList: TerminalPanel[] = [];
          for (let i = 0; i < targetTotal; i++) {
            if (i < existingTerms.length) {
              termList.push({ id: existingTerms[i].id, type: 'terminal', shell: existingTerms[i].shell, cwd: existingTerms[i].cwd });
            } else {
              termList.push({ id: generateId('term'), type: 'terminal', shell: existingTemplate.shell, cwd: existingTemplate.cwd });
            }
          }

          // Build grid tree from the flat list, preserving the root id
          // so the outermost PanelGroup key stays the same.
          const grid = buildGridFromTerminals(termList, cols, rows, s.rootPanel.id);
          return { ...s, rootPanel: grid };
        }),
      };
    }

    case 'REMOVE_TERMINAL_PANEL': {
      return {
        ...state,
        sessions: state.sessions.map(s => {
          if (s.id !== action.payload.sessionId) return s;
          if (countTerminals(s.rootPanel) <= 1) return s;
          const newRoot = removePanelNode(s.rootPanel, action.payload.terminalId);
          return newRoot ? { ...s, rootPanel: newRoot } : s;
        }),
      };
    }

    case 'TOGGLE_SESSION_PREVIEW':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { ...s, showPreview: !s.showPreview }
            : s
        ),
      };

    case 'SET_USE_WEBGL':
      return {
        ...state,
        useWebGl: action.payload,
      };

    case 'SET_AUTO_SAVE':
      return {
        ...state,
        autoSave: action.payload,
      };

    case 'SET_LINK_OPENING_MODE':
      return {
        ...state,
        linkOpeningMode: action.payload,
      };

    case 'SET_SESSION_PREVIEW_URL':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { 
                ...s, 
                previewUrl: action.payload.previewUrl,
                showPreview: action.payload.showPreview !== undefined ? action.payload.showPreview : s.showPreview 
              }
            : s
        ),
      };

    case 'TOGGLE_SETTINGS':
      return {
        ...state,
        settingsOpen: !state.settingsOpen,
      };

    case 'TOGGLE_ABOUT':
      return {
        ...state,
        aboutOpen: !state.aboutOpen,
      };

    case 'SET_PENDING_UPDATE':
      return {
        ...state,
        pendingUpdate: action.payload,
      };

    case 'OPEN_TAB':
      return handleOpenTab(state, action.payload);

    case 'CLOSE_TAB':
      return handleCloseTab(state, action.payload);

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.payload };

    case 'SET_TAB_MODIFIED':
      return {
        ...state,
        openTabs: state.openTabs.map(t =>
          t.id === action.payload.tabId
            ? { ...t, isModified: action.payload.isModified }
            : t
        ),
      };

    case 'REORDER_TABS':
      return handleReorderTabs(state, action.payload);

    case 'TOGGLE_FILE_DRAWER':
      return { ...state, fileDrawerOpen: !state.fileDrawerOpen };

    case 'TOGGLE_AUTO_HIDE_SIDEBAR':
      return { ...state, autoHideSidebar: !state.autoHideSidebar };

    case 'SET_FILE_DRAWER_OPEN':
      return { ...state, fileDrawerOpen: action.payload };

    case 'SET_DRAWER_TAB':
      return { ...state, drawerTab: action.payload };

    case 'SET_GIT_STATUS': {
      // Fast hash comparison to avoid unnecessary state updates
      const prevHash = state.gitStatus?.hash;
      const newHash = action.payload?.hash;
      if (prevHash && newHash && prevHash === newHash) {
        return state;
      }
      return { ...state, gitStatus: action.payload };
    }

    case 'SET_PANEL_SIZES':
      return {
        ...state,
        panelSizes: { ...state.panelSizes, [action.payload.key]: action.payload.sizes },
      };

    case 'LOAD_STATE':
      return handleLoadState(state, action.payload);

    default:
      return state;
  }
}

// ── External Store ───────────────────────────────────────────────
// Singleton store that works with useSyncExternalStore for granular
// re-render control. Components only re-render when their selected
// slice actually changes.

class AppStore {
  private _state: AppState;
  private _listeners: Set<() => void> = new Set();

  constructor(initial: AppState) {
    this._state = initial;
  }

  getState = (): AppState => {
    return this._state;
  };

  dispatch = (action: AppAction): void => {
    this._state = appReducer(this._state, action);
    this._listeners.forEach(l => l());
  };

  subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };
}

const store = new AppStore(initialState);

// ── Granular Selector Hook ───────────────────────────────────────
// Uses useSyncExternalStore with referential equality check.
// Components only re-render when the selector returns a different value.

export function useAppSelector<T>(selector: (s: AppState) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const lastValueRef = useRef<T | undefined>(undefined);
  const getSnapshot = () => {
    const next = selectorRef.current(store.getState());
    // For primitives, strict equality works. For objects/arrays,
    // the selector should return the same reference when unchanged
    // (which the reducer already guarantees via spread).
    if (lastValueRef.current !== undefined && Object.is(lastValueRef.current, next)) {
      return lastValueRef.current;
    }
    lastValueRef.current = next;
    return next;
  };

  return useSyncExternalStore(store.subscribe, getSnapshot);
}

// ── Convenience Selector Hooks ───────────────────────────────────
// Pre-built selectors for the most commonly accessed state slices.
// These provide stable references and minimal re-renders.

export function useGitStatus(): GitStatusResult | null {
  return useAppSelector(s => s.gitStatus);
}

export function useActiveWorkspaceId(): string | null {
  return useAppSelector(s => s.activeWorkspaceId);
}

export function useWorkspaces(): Workspace[] {
  return useAppSelector(s => s.workspaces);
}

export function useOpenTabs(): Tab[] {
  return useAppSelector(s => s.openTabs);
}

// ── Dispatch Hook ────────────────────────────────────────────────

export function useAppDispatch(): (action: AppAction) => void {
  return store.dispatch;
}

// ── Full State (for save/load and App.tsx) ────────────────────────
// Deprecated for individual components — use selectors instead.
// Still needed for App.tsx state persistence and LOAD_STATE.

export function useAppState(): AppState {
  return useAppSelector(s => s);
}

// ── Provider (simplified — no Context needed for state) ──────────
// We keep the Provider wrapper for tree structure consistency
// but it no longer needs to provide state via Context.

const DispatchContext = createContext<(action: AppAction) => void>(store.dispatch);

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <DispatchContext.Provider value={store.dispatch}>
      {children}
    </DispatchContext.Provider>
  );
}

