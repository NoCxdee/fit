/* ================================================================
   Fit — TabBar Component
   ================================================================ */

import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon } from '../../utils/fileIcons';

export function TabBar() {
  const { openTabs, activeTabId, activeWorkspaceId, activeSessionId, fileDrawerOpen, drawerTab } = useAppState();
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
          <circle cx="18" cy="18" r="3" />
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 15V9a4 4 0 0 0-4-4H9" />
          <line x1="6" y1="9" x2="6" y2="15" />
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
      </div>
    </div>
  );
}
