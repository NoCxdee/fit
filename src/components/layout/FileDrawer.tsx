/* ================================================================
   Fit — FileDrawer Component (Right Sidebar)
   Optimized: TreeItem memoized with pre-computed Sets,
   granular selectors, removed duplicate git polling.
   ================================================================ */

import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useAppSelector, useAppDispatch, useGitStatus, useOpenTabs, useWorkspaces, useActiveWorkspaceId } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { getFileIcon, FolderClosedIcon, FolderOpenIcon } from '../../utils/fileIcons';
import { 
  readDir,
  createFile,
  createDir,
  searchFiles,
  renameItem,
  deleteItem
} from '../../utils/ipc';
import { FileContextMenu } from './FileContextMenu';
import type { FileEntry } from '../../types';
import { ResizeHandle } from './ResizeHandle';
import { Search, FilePlus2, FolderPlus, RotateCw, Folder, GitBranch, MoreHorizontal, ChevronRight } from 'lucide-react';

interface InlineRenameInputProps {
  initialValue: string;
  onSubmit: (val: string) => void;
  onCancel: () => void;
}

const InlineRenameInput = ({ initialValue, onSubmit, onCancel }: InlineRenameInputProps) => {
  const [val, setVal] = useState(initialValue);
  const isFinished = useRef(false);

  const finish = (action: () => void) => {
    if (isFinished.current) return;
    isFinished.current = true;
    action();
  };

  return (
    <input
      className="file-drawer__create-input"
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        finish(() => {
          if (val.trim() && val.trim() !== initialValue) {
            onSubmit(val.trim());
          } else {
            onCancel();
          }
        });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          finish(() => {
            if (val.trim() && val.trim() !== initialValue) {
              onSubmit(val.trim());
            } else {
              onCancel();
            }
          });
        } else if (e.key === 'Escape') {
          finish(onCancel);
        }
      }}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{
        margin: 0,
        height: '20px',
        padding: '0 4px',
      }}
    />
  );
};

