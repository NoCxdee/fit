/* ================================================================
   Fit — FileDrawer Component (Right Sidebar)
   ================================================================ */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon, FolderClosedIcon, FolderOpenIcon } from '../../utils/fileIcons';
import { readDir, gitStatus, gitStage, gitUnstage, gitStageAll, gitUnstageAll, gitCommit, gitPush, gitPull, gitFetch, gitDiscardFile } from '../../utils/ipc';
import type { FileEntry } from '../../types';
import { ResizeHandle } from './ResizeHandle';

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  onFileClick: (entry: FileEntry) => void;
}

function TreeItem({ entry, depth, onFileClick }: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const { openTabs, gitStatus, workspaces, activeWorkspaceId } = useAppState();

  const isDir = entry.isDir || (entry as any).is_dir;

  const normalizePath = (p: string) => p.replace(/\\/g, '/');
  const normalizedPath = normalizePath(entry.path);

  const isTabModified = !isDir && openTabs.some(t => 
    t.type === 'editor' && 
    t.isModified && 
    t.filePath && 
    normalizePath(t.filePath) === normalizedPath
  );

  let isGitModified = false;
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  if (gitStatus && gitStatus.isRepo && activeWorkspace && !isDir) {
    const wsPath = normalizePath(activeWorkspace.path);
    if (normalizedPath.startsWith(wsPath + '/')) {
      const relPath = normalizedPath.substring(wsPath.length + 1);
      isGitModified = gitStatus.staged.some(s => normalizePath(s.path) === relPath) ||
                      gitStatus.unstaged.some(u => normalizePath(u.path) === relPath);
    }
  }

  const isModified = isTabModified || isGitModified;

  const hasTabModifiedChildren = isDir && openTabs.some(t => {
    if (t.type !== 'editor' || !t.isModified || !t.filePath) return false;
    const normalizedFile = normalizePath(t.filePath);
    return normalizedFile.startsWith(normalizedPath + '/');
  });

  let hasGitModifiedChildren = false;
  if (gitStatus && gitStatus.isRepo && activeWorkspace && isDir) {
    const wsPath = normalizePath(activeWorkspace.path);
    if (normalizedPath.startsWith(wsPath + '/')) {
      const relPath = normalizedPath.substring(wsPath.length + 1);
      hasGitModifiedChildren = gitStatus.staged.some(s => normalizePath(s.path).startsWith(relPath + '/')) ||
                               gitStatus.unstaged.some(u => normalizePath(u.path).startsWith(relPath + '/'));
    } else if (normalizedPath === wsPath) {
      hasGitModifiedChildren = (gitStatus.staged.length + gitStatus.unstaged.length) > 0;
    }
  }

  const hasModifiedChildren = hasTabModifiedChildren || hasGitModifiedChildren;

  const handleClick = async () => {
    if (isDir) {
      if (!expanded && children === null) {
        setLoading(true);
        try {
          const contents = await readDir(entry.path);
          setChildren(contents);
        } catch (error) {
          console.error('Failed to read directory:', error);
        } finally {
          setLoading(false);
        }
      }
      setExpanded(!expanded);
    } else {
      onFileClick(entry);
    }
  };

  const icon = !isDir ? getFileIcon(entry.name) : null;

  const itemClassName = [
    'file-tree-item',
    isModified ? 'file-tree-item--modified' : '',
    hasModifiedChildren ? 'file-tree-item--child-modified' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={itemClassName}
        onClick={handleClick}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
      >
        {isDir ? (
          <svg
            className={`file-tree-item__chevron ${expanded ? 'file-tree-item__chevron--open' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <div style={{ width: '12px', height: '12px', flexShrink: 0 }} />
        )}

        <span
          className="file-tree-item__icon"
          style={{
            width: '14px',
            height: '14px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: isDir ? undefined : icon?.color,
            marginLeft: '2px',
            marginRight: '6px',
            fontWeight: 600,
          }}
        >
          {isDir ? (
            expanded ? <FolderOpenIcon /> : <FolderClosedIcon />
          ) : (
            icon?.icon
          )}
        </span>

        <span className="file-tree-item__name">{entry.name}</span>
        {(isModified || hasModifiedChildren) && <span className="file-tree-item__modified-dot" />}
      </div>

      {isDir && expanded && children && children.map(child => (
        <TreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          onFileClick={onFileClick}
        />
      ))}
    </>
  );
}

import type { GitFileStatus } from '../../types';
import React from 'react';

const GitPanelItem = React.memo(({
  file,
  isStaged,
  onItemClick,
  onOpenFile,
  onAction,
  onDiscard,
  t
}: {
  file: GitFileStatus;
  isStaged: boolean;
  onItemClick: (path: string) => void;
  onOpenFile: (path: string) => void;
  onAction: (path: string) => void;
  onDiscard?: (path: string) => void;
  t: any;
}) => {
  const fileIcon = getFileIcon(file.name);
  const displayDir = file.path.replace(/\\/g, '/').substring(0, Math.max(0, file.path.replace(/\\/g, '/').lastIndexOf(file.name))).replace(/^\/|\/$/g, '');
  
  return (
    <div className="git-panel__change-item">
      <span className="git-panel__item-icon" style={{ color: fileIcon.color }}>{fileIcon.icon}</span>
      <div 
        className="git-panel__item-details" 
        onClick={() => onItemClick(file.path)}
        style={{ cursor: 'pointer' }}
      >
        <span className="git-panel__item-name">{file.name}</span>
        {displayDir && <span className="git-panel__item-path">{displayDir}</span>}
      </div>
      <span className={`git-panel__item-status git-panel__item-status--${file.status}`}>
        {file.status === 'untracked' ? 'U' : file.status[0].toUpperCase()}
      </span>
      <div className="git-panel__item-actions">
        <button className="git-panel__action-btn" onClick={() => onOpenFile(file.path)} title={t('git.openFile')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
        {isStaged ? (
          <button className="git-panel__action-btn" onClick={() => onAction(file.path)} title={t('git.unstage')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        ) : (
          <>
            {onDiscard && (
              <button className="git-panel__action-btn" onClick={() => onDiscard(file.path)} title={t('git.discard')}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
            )}
            <button className="git-panel__action-btn" onClick={() => onAction(file.path)} title={t('git.stage')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
});

function GitPanel({ refresh }: { refresh: () => Promise<void> }) {
  const { t } = useTranslation();
  const { activeWorkspaceId, workspaces, gitStatus: status } = useAppState();
  const dispatch = useAppDispatch();
  const [commitMessage, setCommitMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefreshClick = useCallback(async () => {
    if (isSpinning) return;
    setIsSpinning(true);
    await refresh();
    setTimeout(() => {
      setIsSpinning(false);
    }, 600);
  }, [refresh, isSpinning]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  const handleItemClick = useCallback((fileRelPath: string) => {
    if (!activeWorkspace) return;
    const absPath = `${activeWorkspace.path}/${fileRelPath}`.replace(/\\/g, '/');
    dispatch({ type: 'SET_DIFF_FILE_PATH', payload: absPath });
    dispatch({ type: 'SET_DIFF_SIDEBAR_OPEN', payload: true });
  }, [activeWorkspace, dispatch]);

  useEffect(() => {
    setCommitMessage('');
    setError(null);
  }, [activeWorkspaceId]);

  const handleOpenFile = useCallback((fileRelPath: string) => {
    if (!activeWorkspace) return;
    const absPath = `${activeWorkspace.path}/${fileRelPath}`.replace(/\\/g, '/');
    const fileName = fileRelPath.substring(fileRelPath.lastIndexOf('/') + 1);
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-editor-${absPath}`,
        type: 'editor',
        title: fileName,
        filePath: absPath,
      },
    });
  }, [activeWorkspace, dispatch]);

  const handleDiscard = useCallback(async (fileRelPath: string) => {
    if (!activeWorkspace) return;
    try {
      await gitDiscardFile(activeWorkspace.path, fileRelPath);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleStage = useCallback(async (file: string) => {
    if (!activeWorkspace) return;
    try {
      await gitStage(activeWorkspace.path, file);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleUnstage = useCallback(async (file: string) => {
    if (!activeWorkspace) return;
    try {
      await gitUnstage(activeWorkspace.path, file);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleStageAll = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      await gitStageAll(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleUnstageAll = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      await gitUnstageAll(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [activeWorkspace, refresh]);

  const handleCommit = useCallback(async () => {
    if (!activeWorkspace || !commitMessage.trim()) return;
    setActionLoading('commit');
    try {
      await gitCommit(activeWorkspace.path, commitMessage);
      setCommitMessage('');
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, commitMessage, refresh]);

  const handlePush = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('push');
    try {
      await gitPush(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handlePull = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('pull');
    try {
      await gitPull(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleFetch = useCallback(async () => {
    if (!activeWorkspace) return;
    setActionLoading('fetch');
    try {
      await gitFetch(activeWorkspace.path);
      await refresh();
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setActionLoading(null);
    }
  }, [activeWorkspace, refresh]);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleCommit();
    }
  }, [handleCommit]);

  if (!activeWorkspace) {
    return (
      <div className="git-panel git-panel--empty">
        <p className="git-panel__message">{t('git.noActiveWorkspace')}</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="git-panel git-panel--empty">
        <p className="git-panel__message">{t('git.loading')}</p>
      </div>
    );
  }

  if (!status.isRepo) {
    return (
      <div className="git-panel git-panel--no-repo">
        <div className="git-panel__no-repo-content">
          <svg className="git-panel__no-repo-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
          <h3 className="git-panel__no-repo-title">{t('git.noRepo')}</h3>
          <p className="git-panel__no-repo-subtitle">
            {t('git.noRepoSubtitle')}
          </p>
        </div>
      </div>
    );
  }

  const totalChanges = status.staged.length + status.unstaged.length;

  return (
    <div className="git-panel">
      <div className="git-panel__header">

        <div className="git-panel__actions">
          <button className="git-panel__header-btn" onClick={handlePull} disabled={!!actionLoading} title={t('git.pull')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16z" />
              <path d="M12 16a2.5 2.5 0 0 1 0-5 3 3 0 0 1 3.5.5A2 2 0 0 1 17 13.5a2.5 2.5 0 0 1-2.5 2.5h-2.5z" />
            </svg>
          </button>
          <button className="git-panel__header-btn" onClick={handleFetch} disabled={!!actionLoading} title={t('git.fetch')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button className="git-panel__header-btn" onClick={handleRefreshClick} title={t('git.refresh')}>
            <svg 
              className={isSpinning ? 'git-panel__refresh-icon--spinning' : ''} 
              width="14" 
              height="14" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="git-panel__error-banner">
          <span className="git-panel__error-text">{error}</span>
          <button className="git-panel__error-close" onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="git-panel__commit-container">
        <div className="git-panel__textarea-wrapper">
          <textarea
            className="git-panel__textarea"
            placeholder={t('git.commitMessage')}
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            disabled={!!actionLoading}
          />
          <span className="git-panel__textarea-hint">{t('git.commitHint')}</span>
        </div>

        <div className="git-panel__commit-status">
          <span>
            {status.staged.length > 0
              ? t('git.staged', { count: status.staged.length })
              : t('git.noStaged')}
          </span>
          <span className="git-panel__remote-info">origin/{status.branch}</span>
        </div>

        <div className="git-panel__action-row">
          <button
            className="git-panel__btn git-panel__btn--commit"
            onClick={handleCommit}
            disabled={status.staged.length === 0 || !!actionLoading}
          >
            {actionLoading === 'commit' ? t('git.committing') : t('git.commit')}
          </button>
          <button
            className="git-panel__btn git-panel__btn--push"
            onClick={handlePush}
            disabled={!!actionLoading}
          >
            {actionLoading === 'push' ? t('git.pushing') : t('git.push')}
          </button>
        </div>
      </div>

      <div className="git-panel__lists">
        {status.staged.length > 0 && (
          <div className="git-panel__section">
            <div className="git-panel__section-header">
              <div className="git-panel__section-title">
                <span>{t('git.stagedChanges')}</span>
                <span className="git-panel__badge">{status.staged.length}</span>
              </div>
              <div className="git-panel__section-actions">
                <span className="git-panel__all-text">{t('git.all')}</span>
                <button className="git-panel__section-btn--peach" onClick={handleUnstageAll} title={t('git.unstageAll')}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="git-panel__section-list">
              {status.staged.map(f => (
                <GitPanelItem
                  key={`staged-${f.path}`}
                  file={f}
                  isStaged={true}
                  onItemClick={handleItemClick}
                  onOpenFile={handleOpenFile}
                  onAction={handleUnstage}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {status.unstaged.length > 0 && (
          <div className="git-panel__section">
            <div className="git-panel__section-header">
              <div className="git-panel__section-title">
                <span>{t('git.changes')}</span>
                <span className="git-panel__badge">{status.unstaged.length}</span>
              </div>
              <div className="git-panel__section-actions">
                <span className="git-panel__all-text">{t('git.all')}</span>
                <button className="git-panel__section-btn--peach" onClick={handleStageAll} title={t('git.stageAll')}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="git-panel__section-list">
              {status.unstaged.map(f => (
                <GitPanelItem
                  key={`unstaged-${f.path}`}
                  file={f}
                  isStaged={false}
                  onItemClick={handleItemClick}
                  onOpenFile={handleOpenFile}
                  onAction={handleStage}
                  onDiscard={handleDiscard}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {totalChanges === 0 && (
          <div className="git-panel__section git-panel__section--clean">
            <p className="git-panel__clean-message">{t('git.noChanges')}</p>
          </div>
        )}

        {status.aheadCommits.length > 0 && (
          <div className="git-panel__section git-panel__section--ahead">
            <div className="git-panel__section-header">
              <span>{t('git.unsyncedCommits', { count: status.aheadCommits.length })}</span>
            </div>
            <div className="git-panel__section-list">
              {status.aheadCommits.map(c => (
                <div key={c.hash} className="git-panel__commit-item" title={`${c.message}\nBy ${c.author} on ${c.date}`}>
                  <svg className="git-panel__commit-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2" x2="12" y2="8" />
                    <line x1="12" y1="16" x2="12" y2="22" />
                  </svg>
                  <div className="git-panel__commit-details">
                    <span className="git-panel__commit-msg">{c.message}</span>
                    <span className="git-panel__commit-meta">{c.hash} &bull; {c.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FileDrawer() {
  const { t } = useTranslation();
  const { fileDrawerOpen, activeWorkspaceId, workspaces, drawerTab, gitStatus: status, panelSizes } = useAppState();
  const dispatch = useAppDispatch();
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const lastPathRef = useRef<string>('');

  const [drawerWidth, setDrawerWidth] = useState<number>((panelSizes || {})['fileDrawer']?.[0] ?? 300);
  const drawerWidthRef = useRef(drawerWidth);
  drawerWidthRef.current = drawerWidth;
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeStartRef.current = {
      startX: e.clientX,
      startWidth: drawerWidthRef.current,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.startX - e.clientX;
      const newWidth = Math.max(240, Math.min(500, resizeStartRef.current.startWidth + delta));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (resizeStartRef.current) {
        dispatch({
          type: 'SET_PANEL_SIZES',
          payload: { key: 'fileDrawer', sizes: [drawerWidthRef.current] },
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

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  useEffect(() => {
    if (fileDrawerOpen && activeWorkspace && drawerTab === 'files') {
      const currentPath = activeWorkspace.path;
      const pathChanged = lastPathRef.current !== currentPath;
      lastPathRef.current = currentPath;

      if (pathChanged || rootEntries.length === 0) {
        setLoading(true);
      }

      readDir(currentPath)
        .then(entries => {
          setRootEntries(entries);
        })
        .catch(err => console.error('Error loading workspace root:', err))
        .finally(() => setLoading(false));
    }
  }, [fileDrawerOpen, activeWorkspace, drawerTab, rootEntries.length]);

  const refreshGit = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const res = await gitStatus(activeWorkspace.path);
      dispatch({ type: 'SET_GIT_STATUS', payload: res });
    } catch (err) {
      console.error('Failed to query git status:', err);
    }
  }, [activeWorkspace, dispatch]);

  useEffect(() => {
    if (fileDrawerOpen && activeWorkspace) {
      refreshGit();
    }
  }, [fileDrawerOpen, activeWorkspace, refreshGit]);

  const handleFileClick = useCallback((entry: FileEntry) => {
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-editor-${entry.path}`,
        type: 'editor',
        title: entry.name,
        filePath: entry.path,
      },
    });
  }, [dispatch]);

  const totalChanges = activeWorkspace && status?.isRepo ? (status.staged.length + status.unstaged.length) : 0;
  const changesText = activeWorkspace && status?.isRepo
    ? totalChanges === 1
      ? '1 Change'
      : `${totalChanges} Changes`
    : 'Changes';

  return (
    <div 
      className={`file-drawer ${!fileDrawerOpen ? 'file-drawer--closed' : ''}`} 
      style={{ 
        width: `${drawerWidth}px`,
        display: !fileDrawerOpen ? 'none' : 'flex'
      }}
    >
      <ResizeHandle position="left" onResizeStart={handleResizeStart} />
      
      {/* Top Capsule Switcher */}
      <div className="file-drawer__top-tabs">
        <button
          className={`file-drawer__top-tab ${drawerTab === 'git' ? 'file-drawer__top-tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DRAWER_TAB', payload: 'git' })}
        >
          {changesText}
        </button>
        <button
          className={`file-drawer__top-tab ${drawerTab === 'files' ? 'file-drawer__top-tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DRAWER_TAB', payload: 'files' })}
        >
          All files
        </button>
      </div>

      <div className="file-drawer__content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {drawerTab === 'files' ? (
          <div className="file-drawer__tree" style={{ flex: 1, overflowY: 'auto' }}>
            {!activeWorkspace ? (
              <p style={{
                padding: 'var(--space-lg)',
                color: 'var(--color-mute)',
                fontSize: 'var(--text-caption)',
              }}>
                {t('drawer.noWorkspace')}
              </p>
            ) : loading ? (
              <p style={{
                padding: 'var(--space-lg)',
                color: 'var(--color-mute)',
                fontSize: 'var(--text-caption)',
              }}>
                {t('drawer.loading')}
              </p>
            ) : rootEntries.length === 0 ? (
              <p style={{
                padding: 'var(--space-lg)',
                color: 'var(--color-mute)',
                fontSize: 'var(--text-caption)',
              }}>
                {t('drawer.emptyWorkspace')}
              </p>
            ) : (
              rootEntries.map(entry => (
                <TreeItem
                  key={entry.path}
                  entry={entry}
                  depth={0}
                  onFileClick={handleFileClick}
                />
              ))
            )}
          </div>
        ) : (
          <GitPanel refresh={refreshGit} />
        )}
      </div>
    </div>
  );
}
