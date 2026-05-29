/* ================================================================
   Fit — App Store (React Context + useReducer)
   Global state management — zero external dependencies
   ================================================================ */

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type { AppState, AppAction } from '../types';
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
  settingsOpen: false,
  aboutOpen: false,
  pendingUpdate: null,
  diffSidebarOpen: false,
  diffFilePath: null,
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
        diffSidebarOpen: nextActiveWorkspaceId === null ? false : state.diffSidebarOpen,
        diffFilePath: nextActiveWorkspaceId === null ? null : state.diffFilePath,
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

    case 'SET_GIT_STATUS':
      if (JSON.stringify(state.gitStatus) === JSON.stringify(action.payload)) {
        return state;
      }
      return { ...state, gitStatus: action.payload };

    case 'TOGGLE_DIFF_SIDEBAR': {
      if (!state.diffSidebarOpen) {
        return { ...state, diffSidebarOpen: true, diffFilePath: null };
      } else {
        if (state.diffFilePath !== null) {
          return { ...state, diffFilePath: null };
        } else {
          return { ...state, diffSidebarOpen: false };
        }
      }
    }

    case 'SET_DIFF_SIDEBAR_OPEN':
      return { ...state, diffSidebarOpen: action.payload };

    case 'SET_DIFF_FILE_PATH':
      return { ...state, diffFilePath: action.payload };

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
        useWebGl: action.payload.useWebGl !== undefined ? action.payload.useWebGl : false,
        settingsOpen: false,
        aboutOpen: false,
        pendingUpdate: null,
        drawerTab: action.payload.drawerTab || 'files',
        gitStatus: null,
        diffSidebarOpen: false,
        diffFilePath: null,
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

// ── Context ──────────────────────────────────────────────────────
const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<AppAction>>(() => { });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  return useContext(AppStateContext);
}

export function useAppDispatch(): Dispatch<AppAction> {
  return useContext(AppDispatchContext);
}