interface TreeItemProps {
  entry: FileEntry;
  depth: number;
  onFileClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  modifiedPaths: Set<string>;
  modifiedDirPrefixes: Set<string>;
  renamingPath: string | null;
  onRenameComplete: (entry: FileEntry, name: string) => Promise<void>;
  onRenameCancel: () => void;
  onStartRename: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

const TreeItem = memo(function TreeItem({ 
  entry, 
  depth, 
  onFileClick, 
  onContextMenu, 
  modifiedPaths, 
  modifiedDirPrefixes,
  renamingPath,
  onRenameComplete,
  onRenameCancel,
  onStartRename,
  selectedPath,
  onSelect
}: TreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const lastClickRef = useRef<number>(0);

  const isDir = entry.isDir || (entry as any).is_dir;

  const normalizePath = (p: string) => p.replace(/\\/g, '/');
  const normalizedPath = normalizePath(entry.path);

  // O(1) lookup instead of O(n) .some()
  const isModified = !isDir && modifiedPaths.has(normalizedPath);
  const hasModifiedChildren = isDir && modifiedDirPrefixes.has(normalizedPath + '/');
  const isSelected = selectedPath === entry.path;

  const handleClick = async (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isNameClick = !!target.closest('.file-tree-item__name');

    const now = Date.now();
    const delay = now - lastClickRef.current;
    lastClickRef.current = now;

    if (delay < 300) {
      return;
    }

    if (isNameClick && delay > 300 && delay < 1200) {
      onStartRename(entry.path);
      return;
    }

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
    isSelected ? 'file-tree-item--selected' : '',
  ].filter(Boolean).join(' ');

  const isEditing = renamingPath === entry.path;

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = e.target as HTMLElement;
    const isNameClick = !!target.closest('.file-tree-item__name');
    if (isNameClick) {
      onStartRename(entry.path);
    }
  };

  return (
    <>
      <div
        className={itemClassName}
        onClick={(e) => {
          onSelect(entry.path);
          handleClick(e);
        }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('application/fit-file-path', entry.path);
          e.dataTransfer.setData('text/plain', entry.path);
          e.dataTransfer.effectAllowed = 'copy';
        }}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
        data-path={entry.path}
        data-is-dir={isDir ? 'true' : 'false'}
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

        {isEditing ? (
          <InlineRenameInput
            initialValue={entry.name}
            onSubmit={(val) => onRenameComplete(entry, val)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="file-tree-item__name">{entry.name}</span>
        )}
        {!isEditing && (isModified || hasModifiedChildren) && <span className="file-tree-item__modified-dot" />}
      </div>

      {isDir && expanded && children && children.map(child => (
        <TreeItem
          key={child.path}
          entry={child}
          depth={depth + 1}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          modifiedPaths={modifiedPaths}
          modifiedDirPrefixes={modifiedDirPrefixes}
          renamingPath={renamingPath}
          onRenameComplete={onRenameComplete}
          onRenameCancel={onRenameCancel}
          onStartRename={onStartRename}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </>
  );
});

import { GitPanel } from './GitPanel';

export function FileDrawer() {
  const { t, lang } = useTranslation();
  const fileDrawerOpen = useAppSelector(s => s.fileDrawerOpen);
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaces = useWorkspaces();
  const drawerTab = useAppSelector(s => s.drawerTab);
  const status = useGitStatus();
  const panelSizes = useAppSelector(s => s.panelSizes);
  const openTabs = useOpenTabs();
  const dispatch = useAppDispatch();
  const [rootEntries, setRootEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const lastPathRef = useRef<string>('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Search & inline create states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [isAddingFile, setIsAddingFile] = useState(false);
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Pre-compute Sets for O(1) modified path lookups in TreeItem
  const { modifiedPaths, modifiedDirPrefixes } = useMemo(() => {
    const paths = new Set<string>();
    const dirPrefixes = new Set<string>();
    const normalizePath = (p: string) => p.replace(/\\/g, '/');

    if (activeWorkspace) {
      const wsPath = normalizePath(activeWorkspace.path);

      // From git status
      if (status && status.isRepo) {
        const addPath = (relPath: string) => {
          const normalized = normalizePath(relPath);
          const absPath = `${wsPath}/${normalized}`;
          paths.add(absPath);
          // Add all parent directory prefixes
          const parts = normalized.split('/');
          for (let i = 1; i < parts.length; i++) {
            dirPrefixes.add(`${wsPath}/${parts.slice(0, i).join('/')}/`);
          }
          // Also add wsPath itself as having modified children
          if (parts.length > 0) {
            dirPrefixes.add(`${wsPath}/`);
          }
        };

        status.staged.forEach(s => addPath(s.path));
        status.unstaged.forEach(u => addPath(u.path));
      }

      // From modified tabs
      openTabs.forEach(tab => {
        if (tab.type === 'editor' && tab.isModified && tab.filePath) {
          const absPath = normalizePath(tab.filePath);
          paths.add(absPath);
          // Add parent directory prefixes
          if (absPath.startsWith(wsPath + '/')) {
            const relPath = absPath.substring(wsPath.length + 1);
            const parts = relPath.split('/');
            for (let i = 1; i < parts.length; i++) {
              dirPrefixes.add(`${wsPath}/${parts.slice(0, i).join('/')}/`);
            }
            if (parts.length > 0) {
              dirPrefixes.add(`${wsPath}/`);
            }
          }
        }
      });
    }

    return { modifiedPaths: paths, modifiedDirPrefixes: dirPrefixes };
  }, [status, openTabs, activeWorkspace]);

  const refreshFiles = useCallback(() => {
    if (!activeWorkspace) return;
    setLoading(true);
    readDir(activeWorkspace.path)
      .then(entries => {
        setRootEntries(entries);
      })
      .catch(err => console.error('Error loading workspace root:', err))
      .finally(() => setLoading(false));
  }, [activeWorkspace]);

  const refreshGit = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const { gitStatus: gitStatusFn } = await import('../../utils/ipc');
      const res = await gitStatusFn(activeWorkspace.path);
      dispatch({ type: 'SET_GIT_STATUS', payload: res });
    } catch (err) {
      console.error('Failed to refresh git status:', err);
    }
  }, [activeWorkspace, dispatch]);

  // Right-click context menu states and handlers
  const [fileContextMenu, setFileContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<FileEntry | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setFileContextMenu({
      x: e.clientX,
      y: e.clientY,
      entry,
    });
  }, []);

  const handleRenameComplete = useCallback(async (entry: FileEntry, name: string) => {
    if (!activeWorkspace) return;
    const oldPath = entry.path;
    const parentPath = oldPath.substring(0, Math.max(oldPath.lastIndexOf('/'), oldPath.lastIndexOf('\\')));
    const newPath = `${parentPath}/${name}`.replace(/\\/g, '/');

    try {
      await renameItem(oldPath, newPath);

      // Close open tabs inside the renamed file/directory
      openTabs.forEach(tab => {
        const tabNormalized = tab.filePath ? tab.filePath.replace(/\\/g, '/') : '';
        const oldNormalized = oldPath.replace(/\\/g, '/');
        if (tabNormalized && (tabNormalized === oldNormalized || tabNormalized.startsWith(oldNormalized + '/'))) {
          dispatch({ type: 'CLOSE_TAB', payload: tab.id });
        }
      });

      // If it's a file, open it in the editor
      const isDir = entry.isDir || (entry as any).is_dir;
      if (!isDir) {
        dispatch({
          type: 'OPEN_TAB',
          payload: {
            id: `tab-editor-${newPath}`,
            type: 'editor',
            title: name,
            filePath: newPath,
          },
        });
      }

      setRenamingPath(null);
      refreshFiles();
      refreshGit();
    } catch (err) {
      console.error('Failed to rename item:', err);
    }
  }, [activeWorkspace, openTabs, dispatch, refreshFiles, refreshGit]);

  const handleRenameCancel = useCallback(() => {
    setRenamingPath(null);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deletingEntry || !activeWorkspace) return;

    const path = deletingEntry.path;

    try {
      await deleteItem(path);

      // Close open tabs inside the deleted file/directory
      openTabs.forEach(tab => {
        if (tab.filePath && (tab.filePath === path || tab.filePath.startsWith(path + '/'))) {
          dispatch({ type: 'CLOSE_TAB', payload: tab.id });
        }
      });

      setDeletingEntry(null);
      refreshFiles();
      refreshGit();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

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

  // Debounced search effect
  useEffect(() => {
    if (!activeWorkspace || searchQuery.trim() === '') {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const delayDebounce = setTimeout(() => {
      searchFiles(activeWorkspace.path, searchQuery)
        .then(results => {
          setSearchResults(results);
        })
        .catch(err => console.error('Search error:', err))
        .finally(() => setSearching(false));
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, activeWorkspace]);

  // Keyboard navigation effect
  useEffect(() => {
    if (!isHovered || !activeWorkspace) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if editing or focused on inputs
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        return;
      }

      if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', ' ', 'Enter'].includes(e.key)) {
        const selector = '.file-tree-item, .file-drawer__search-result-item';
        const items = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
        if (items.length === 0) return;

        e.preventDefault();

        const currentIndex = items.findIndex(el => el.getAttribute('data-path') === selectedPath);

        if (e.key === 'ArrowDown') {
          let nextIndex = currentIndex + 1;
          if (nextIndex >= items.length || currentIndex === -1) nextIndex = 0;
          const targetItem = items[nextIndex];
          if (targetItem) {
            const nextPath = targetItem.getAttribute('data-path');
            setSelectedPath(nextPath);
            targetItem.scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === 'ArrowUp') {
          let prevIndex = currentIndex - 1;
          if (prevIndex < 0 || currentIndex === -1) prevIndex = items.length - 1;
          const targetItem = items[prevIndex];
          if (targetItem) {
            const prevPath = targetItem.getAttribute('data-path');
            setSelectedPath(prevPath);
            targetItem.scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === ' ' || e.key === 'Enter') {
          const currentItem = items[currentIndex];
          if (currentItem) {
            currentItem.click();
          }
        } else if (e.key === 'ArrowRight') {
          const currentItem = items[currentIndex];
          if (currentItem) {
            const isDir = currentItem.getAttribute('data-is-dir') === 'true';
            if (isDir) {
              const chevron = currentItem.querySelector('.file-tree-item__chevron');
              const isExpanded = chevron?.classList.contains('file-tree-item__chevron--open');
              if (!isExpanded) {
                // Expand it
                currentItem.click();
              } else {
                // Go to first child (next item in DOM)
                const nextIndex = currentIndex + 1;
                if (nextIndex < items.length) {
                  const targetItem = items[nextIndex];
                  const nextPath = targetItem.getAttribute('data-path');
                  setSelectedPath(nextPath);
                  targetItem.scrollIntoView({ block: 'nearest' });
                }
              }
            }
          }
        } else if (e.key === 'ArrowLeft') {
          const currentItem = items[currentIndex];
          if (currentItem) {
            const isDir = currentItem.getAttribute('data-is-dir') === 'true';
            const chevron = currentItem.querySelector('.file-tree-item__chevron');
            const isExpanded = chevron?.classList.contains('file-tree-item__chevron--open');
            
            if (isDir && isExpanded) {
              // Collapse it
              currentItem.click();
            } else {
              // Go to parent directory
              const currentPath = currentItem.getAttribute('data-path');
              if (currentPath) {
                const parentPath = currentPath.substring(0, Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\')));
                const parentItem = items.find(el => el.getAttribute('data-path') === parentPath);
                if (parentItem) {
                  const nextPath = parentItem.getAttribute('data-path');
                  setSelectedPath(nextPath);
                  parentItem.scrollIntoView({ block: 'nearest' });
                }
              }
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHovered, selectedPath, activeWorkspace]);

  const handleFileClick = useCallback((entry: FileEntry) => {
    const normalizePath = (p: string) => p.replace(/\\/g, '/');
    const normalizedPath = normalizePath(entry.path);
    const isModified = modifiedPaths.has(normalizedPath);

    const ext = entry.name.split('.').pop()?.toLowerCase();
    const isImage = ext ? ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tiff', 'tif', 'avif', 'apng'].includes(ext) : false;

    if (isModified && !isImage) {
      dispatch({
        type: 'OPEN_TAB',
        payload: {
          id: `tab-diff-${entry.path}`,
          type: 'diff',
          title: entry.name,
          filePath: entry.path,
        },
      });
    } else {
      dispatch({
        type: 'OPEN_TAB',
        payload: {
          id: `tab-editor-${entry.path}`,
          type: 'editor',
          title: entry.name,
          filePath: entry.path,
        },
      });
    }
  }, [dispatch, modifiedPaths]);

  const handleCreateItemSubmit = async () => {
    if (!activeWorkspace || !newItemName.trim()) {
      cancelCreate();
      return;
    }

    const fullPath = `${activeWorkspace.path}/${newItemName.trim()}`;
    try {
      if (isAddingFile) {
        await createFile(fullPath);
        // Automatically open the new file in the editor!
        dispatch({
          type: 'OPEN_TAB',
          payload: {
            id: `tab-editor-${fullPath}`,
            type: 'editor',
            title: newItemName.trim().split('/').pop() || newItemName.trim(),
            filePath: fullPath,
          },
        });
      } else {
        await createDir(fullPath);
      }
      refreshFiles();
      cancelCreate();
    } catch (err) {
      console.error('Failed to create item:', err);
      cancelCreate();
    }
  };

  const cancelCreate = () => {
    setIsAddingFile(false);
    setIsAddingFolder(false);
    setNewItemName('');
  };

  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const totalChanges = activeWorkspace && status?.isRepo ? (status.staged.length + status.unstaged.length) : 0;
  const changesText = activeWorkspace && status?.isRepo
    ? totalChanges === 1
      ? t('drawer.tab.git.change')
      : t('drawer.tab.git.changes_plural', { count: totalChanges })
    : t('drawer.tab.git.changes');

  return (
    <div 
      className={`file-drawer ${!fileDrawerOpen ? 'file-drawer--closed' : ''}`} 
      style={{ 
        width: `${drawerWidth}px`,
        display: !fileDrawerOpen ? 'none' : 'flex'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ResizeHandle position="left" onResizeStart={handleResizeStart} />
      
      {/* Top Capsule Switcher */}
      <div className="file-drawer__top-tabs">
        <button
          className={`file-drawer__top-tab ${drawerTab === 'files' ? 'file-drawer__top-tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DRAWER_TAB', payload: 'files' })}
        >
          <Folder size={12} strokeWidth={2} />
          <span>{t('drawer.files')}</span>
        </button>
        <button
          className={`file-drawer__top-tab ${drawerTab === 'git' ? 'file-drawer__top-tab--active' : ''}`}
          onClick={() => dispatch({ type: 'SET_DRAWER_TAB', payload: 'git' })}
        >
          <GitBranch size={12} strokeWidth={2} />
          <span>{t('drawer.sourceControl')}</span>
          {totalChanges > 0 && (
            <span className="file-drawer__badge">{totalChanges}</span>
          )}
        </button>
      </div>

      <div className="file-drawer__content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'visible' }}>
        {drawerTab === 'files' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {activeWorkspace && (
              <>
                {/* Workspace Header Block */}
                <div className="file-drawer__workspace-header">
                  <span className="file-drawer__workspace-title" title={activeWorkspace.path}>
                    {activeWorkspace.name}
                  </span>
                  <div className="file-drawer__workspace-actions">
                    <button 
                      className="file-drawer__action-btn" 
                      onClick={handleFocusSearch} 
                      title={t('drawer.search')}
                    >
                      <Search size={14} />
                    </button>
                    <button 
                      className="file-drawer__action-btn" 
                      onClick={() => { cancelCreate(); setIsAddingFile(true); }} 
                      title={t('drawer.newFile')}
                    >
                      <FilePlus2 size={14} />
                    </button>
                    <button 
                      className="file-drawer__action-btn" 
                      onClick={() => { cancelCreate(); setIsAddingFolder(true); }} 
                      title={t('drawer.newFolder')}
                    >
                      <FolderPlus size={14} />
                    </button>
                    <button 
                      className="file-drawer__action-btn" 
                      onClick={() => { refreshFiles(); }} 
                      title={t('drawer.refresh')}
                    >
                      <RotateCw size={14} />
                    </button>
                  </div>
                </div>

                {/* Always-visible Search Input */}
                <div className="file-drawer__search-wrapper">
                  <input
                    ref={searchInputRef}
                    className="file-drawer__search-input"
                    type="text"
                    placeholder={t('drawer.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* File List / Results Tree Container */}
            <div className="file-drawer__tree" style={{ flex: 1, overflowY: 'auto' }}>
              {!activeWorkspace ? (
                <p style={{
                  padding: 'var(--space-lg)',
                  color: 'var(--color-mute)',
                  fontSize: 'var(--text-caption)',
                }}>
                  {t('drawer.noWorkspace')}
                </p>
              ) : loading && searchQuery.trim() === '' ? (
                <p style={{
                  padding: 'var(--space-lg)',
                  color: 'var(--color-mute)',
                  fontSize: 'var(--text-caption)',
                }}>
                  {t('drawer.loading')}
                </p>
              ) : searchQuery.trim() !== '' ? (
                /* Flat search results view */
                <>
                  {searching && searchResults.length === 0 ? (
                    <p style={{
                      padding: 'var(--space-lg)',
                      color: 'var(--color-mute)',
                      fontSize: 'var(--text-caption)',
                    }}>
                      {t('drawer.searching')}
                    </p>
                  ) : searchResults.length === 0 ? (
                    <p style={{
                      padding: 'var(--space-lg)',
                      color: 'var(--color-mute)',
                      fontSize: 'var(--text-caption)',
                    }}>
                      {t('drawer.noResults')}
                    </p>
                  ) : (
                    <div className="file-drawer__search-results">
                      {searchResults.map(entry => {
                        const relPath = entry.path.replace(activeWorkspace.path, '').replace(/^[\\/]/, '');
                        const icon = !entry.isDir ? getFileIcon(entry.name) : null;
                        const isSelected = selectedPath === entry.path;
                        return (
                          <div
                            key={entry.path}
                            className={`file-drawer__search-result-item ${isSelected ? 'file-drawer__search-result-item--selected' : ''}`}
                            onClick={() => {
                              setSelectedPath(entry.path);
                              if (!entry.isDir) {
                                handleFileClick(entry);
                              }
                            }}
                            data-path={entry.path}
                            data-is-dir={entry.isDir ? 'true' : 'false'}
                          >
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
                                color: entry.isDir ? undefined : icon?.color,
                                marginRight: '8px',
                              }}
                            >
                               {entry.isDir ? <FolderClosedIcon /> : icon?.icon}
                            </span>
                            <div className="file-drawer__search-result-details">
                              <span className="file-drawer__search-result-name">{entry.name}</span>
                              <span className="file-drawer__search-result-path" title={entry.path}>
                                {relPath}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                /* Standard tree listing */
                <>
                  {/* Inline Creation Rows */}
                  {(isAddingFile || isAddingFolder) && (
                    <div className="file-drawer__inline-create">
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
                          marginLeft: '12px',
                          marginRight: '6px',
                          color: isAddingFile ? '#e3cfb3' : 'var(--color-primary)',
                        }}
                      >
                        {isAddingFile ? getFileIcon(newItemName).icon : <FolderClosedIcon />}
                      </span>
                      <input
                        className="file-drawer__create-input"
                        type="text"
                        placeholder={isAddingFile ? t('drawer.newFilePlaceholder') : t('drawer.newFolderPlaceholder')}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        onBlur={handleCreateItemSubmit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateItemSubmit();
                          } else if (e.key === 'Escape') {
                            cancelCreate();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  )}

                  {rootEntries.length === 0 ? (
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
                        onContextMenu={handleContextMenu}
                        modifiedPaths={modifiedPaths}
                        modifiedDirPrefixes={modifiedDirPrefixes}
                        renamingPath={renamingPath}
                        onRenameComplete={handleRenameComplete}
                        onRenameCancel={handleRenameCancel}
                        onStartRename={setRenamingPath}
                        selectedPath={selectedPath}
                        onSelect={setSelectedPath}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <GitPanel />
        )}
      </div>

      {fileContextMenu && (
        <FileContextMenu
          x={fileContextMenu.x}
          y={fileContextMenu.y}
          entry={fileContextMenu.entry}
          onClose={() => setFileContextMenu(null)}
          onRename={() => {
            setRenamingPath(fileContextMenu.entry.path);
          }}
          onDelete={() => {
            setDeletingEntry(fileContextMenu.entry);
          }}
        />
      )}

      {deletingEntry && (
        <div className="modal-backdrop">
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal__header">
              <span className="edit-modal__title" style={{ color: 'var(--color-accent-red)' }}>{t('file.delete')}</span>
              <button type="button" className="edit-modal__close-btn" onClick={() => setDeletingEntry(null)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="edit-modal__body">
              <div style={{ color: 'var(--color-ink)', fontSize: 'var(--text-body)', padding: 'var(--space-sm) 0', fontFamily: 'var(--font-sans)' }}>
                {lang === 'it' ? 'Sei sicuro di voler eliminare ' : 'Are you sure you want to delete '}
                <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>{deletingEntry.name}</span>?
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--color-mute)', marginTop: '8px' }}>
                  {lang === 'it' ? 'Questa azione non può essere annullata.' : 'This action cannot be undone.'}
                </div>
              </div>
            </div>
            <div className="edit-modal__footer">
              <button type="button" className="edit-modal__btn edit-modal__btn--cancel" onClick={() => setDeletingEntry(null)}>
                {t('workspace.cancel') || 'Cancel'}
              </button>
              <button
                type="button"
                className="edit-modal__btn edit-modal__btn--delete"
                onClick={handleDeleteConfirm}
              >
                {t('file.delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
