/* ================================================================
   Fit — TabBar Component
   ================================================================ */

import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon } from '../../utils/fileIcons';

export function TabBar() {
  const { openTabs, activeTabId, activeWorkspaceId, activeSessionId, fileDrawerOpen, drawerTab, diffSidebarOpen } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

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

  const handleOpenPreview = () => {
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-preview-${Date.now()}`,
        type: 'preview',
        title: t('title.preview'),
        previewUrl: '',
        workspaceId: activeWorkspaceId || undefined,
      },
    });
  };

  const handleOpenDiff = () => {
    if (!activeWorkspaceId) return;
    dispatch({ type: 'TOGGLE_DIFF_SIDEBAR' });
  };

  const getTabIcon = (tab: typeof openTabs[0]) => {
    if (tab.type === 'session') {
      return (
        <svg className="tab-bar__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    if (tab.type === 'diff') {
      return (
        <svg className="tab-bar__tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent-amber)' }}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="10" y1="10" x2="14" y2="10" />
          <line x1="10" y1="15" x2="14" y2="15" />
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

  const workspaceTabs = (openTabs || []).filter(t => t.sessionId === activeSessionId && t.type !== 'session');

  return (
    <div className="tab-bar">
      {workspaceTabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-bar__tab ${tab.id === activeTabId ? 'tab-bar__tab--active' : ''}`}
          onClick={() => handleSelectTab(tab.id)}
        >
          {getTabIcon(tab)}
          <span>{tab.title}</span>
          {tab.isModified && <span className="tab-bar__tab-modified" />}
          <button
            className="tab-bar__tab-close"
            onClick={e => handleCloseTab(e, tab.id)}
            title={t('title.closeTab')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </button>
      ))}

      <div className="tab-bar__spacer" />

      <div className="tab-bar__toolbar">
        <button
          className="tab-bar__toolbar-btn"
          onClick={handleOpenPreview}
          title={t('toolbar.openPreview')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </button>

        <button
          className={`tab-bar__toolbar-btn ${fileDrawerOpen && drawerTab === 'git' ? 'tab-bar__toolbar-btn--active' : ''}`}
          onClick={handleToggleGitDrawer}
          title={t('title.sourceControl')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
        </button>

        <button
          className={`tab-bar__toolbar-btn ${diffSidebarOpen ? 'tab-bar__toolbar-btn--active' : ''}`}
          onClick={handleOpenDiff}
          title={t('title.diffView')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="10" y1="10" x2="14" y2="10" />
            <line x1="10" y1="15" x2="14" y2="15" />
          </svg>
        </button>

        <button
          className={`tab-bar__toolbar-btn ${fileDrawerOpen && drawerTab === 'files' ? 'tab-bar__toolbar-btn--active' : ''}`}
          onClick={handleToggleFileDrawer}
          title={t('title.toggleFiles')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
