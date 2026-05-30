/* ================================================================
   Fit — TitleBar Component (Integrated Header)
   ================================================================ */

import React, { useState, useRef, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon } from '../../utils/fileIcons';
import { generateId } from '../../utils/generateId';
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

export function TitleBar() {
  const { openTabs, activeTabId, activeWorkspaceId, activeSessionId, fileDrawerOpen, drawerTab, sessions, workspaces, gitStatus } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [targetIndex, setTargetIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const tabLayoutsRef = useRef<any[]>([]);
  const hasDraggedRef = useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      const tabToClose = workspaceTabs[index];
      if (tabToClose) {
        handleCloseTab(e as any, tabToClose.id);
      }
      return;
    }
    if (e.button !== 0) return;
    
    const container = containerRef.current;
    if (!container) return;

    const tabElements = Array.from(container.querySelectorAll('.app-titlebar__tab'));
    const containerRect = container.getBoundingClientRect();
    
    tabLayoutsRef.current = tabElements.map((el) => {
      const rect = el.getBoundingClientRect();
      const left = rect.left - containerRect.left;
      const width = rect.width;
      return {
        left,
        width,
        center: left + width / 2,
      };
    });

    setDraggedIndex(index);
    setTargetIndex(index);
    setDragOffset(0);
    startXRef.current = e.clientX;
    hasDraggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (draggedIndex === null || draggedIndex !== index) return;

    const deltaX = e.clientX - startXRef.current;
    setDragOffset(deltaX);

    if (Math.abs(deltaX) > 5) {
      hasDraggedRef.current = true;
    }

    const draggedLayout = tabLayoutsRef.current[draggedIndex];
    if (!draggedLayout) return;

    const currentLeft = draggedLayout.left + deltaX;
    const currentCenter = currentLeft + draggedLayout.width / 2;

    let newTargetIndex = draggedIndex;
    let minDistance = Infinity;
    for (let i = 0; i < tabLayoutsRef.current.length; i++) {
      const dist = Math.abs(currentCenter - tabLayoutsRef.current[i].center);
      if (dist < minDistance) {
        minDistance = dist;
        newTargetIndex = i;
      }
    }

    if (newTargetIndex !== targetIndex) {
      setTargetIndex(newTargetIndex);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (draggedIndex !== null) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      
      if (targetIndex !== -1 && targetIndex !== draggedIndex) {
        dispatch({
          type: 'REORDER_TABS',
          payload: { dragIndex: draggedIndex, hoverIndex: targetIndex },
        });
      }
      
      setDraggedIndex(null);
      setDragOffset(0);
      setTargetIndex(-1);
      tabLayoutsRef.current = [];
    }
  };

  const handleMinimize = () => {
    appWindow.minimize().catch(console.error);
  };

  const handleMaximize = async () => {
    try {
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = () => {
    appWindow.close().catch(console.error);
  };

  const handleSelectTab = (tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tabId });
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    dispatch({ type: 'CLOSE_TAB', payload: tabId });
  };

  const handleToggleFileDrawer = () => {
    if (fileDrawerOpen && drawerTab === 'files') {
      dispatch({ type: 'SET_FILE_DRAWER_OPEN', payload: false });
    } else {
      dispatch({ type: 'SET_DRAWER_TAB', payload: 'files' });
      dispatch({ type: 'SET_FILE_DRAWER_OPEN', payload: true });
    }
  };

  const handleToggleGitDrawer = () => {
    if (fileDrawerOpen && drawerTab === 'git') {
      dispatch({ type: 'SET_FILE_DRAWER_OPEN', payload: false });
    } else {
      dispatch({ type: 'SET_DRAWER_TAB', payload: 'git' });
      dispatch({ type: 'SET_FILE_DRAWER_OPEN', payload: true });
    }
  };

  const handleNewPreview = () => {
    if (!activeWorkspaceId) return;
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-preview-${Date.now()}`,
        type: 'preview',
        title: t('title.preview'),
        previewUrl: '',
        workspaceId: activeWorkspaceId,
      },
    });
  };

  const getTabIcon = (tab: typeof openTabs[0]) => {
    if (tab.type === 'session') {
      return (
        <svg className="tab-bar__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );
    }
    if (tab.type === 'preview') {
      return (
        <svg className="tab-bar__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    }
    if (tab.filePath) {
      const icon = getFileIcon(tab.title);
      return (
        <span className="tab-bar__tab-icon" style={{
          fontSize: '10px',
          fontWeight: 600,
          color: icon.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon.icon}
        </span>
      );
    }
    return null;
  };
  const getTabStyle = (index: number) => {
    if (draggedIndex === null || tabLayoutsRef.current.length === 0) return {};

    if (index === draggedIndex) {
      return {
        transform: `translateX(${dragOffset}px)`,
        zIndex: 10,
        position: 'relative' as const,
        transition: 'none',
      };
    }

    const W = (tabLayoutsRef.current[draggedIndex]?.width || 0) + 6;
    let shift = 0;
    
    if (targetIndex > draggedIndex) {
      if (index > draggedIndex && index <= targetIndex) {
        shift = -W;
      }
    } else if (targetIndex < draggedIndex) {
      if (index < draggedIndex && index >= targetIndex) {
        shift = W;
      }
    }

    return {
      transform: `translateX(${shift}px)`,
      transition: 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
      position: 'relative' as const,
    };
  };

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const getIsGitModified = (tab: typeof openTabs[0]) => {
    if (tab.type !== 'editor' || !tab.filePath || !activeWorkspace || !gitStatus || !gitStatus.isRepo) {
      return false;
    }
    const wsPath = activeWorkspace.path.replace(/\\/g, '/');
    const normTabPath = tab.filePath.replace(/\\/g, '/');
    if (!normTabPath.startsWith(wsPath + '/')) return false;
    const relPath = normTabPath.substring(wsPath.length + 1);
    
    return gitStatus.staged.some(s => s.path.replace(/\\/g, '/') === relPath) ||
           gitStatus.unstaged.some(u => u.path.replace(/\\/g, '/') === relPath);
  };

  const workspaceTabs = openTabs.filter(t => t.sessionId === activeSessionId && t.type !== 'session');
  const [logoVisible, setLogoVisible] = useState(true);

  useEffect(() => {
    const tabCount = workspaceTabs.length;
    if (tabCount >= 7) {
      setLogoVisible(false);
    } else if (tabCount <= 5) {
      setLogoVisible(true);
    }
  }, [workspaceTabs.length]);

  return (
    <div data-tauri-drag-region className="app-titlebar">
      <span className={`app-titlebar__logo ${!logoVisible ? 'app-titlebar__logo--hidden' : ''}`}>{t('app.name')}</span>

      <div data-tauri-no-drag className="app-titlebar__left">
      </div>

      <div data-tauri-no-drag ref={containerRef} className={`app-titlebar__tabs-container ${!logoVisible ? 'app-titlebar__tabs-container--expanded' : ''}`} style={{ touchAction: 'none' }}>
        {workspaceTabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragging = draggedIndex === index;
          const isGitModified = getIsGitModified(tab);
          const isDirty = tab.isModified;
          return (
            <button
              key={tab.id}
              data-tauri-no-drag
              className={`app-titlebar__tab ${isActive ? 'app-titlebar__tab--active' : ''} ${isDragging ? 'app-titlebar__tab--dragging' : ''} ${isGitModified ? 'app-titlebar__tab--modified-git' : ''} ${isDirty ? 'app-titlebar__tab--modified-dirty' : ''}`}
              style={getTabStyle(index)}
              onClick={(e) => {
                if (hasDraggedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                handleSelectTab(tab.id);
              }}
              onPointerDown={(e) => handlePointerDown(e, index)}
              onPointerMove={(e) => handlePointerMove(e, index)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {getTabIcon(tab)}
              <span className="app-titlebar__tab-title">{tab.title}</span>
              {(isDirty || isGitModified) && <span className="tab-bar__tab-modified" />}
              <button
                className="app-titlebar__tab-close"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={e => handleCloseTab(e, tab.id)}
                title={t('title.closeTab')}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </button>
          );
        })}
      </div>

      <div className="app-titlebar__spacer" />

      <div data-tauri-no-drag className="app-titlebar__right">
        {activeWorkspaceId && (
          <>
            <button
              className={`app-titlebar__btn ${fileDrawerOpen && drawerTab === 'git' ? 'app-titlebar__btn--active' : ''}`}
              onClick={handleToggleGitDrawer}
              title={t('title.sourceControl')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </button>

            <button
              className={`app-titlebar__btn ${fileDrawerOpen && drawerTab === 'files' ? 'app-titlebar__btn--active' : ''}`}
              onClick={handleToggleFileDrawer}
              title={t('title.toggleFiles')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </>
        )}
        <span className="app-titlebar__divider" />

        <div className="app-titlebar__window-controls">
          <button className="app-titlebar__win-btn" onClick={handleMinimize} title={t('title.minimize')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="app-titlebar__win-btn" onClick={handleMaximize} title={t('title.maximize')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
          </button>
          <button className="app-titlebar__win-btn app-titlebar__win-btn--close" onClick={handleClose} title={t('title.close')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
