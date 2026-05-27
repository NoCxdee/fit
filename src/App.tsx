/* ================================================================
   Fit — App Shell
   Main application layout with all panels and state persistence.
   ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { WorkspaceBar } from './components/layout/WorkspaceBar';
import { SessionPanel } from './components/layout/SessionPanel';
import { TitleBar } from './components/layout/TitleBar';
import { MainContent } from './components/layout/MainContent';
import { FileDrawer } from './components/layout/FileDrawer';
import { DiffSidebar } from './components/layout/DiffSidebar';
import { SettingsModal } from './components/layout/SettingsModal';
import { WelcomeScreen } from './components/layout/WelcomeScreen';
import { Loader } from './components/layout/Loader';
import { useAppState, useAppDispatch } from './stores/appStore';
import { loadState, saveState, gitStatus } from './utils/ipc';
import { generateId } from './utils/generateId';

export function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const initialized = useRef(false);
  const lastStateRef = useRef(state);
  const [showLoader, setShowLoader] = useState(true);

  const handleLoaderFinished = () => {
    setShowLoader(false);
  };

  // Load state on mount
  useEffect(() => {
    async function init() {
      try {
        const savedState = await loadState();
        if (savedState && savedState.workspaces) {
          dispatch({ type: 'LOAD_STATE', payload: savedState });
        }
      } catch (err) {
        console.error('Failed to load state:', err);
      } finally {
        initialized.current = true;
      }
    }
    init();
  }, [dispatch]);

  // Save state on change (immediate for critical changes, debounced for panel resizes)
  useEffect(() => {
    if (!initialized.current) {
      lastStateRef.current = state;
      return;
    }

    const prevState = lastStateRef.current;
    lastStateRef.current = state;

    // Check if anything other than panelSizes changed
    const isCriticalChange =
      prevState.workspaces !== state.workspaces ||
      prevState.activeWorkspaceId !== state.activeWorkspaceId ||
      prevState.sessions !== state.sessions ||
      prevState.activeSessionId !== state.activeSessionId ||
      prevState.openTabs !== state.openTabs ||
      prevState.activeTabId !== state.activeTabId ||
      prevState.fileDrawerOpen !== state.fileDrawerOpen;

    if (isCriticalChange) {
      saveState(state).catch(err => console.error('Failed to save state immediately:', err));
      return;
    }

    // Debounce saving only for non-critical changes (e.g. panel resizes)
    const timeoutId = setTimeout(() => {
      saveState(state).catch(err => console.error('Failed to save state:', err));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [state]);

  // Poll Git status for the active workspace globally
  useEffect(() => {
    const activeWorkspaceId = state.activeWorkspaceId;
    const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
    if (!activeWorkspace) {
      dispatch({ type: 'SET_GIT_STATUS', payload: null });
      return;
    }

    let isMounted = true;

    async function queryStatus() {
      try {
        const res = await gitStatus(activeWorkspace!.path);
        if (isMounted) {
          dispatch({ type: 'SET_GIT_STATUS', payload: res });
        }
      } catch (err) {
        console.error('Failed to query git status globally:', err);
      }
    }

    // Query status immediately
    queryStatus();

    // Set up background status polling every 5 seconds
    const interval = setInterval(queryStatus, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [state.activeWorkspaceId, state.workspaces, dispatch]);

  // Global Keyboard Shortcuts (Ctrl+T for terminal, Ctrl+P for preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl || e.shiftKey || e.altKey) return;

      const activeWorkspaceId = state.activeWorkspaceId;
      if (!activeWorkspaceId) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const activeWorkspace = state.workspaces.find(w => w.id === activeWorkspaceId);
        const activeWorkspaceSessions = state.sessions.filter(s => s.workspaceId === activeWorkspaceId);
        const num = activeWorkspaceSessions.length + 1;
        const name = `session ${num}`;

        const session = {
          id: generateId('session'),
          workspaceId: activeWorkspaceId,
          name,
          terminals: [{
            id: generateId('term'),
            shell: 'powershell',
            cwd: activeWorkspace ? activeWorkspace.path : '',
          }],
          splitDirection: 'horizontal' as const,
        };

        dispatch({ type: 'ADD_SESSION', payload: session });
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        dispatch({
          type: 'OPEN_TAB',
          payload: {
            id: `tab-preview-${Date.now()}`,
            type: 'preview',
            title: 'Preview',
            previewUrl: '',
            workspaceId: activeWorkspaceId,
          },
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.activeWorkspaceId, state.workspaces, state.sessions, dispatch]);

  // Prevent default drag/drop behaviors globally
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => e.preventDefault();
    
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  if (showLoader) {
    return <Loader onFinished={handleLoaderFinished} />;
  }

  return (
    <div className="app-shell">
      {/* Unified Integrated Title & Tab Bar */}
      <TitleBar />

      {/* Main Body */}
      <div className="app-body">
        {/* Column 1: Workspace Bar */}
        <WorkspaceBar />

        {/* Column 2: Session Panel */}
        {state.activeWorkspaceId && <SessionPanel />}

        {/* Column 3: Main Area */}
        {state.activeWorkspaceId ? (
          <div className="main-area">
            <div className="main-content">
              <MainContent />
            </div>
          </div>
        ) : (
          <WelcomeScreen />
        )}

        {/* Column 4: Diff Sidebar */}
        {state.activeWorkspaceId && (
          <DiffSidebar />
        )}

        {/* Column 5: File Drawer (Right Sidebar) */}
        {state.activeWorkspaceId && <FileDrawer />}
      </div>

      {/* Global Settings Modal overlay */}
      <SettingsModal />
    </div>
  );
}
