/* ================================================================
   Fit — App Store (useSyncExternalStore + Selectors)
   Global state management with granular re-render control.
   Zero external dependencies.
   ================================================================ */

import { useSyncExternalStore, useRef, type Dispatch, type ReactNode, createContext, useContext } from 'react';
import type { AppState, AppAction, GitStatusResult, Workspace, Session, Tab } from '../types';
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
  useWebGl: true,
  settingsOpen: false,
  aboutOpen: false,
  pendingUpdate: null,
  sttShortcut: 'Control+Space',
  sttMicId: 'default',
  sttVolume: 1,
  sttPushToTalk: false,
  sttAutoUnload: 'never',
  sttOverlayPos: 'bottom',
  sttPasteMethod: 'direct',
  sttMuteSystem: false,
  inspectorMode: false,
  capturedElement: null,
};

// ── Reducer ──────────────────────────────────────────────────────
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_INSPECTOR_MODE':
      return { ...state, inspectorMode: action.payload, capturedElement: null };
    
    case 'SET_CAPTURED_ELEMENT':
      return { ...state, capturedElement: action.payload, inspectorMode: false };
    case 'ADD_WORKSPACE': {
      const newSession = {
        id: generateId('session'),
        workspaceId: action.payload.id,
        name: 'session 1',
        terminals: [{
          id: generateId('term'),
          shell: 'powershell-core',
          cwd: action.payload.path,
        }],
        splitDirection: 'horizontal' as const,
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
        workspaces: [...state.workspaces, action.payload],
        activeWorkspaceId: action.payload.id,
        sessions: [...state.sessions, newSession],
        activeSessionId: newSession.id,
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
      };
    }

    case 'EDIT_WORKSPACE':
      return {
        ...state,
        workspaces: state.workspaces.map(w =>
          w.id === action.payload.id
            ? { ...w, name: action.payload.name, color: action.payload.color, icon: action.payload.icon }
            : w
        ),
      };

    case 'SET_ACTIVE_WORKSPACE': {
      if (state.activeWorkspaceId === action.payload) {
        return state;
      }
      const workspaceSessions = state.sessions.filter(s => s.workspaceId === action.payload);
      let targetSession = workspaceSessions.find(s => s.id === state.activeSessionId) || workspaceSessions[0];
      let newSessions = state.sessions;
      let newTabs = state.openTabs;

      if (!targetSession) {
        const workspace = state.workspaces.find(w => w.id === action.payload);
        targetSession = {
          id: generateId('session'),
          workspaceId: action.payload,
          name: 'session 1',
          terminals: [{
            id: generateId('term'),
            shell: 'powershell-core',
            cwd: workspace?.path || '',
          }],
          splitDirection: 'horizontal' as const,
        };
        newSessions = [...state.sessions, targetSession];
        newTabs = [...state.openTabs, {
          id: `tab-session-${targetSession.id}`,
          type: 'session' as const,
          title: targetSession.name,
          sessionId: targetSession.id,
          workspaceId: action.payload,
        }];
      }

      const targetSessionId = targetSession.id;
      const sessionTabs = newTabs.filter(t => t.sessionId === targetSessionId);
      const newActiveTabId = sessionTabs.length > 0 ? sessionTabs[0].id : `tab-session-${targetSessionId}`;

      return {
        ...state,
        activeWorkspaceId: action.payload,
        activeSessionId: targetSessionId,
        activeTabId: newActiveTabId,
        gitStatus: null,
        sessions: newSessions,
        openTabs: newTabs,
      };
    }

    case 'REMOVE_WORKSPACE': {
      const remainingWorkspaces = state.workspaces.filter(w => w.id !== action.payload);
      const nextActiveWorkspaceId =
        state.activeWorkspaceId === action.payload
          ? remainingWorkspaces[0]?.id ?? null
          : state.activeWorkspaceId;

      const remainingSessions = state.sessions.filter(s => s.workspaceId !== action.payload);
      const remainingTabs = state.openTabs.filter(t => t.workspaceId !== action.payload);

      let newSessions = remainingSessions;
      let newTabs = remainingTabs;
      let nextActiveSessionId = state.activeSessionId;
      let nextActiveTabId = state.activeTabId;

      if (state.activeWorkspaceId === action.payload) {
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
              terminals: [{
                id: generateId('term'),
                shell: 'powershell-core',
                cwd: ws?.path || '',
              }],
              splitDirection: 'horizontal' as const,
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

    case 'REMOVE_SESSION': {
      const remainingSessions = state.sessions.filter(s => s.id !== action.payload);
      const remainingTabs = state.openTabs.filter(t => t.sessionId !== action.payload);

      let nextActiveSessionId = state.activeSessionId;
      let nextActiveTabId = state.activeTabId;

      if (state.activeSessionId === action.payload) {
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

    case 'SET_ACTIVE_SESSION': {
      const tabId = `tab-session-${action.payload}`;
      const existingTab = state.openTabs.find(t => t.id === tabId);
      if (!existingTab) {
        const session = state.sessions.find(s => s.id === action.payload);
        if (!session) return state;
        const tab = {
          id: tabId,
          type: 'session' as const,
          title: session.name,
          sessionId: action.payload,
          workspaceId: session.workspaceId,
        };
        return {
          ...state,
          activeSessionId: action.payload,
          openTabs: [...state.openTabs, tab],
          activeTabId: tabId,
        };
      }
      return {
        ...state,
        activeSessionId: action.payload,
        activeTabId: tabId,
      };
    }

    case 'SET_SESSION_SPLIT_DIRECTION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { ...s, splitDirection: action.payload.splitDirection }
            : s
        ),
      };

    case 'ADD_TERMINAL_TO_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { ...s, terminals: [...s.terminals, action.payload.terminal] }
            : s
        ),
      };

    case 'REMOVE_TERMINAL_FROM_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { ...s, terminals: s.terminals.filter(t => t.id !== action.payload.terminalId) }
            : s
        ),
      };

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

    case 'OPEN_TAB': {
      const workspaceId = action.payload.workspaceId || state.activeWorkspaceId || '';
      const sessionId = action.payload.sessionId || state.activeSessionId || '';



      // Build a unique tab ID incorporating the session ID to avoid key collisions
      let tabId = action.payload.id;
      if (action.payload.type !== 'session') {
        tabId = `${action.payload.id}-${sessionId}`;
      }

      const existing = state.openTabs.find(t =>
        t.workspaceId === workspaceId &&
        t.sessionId === sessionId &&
        t.type === action.payload.type &&
        ((t.filePath && t.filePath === action.payload.filePath) ||
          (t.sessionId && t.sessionId === action.payload.sessionId && t.type === 'session') ||
          (t.previewUrl !== undefined && action.payload.type === 'preview'))
      );
      if (existing) {
        return { ...state, activeTabId: existing.id };
      }
      const newTab = { ...action.payload, id: tabId, workspaceId, sessionId };
      return {
        ...state,
        openTabs: [...state.openTabs, newTab],
        activeTabId: newTab.id,
      };
    }

    case 'CLOSE_TAB': {
      const newTabs = state.openTabs.filter(t => t.id !== action.payload);
      let newActiveTabId = state.activeTabId;
      if (state.activeTabId === action.payload) {
        const currentSessionTabs = newTabs.filter(t => t.sessionId === state.activeSessionId);
        const oldSessionTabs = state.openTabs.filter(t => t.sessionId === state.activeSessionId);
        const sessionIdx = oldSessionTabs.findIndex(t => t.id === action.payload);
        const newIdx = Math.min(sessionIdx, currentSessionTabs.length - 1);
        newActiveTabId = currentSessionTabs[newIdx]?.id ?? null;
      }
      return {
        ...state,
        openTabs: newTabs,
        activeTabId: newActiveTabId,
      };
    }

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

    case 'REORDER_TABS': {
      const { activeSessionId } = state;
      const sessionTabs = state.openTabs.filter(t => t.sessionId === activeSessionId);
      const otherTabs = state.openTabs.filter(t => t.sessionId !== activeSessionId);
      
      const { dragIndex, hoverIndex } = action.payload;
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

    case 'TOGGLE_FILE_DRAWER':
      return { ...state, fileDrawerOpen: !state.fileDrawerOpen };

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

    case 'SET_STT_SHORTCUT':
      return {
        ...state,
        sttShortcut: action.payload,
      };

    case 'SET_STT_MIC_ID':
      return {
        ...state,
        sttMicId: action.payload,
      };

    case 'SET_STT_VOLUME':
      return {
        ...state,
        sttVolume: action.payload,
      };

    case 'SET_STT_PUSH_TO_TALK':
      return {
        ...state,
        sttPushToTalk: action.payload,
      };

    case 'SET_STT_AUTO_UNLOAD':
      return {
        ...state,
        sttAutoUnload: action.payload,
      };

    case 'SET_STT_OVERLAY_POS':
      return {
        ...state,
        sttOverlayPos: action.payload,
      };

    case 'SET_STT_PASTE_METHOD':
      return {
        ...state,
        sttPasteMethod: action.payload,
      };

    case 'SET_STT_MUTE_SYSTEM':
      return {
        ...state,
        sttMuteSystem: action.payload,
      };

    case 'LOAD_STATE': {
      const loadedTabs = action.payload.openTabs || [];
      const migratedTabs = loadedTabs.map(t => {
        let updated = { ...t };
        if (!updated.workspaceId) {
          if (updated.type === 'session' && updated.sessionId) {
            const session = action.payload.sessions?.find(s => s.id === updated.sessionId);
            if (session) updated.workspaceId = session.workspaceId;
          } else {
            updated.workspaceId = action.payload.activeWorkspaceId ?? '';
          }
        }
        if (!updated.sessionId) {
          const wsSessions = action.payload.sessions?.filter(s => s.workspaceId === updated.workspaceId);
          if (wsSessions && wsSessions.length > 0) {
            updated.sessionId = wsSessions[0].id;
          } else if (action.payload.activeSessionId) {
            updated.sessionId = action.payload.activeSessionId;
          }
        }
        return updated;
      });
      return {
        ...action.payload,
        openTabs: migratedTabs,
        useWebGl: action.payload.useWebGl !== undefined ? action.payload.useWebGl : true,
        settingsOpen: false,
        aboutOpen: false,
        pendingUpdate: null,
        drawerTab: action.payload.drawerTab || 'files',
        gitStatus: null,
        panelSizes: action.payload.panelSizes || {},
        sttShortcut: action.payload.sttShortcut || 'Control+Space',
        sttMicId: action.payload.sttMicId || 'default',
        sttVolume: action.payload.sttVolume !== undefined ? action.payload.sttVolume : 1,
        sttPushToTalk: action.payload.sttPushToTalk !== undefined ? action.payload.sttPushToTalk : false,
        sttAutoUnload: action.payload.sttAutoUnload || 'never',
        sttOverlayPos: action.payload.sttOverlayPos || 'bottom',
        sttPasteMethod: action.payload.sttPasteMethod || 'direct',
        sttMuteSystem: action.payload.sttMuteSystem !== undefined ? action.payload.sttMuteSystem : false,
      };
    }

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

export function useActiveWorkspace(): Workspace | null {
  const workspaces = useAppSelector(s => s.workspaces);
  const activeId = useAppSelector(s => s.activeWorkspaceId);
  if (!activeId) return null;
  return workspaces.find(w => w.id === activeId) ?? null;
}

export function useSessions(): Session[] {
  return useAppSelector(s => s.sessions);
}

export function useActiveSessionId(): string | null {
  return useAppSelector(s => s.activeSessionId);
}

export function useOpenTabs(): Tab[] {
  return useAppSelector(s => s.openTabs);
}

export function useActiveTabId(): string | null {
  return useAppSelector(s => s.activeTabId);
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

// ── Direct store access (for non-React code) ─────────────────────

export const appStore = store;
