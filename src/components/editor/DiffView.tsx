/* ================================================================
   Fit — DiffView Component
   Side-by-side split & unified visual diff with multi-file cards.
   ================================================================ */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAppState } from '../../stores/appStore';
import { readFile, gitShowFile } from '../../utils/ipc';
import { unsavedContents } from './CodeEditor';
import { getFileIcon } from '../../utils/fileIcons';

interface DiffViewProps {
  filePath?: string;
}

export interface DiffLine {
  leftNo?: number;
  leftText?: string;
  rightNo?: number;
  rightText?: string;
  type: 'added' | 'deleted' | 'unchanged' | 'modified';
}

// Compute line-by-line diff using dynamic programming (LCS)
// Compute line-by-line diff using dynamic programming (LCS) optimized with prefix/suffix trimming
function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);

  // 1. Trim common prefix
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
    start++;
  }

  // 2. Trim common suffix
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
    oldEnd--;
    newEnd--;
  }

  // Common prefix lines
  const prefixResult: DiffLine[] = [];
  for (let idx = 0; idx < start; idx++) {
    prefixResult.push({
      leftNo: idx + 1,
      leftText: oldLines[idx],
      rightNo: idx + 1,
      rightText: newLines[idx],
      type: 'unchanged',
    });
  }

  // Common suffix lines
  const suffixResult: DiffLine[] = [];
  const suffixLen = oldLines.length - 1 - oldEnd;
  for (let idx = 0; idx < suffixLen; idx++) {
    const oldIdx = oldEnd + 1 + idx;
    const newIdx = newEnd + 1 + idx;
    suffixResult.push({
      leftNo: oldIdx + 1,
      leftText: oldLines[oldIdx],
      rightNo: newIdx + 1,
      rightText: newLines[newIdx],
      type: 'unchanged',
    });
  }

  // DP on the middle part
  const midOld = oldLines.slice(start, oldEnd + 1);
  const midNew = newLines.slice(start, newEnd + 1);

  let midResult: DiffLine[] = [];
  if (midOld.length > 0 || midNew.length > 0) {
    const dp: number[][] = Array(midOld.length + 1)
      .fill(0)
      .map(() => Array(midNew.length + 1).fill(0));

    for (let i = 1; i <= midOld.length; i++) {
      for (let j = 1; j <= midNew.length; j++) {
        if (midOld[i - 1] === midNew[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    let i = midOld.length;
    let j = midNew.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && midOld[i - 1] === midNew[j - 1]) {
        midResult.unshift({
          leftNo: start + i,
          leftText: midOld[i - 1],
          rightNo: start + j,
          rightText: midNew[j - 1],
          type: 'unchanged',
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        midResult.unshift({
          rightNo: start + j,
          rightText: midNew[j - 1],
          type: 'added',
        });
        j--;
      } else {
        midResult.unshift({
          leftNo: start + i,
          leftText: midOld[i - 1],
          type: 'deleted',
        });
        i--;
      }
    }
  }

  const result = [...prefixResult, ...midResult, ...suffixResult];

  // Align consecutive deleted and added lines side by side as 'modified'
  const aligned: DiffLine[] = [];
  let k = 0;
  while (k < result.length) {
    if (result[k].type === 'deleted') {
      const dels: DiffLine[] = [];
      while (k < result.length && result[k].type === 'deleted') {
        dels.push(result[k]);
        k++;
      }
      const adds: DiffLine[] = [];
      while (k < result.length && result[k].type === 'added') {
        adds.push(result[k]);
        k++;
      }

      const maxLen = Math.max(dels.length, adds.length);
      for (let m = 0; m < maxLen; m++) {
        const del = dels[m];
        const add = adds[m];
        if (del && add) {
          aligned.push({
            leftNo: del.leftNo,
            leftText: del.leftText,
            rightNo: add.rightNo,
            rightText: add.rightText,
            type: 'modified',
          });
        } else if (del) {
          aligned.push(del);
        } else if (add) {
          aligned.push(add);
        }
      }
    } else {
      aligned.push(result[k]);
      k++;
    }
  }

  return aligned;
}

interface DiffFileCardProps {
  filePath: string;
  wsPath: string;
  isSplitMode: boolean;
  initiallyExpanded: boolean;
  expandTrigger: { action: 'expand' | 'collapse'; timestamp: number } | null;
  diffLines: DiffLine[];
  loading: boolean;
  error: string | null;
}

const DiffFileCard = memo(function DiffFileCard({
  filePath,
  wsPath,
  isSplitMode,
  initiallyExpanded,
  expandTrigger,
  diffLines,
  loading,
  error,
}: DiffFileCardProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const firstChangeRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);

  // Reset scroll flag when collapsed or filePath changes
  useEffect(() => {
    if (!expanded) {
      hasScrolledRef.current = false;
    }
  }, [expanded, filePath]);

  const firstChangeIndex = diffLines.findIndex(
    l => l.type === 'added' || l.type === 'deleted' || l.type === 'modified'
  );

  useEffect(() => {
    setExpanded(initiallyExpanded);
  }, [initiallyExpanded]);

  useEffect(() => {
    if (expandTrigger) {
      setExpanded(expandTrigger.action === 'expand');
    }
  }, [expandTrigger]);

  // Scroll to the first modified line when the card loads or is expanded
  useEffect(() => {
    if (expanded && !loading && !hasScrolledRef.current && firstChangeIndex !== -1 && firstChangeRef.current && scrollerRef.current) {
      hasScrolledRef.current = true;
      const scroller = scrollerRef.current;
      const target = firstChangeRef.current;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetTop = targetRect.top - scrollerRect.top + scroller.scrollTop;
      scroller.scrollTo({
        top: offsetTop - scrollerRect.height / 2 + targetRect.height / 2,
        behavior: 'smooth'
      });
    }
  }, [expanded, loading, diffLines, firstChangeIndex]);

  // Count additions and deletions
  const additions = diffLines.filter(l => l.type === 'added').length + diffLines.filter(l => l.type === 'modified').length;
  const deletions = diffLines.filter(l => l.type === 'deleted').length + diffLines.filter(l => l.type === 'modified').length;

  const getDisplayFilename = (path: string): string => {
    return path.substring(path.lastIndexOf('/') + 1);
  };

  const fileIcon = getFileIcon(getDisplayFilename(filePath));

  const getDisplayDir = (path: string): string => {
    let relPath = path;
    if (wsPath && path.startsWith(wsPath + '/')) {
      relPath = path.substring(wsPath.length + 1);
    }
    const lastSlash = relPath.lastIndexOf('/');
    if (lastSlash !== -1) {
      return relPath.substring(0, lastSlash);
    }
    return '';
  };

  const renderRow = (line: DiffLine, index: number) => {
    if (isSplitMode) {
      let rowClass = 'diff-view__row';
      if (line.type === 'added') rowClass += ' diff-view__row--added';
      else if (line.type === 'deleted') rowClass += ' diff-view__row--deleted';
      else if (line.type === 'modified') rowClass += ' diff-view__row--modified';

      const renderLeft = () => {
        if (line.type === 'added') {
          return <div className="diff-view__cell diff-view__cell--empty diff-hatch-pattern" />;
        }
        return (
          <div className="diff-view__cell-container">
            <div className="diff-view__line-number diff-view__line-number--left">{line.leftNo}</div>
            <pre className="diff-view__line-text">{line.leftText || ' '}</pre>
          </div>
        );
      };

      const renderRight = () => {
        if (line.type === 'deleted') {
          return <div className="diff-view__cell diff-view__cell--empty diff-hatch-pattern" />;
        }
        return (
          <div className="diff-view__cell-container">
            <div className="diff-view__line-number diff-view__line-number--right">{line.rightNo}</div>
            <pre className="diff-view__line-text">{line.rightText || ' '}</pre>
          </div>
        );
      };

      return (
        <div key={`row-${index}`} ref={index === firstChangeIndex ? firstChangeRef : undefined} className={rowClass}>
          <div className="diff-view__pane diff-view__pane--left">{renderLeft()}</div>
          <div className="diff-view__pane diff-view__pane--right">{renderRight()}</div>
        </div>
      );
    } else {
      // Unified Mode
      if (line.type === 'modified') {
        // In unified mode, render deletion line followed by addition line
        return (
          <div key={`row-unified-mod-${index}`} ref={index === firstChangeIndex ? firstChangeRef : undefined} style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div className="diff-view__unified-row diff-view__unified-row--deleted">
              <div className="diff-view__unified-gutter">
                <div className="diff-view__unified-line-no diff-view__unified-line-no--left">{line.leftNo}</div>
                <div className="diff-view__unified-line-no" />
              </div>
              <pre className="diff-view__line-text">{line.leftText || ' '}</pre>
            </div>
            <div className="diff-view__unified-row diff-view__unified-row--added">
              <div className="diff-view__unified-gutter">
                <div className="diff-view__unified-line-no diff-view__unified-line-no--left" />
                <div className="diff-view__unified-line-no">{line.rightNo}</div>
              </div>
              <pre className="diff-view__line-text">{line.rightText || ' '}</pre>
            </div>
          </div>
        );
      }

      let rowClass = 'diff-view__unified-row';
      if (line.type === 'added') rowClass += ' diff-view__unified-row--added';
      else if (line.type === 'deleted') rowClass += ' diff-view__unified-row--deleted';

      return (
        <div key={`row-unified-${index}`} ref={index === firstChangeIndex ? firstChangeRef : undefined} className={rowClass}>
          <div className="diff-view__unified-gutter">
            <div className="diff-view__unified-line-no diff-view__unified-line-no--left">
              {line.type !== 'added' ? line.leftNo : ''}
            </div>
            <div className="diff-view__unified-line-no">
              {line.type !== 'deleted' ? line.rightNo : ''}
            </div>
          </div>
          <pre className="diff-view__line-text">{line.leftText || line.rightText || ' '}</pre>
        </div>
      );
    }
  };

  const renderDiffRows = () => {
    return diffLines.map((line, idx) => renderRow(line, idx));
  };

  return (
    <div className={`diff-card ${expanded ? 'diff-card--expanded' : ''}`}>
      <div className="diff-card__header" onClick={() => setExpanded(!expanded)}>
        <div className="diff-card__left">
          <svg className="diff-card__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span
            className="diff-card__icon"
            style={{
              width: '14px',
              height: '14px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: fileIcon.color,
              flexShrink: 0,
            }}
          >
            {fileIcon.icon}
          </span>
          <span className="diff-card__filename" title={filePath}>{getDisplayFilename(filePath)}</span>
          {getDisplayDir(filePath) && (
            <span style={{ fontSize: '11px', color: 'var(--color-mute)', marginLeft: 'var(--space-xs)' }}>{getDisplayDir(filePath)}</span>
          )}
        </div>
        <div className="diff-card__right">
          <div className="diff-view__stats" style={{ marginRight: 'var(--space-sm)' }}>
            <span className="diff-view__stat-additions">+{additions}</span>
            <span className="diff-view__stat-deletions">-{deletions}</span>
          </div>
        </div>
      </div>

      <div className="diff-card__body-wrapper">
        <div className="diff-card__body">
          {loading ? (
            null
          ) : error ? (
            <div className="diff-view__error" style={{ padding: 'var(--space-lg)' }}>{error}</div>
          ) : (
            <div ref={scrollerRef} className="diff-view__scroller" style={{ maxHeight: '500px' }}>
              <div className="diff-view__table">
                {renderDiffRows()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export function DiffView({ filePath: propFilePath }: DiffViewProps) {
  const { gitStatus, openTabs, activeWorkspaceId, workspaces } = useAppState();
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const wsPath = activeWorkspace ? activeWorkspace.path.replace(/\\/g, '/') : '';

  const [isSplitMode, setIsSplitMode] = useState(true);
  const [areAllExpanded, setAreAllExpanded] = useState(true);
  const [expandTrigger, setExpandTrigger] = useState<{ action: 'expand' | 'collapse'; timestamp: number } | null>(null);
  const [diffData, setDiffData] = useState<Record<string, { lines: DiffLine[]; loading: boolean; error: string | null }>>({});
  const [showLoaderDeferred, setShowLoaderDeferred] = useState(false);

  // Cache to store previous files' contents and computed lines references
  const diffCacheRef = useRef<Record<string, { original: string; modified: string; lines: DiffLine[] }>>({});

  const handleToggleAll = () => {
    const nextState = !areAllExpanded;
    setAreAllExpanded(nextState);
    setExpandTrigger({ action: nextState ? 'expand' : 'collapse', timestamp: Date.now() });
  };

  // Get list of all modified files with their source info
  interface ModifiedFileInfo {
    absPath: string;
    isStaged: boolean;
    isUnstaged: boolean;
  }

  const getModifiedFilesInfo = (): ModifiedFileInfo[] => {
    const map = new Map<string, ModifiedFileInfo>();

    if (propFilePath) {
      const abs = propFilePath.replace(/\\/g, '/');
      map.set(abs, { absPath: abs, isStaged: false, isUnstaged: true });
    }

    if (gitStatus && gitStatus.isRepo && activeWorkspace) {
      gitStatus.staged.forEach(f => {
        const abs = `${wsPath}/${f.path.replace(/\\/g, '/')}`;
        const existing = map.get(abs);
        if (existing) {
          existing.isStaged = true;
        } else {
          map.set(abs, { absPath: abs, isStaged: true, isUnstaged: false });
        }
      });
      gitStatus.unstaged.forEach(f => {
        const abs = `${wsPath}/${f.path.replace(/\\/g, '/')}`;
        const existing = map.get(abs);
        if (existing) {
          existing.isUnstaged = true;
        } else {
          map.set(abs, { absPath: abs, isStaged: false, isUnstaged: true });
        }
      });
    }

    openTabs.forEach(t => {
      if (t.type === 'editor' && t.isModified && t.filePath) {
        const abs = t.filePath.replace(/\\/g, '/');
        if (!map.has(abs)) {
          map.set(abs, { absPath: abs, isStaged: false, isUnstaged: true });
        }
      }
    });

    return Array.from(map.values());
  };

  const modifiedFilesInfo = getModifiedFilesInfo();
  const modifiedFiles = modifiedFilesInfo.map(f => f.absPath);

  // Load and cache all diffs in parallel
  useEffect(() => {
    let isMounted = true;

    // Initialize loading state for new files in diffData
    setDiffData(prev => {
      const next = { ...prev };
      let changed = false;

      modifiedFiles.forEach(path => {
        if (!next[path]) {
          next[path] = { lines: [], loading: true, error: null };
          changed = true;
        }
      });

      // Clean up cached files that are no longer in modifiedFiles list
      Object.keys(next).forEach(path => {
        if (!modifiedFiles.includes(path)) {
          delete next[path];
          changed = true;
        }
      });

      return changed ? next : prev;
    });

    async function loadAllDiffs() {
      const results = await Promise.all(
        modifiedFilesInfo.map(async (fileInfo) => {
          const { absPath: filePath, isStaged, isUnstaged } = fileInfo;
          try {
            let relativePath = filePath;
            if (wsPath && filePath.startsWith(wsPath + '/')) {
              relativePath = filePath.substring(wsPath.length + 1);
            }

            let original = '';
            let modified = '';

            if (gitStatus?.isRepo && activeWorkspace) {
              if (isStaged && !isUnstaged) {
                // File is ONLY staged: compare HEAD vs staging area (index)
                // Original = HEAD version, Modified = index version
                try {
                  original = await gitShowFile(activeWorkspace.path, relativePath, 'HEAD');
                } catch { original = ''; }
                try {
                  modified = await gitShowFile(activeWorkspace.path, relativePath, 'index');
                } catch { modified = ''; }
              } else if (isUnstaged) {
                // File has unstaged changes: compare index (staging area) vs working tree
                // Original = index version (or HEAD if not in index), Modified = working tree
                try {
                  original = await gitShowFile(activeWorkspace.path, relativePath, 'index');
                } catch { original = ''; }

                const unsaved = unsavedContents.get(filePath);
                if (unsaved !== undefined) {
                  modified = unsaved;
                } else {
                  try {
                    modified = await readFile(filePath);
                  } catch { modified = ''; }
                }
              }
            } else {
              // Not a git repo — just compare empty with current content
              const unsaved = unsavedContents.get(filePath);
              if (unsaved !== undefined) {
                modified = unsaved;
              } else {
                try {
                  modified = await readFile(filePath);
                } catch { modified = ''; }
              }
            }

            // Check cache before computing
            const cached = diffCacheRef.current[filePath];
            if (cached && cached.original === original && cached.modified === modified) {
              return { filePath, lines: cached.lines, error: null };
            }

            const lines = computeLineDiff(original, modified);
            diffCacheRef.current[filePath] = { original, modified, lines };

            return { filePath, lines, error: null };
          } catch (err) {
            return { filePath, lines: [], error: String(err) };
          }
        })
      );

      if (isMounted) {
        setDiffData(prev => {
          const next = { ...prev };
          let changed = false;
          results.forEach(({ filePath, lines, error }) => {
            const current = next[filePath];
            if (
              !current ||
              current.loading ||
              current.lines !== lines ||
              current.error !== error
            ) {
              next[filePath] = { lines, loading: false, error };
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }

    if (modifiedFiles.length > 0) {
      loadAllDiffs();
    }

    return () => {
      isMounted = false;
    };
  }, [gitStatus, wsPath, activeWorkspace]);

  const isAnyLoadingInitial = modifiedFiles.some(
    path => !diffData[path] || (diffData[path].loading && diffData[path].lines.length === 0)
  );

  const actualModifiedFiles = modifiedFiles.filter(path => {
    const data = diffData[path];
    if (!data) return false;

    // Filter out files that haven't loaded their initial diff yet to prevent visual flashing of empty cards
    if (data.loading && data.lines.length === 0) return false;

    return true;
  });

  // Only show the general loader if we are loading initial diffs and haven't resolved any actual modified files yet
  const showLoader = isAnyLoadingInitial && actualModifiedFiles.length === 0;

  useEffect(() => {
    if (showLoader) {
      const timer = setTimeout(() => {
        setShowLoaderDeferred(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setShowLoaderDeferred(false);
    }
  }, [showLoader]);

  if (showLoaderDeferred) {
    return (
      <div className="diff-view__empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="diff-view__empty-icon" style={{ animation: 'diff-view-spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="var(--color-hairline)" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--color-mute)" />
        </svg>
        <span className="diff-view__empty-text">Computing differences...</span>
      </div>
    );
  }

  if (actualModifiedFiles.length === 0) {
    if (isAnyLoadingInitial) {
      // Still loading initial diffs, but within the 200ms window: show a blank space or transparent container (completely silent)
      return <div className="diff-view" style={{ height: '100%', width: '100%' }} />;
    }
    return (
      <div className="diff-view__empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="diff-view__empty-icon">
          <circle cx="12" cy="12" r="9" stroke="var(--color-hairline)" />
          <path d="M12 3v18" stroke="var(--color-mute)" strokeDasharray="2 2" strokeWidth="1" />
          <circle cx="12" cy="12" r="3.5" fill="var(--color-canvas)" stroke="var(--color-mute)" strokeWidth="1.5" />
        </svg>
        <span className="diff-view__empty-text">No changes detected in the active workspace</span>
      </div>
    );
  }

  return (
    <div className="diff-view" style={{ background: 'transparent', border: 'none', height: '100%', width: '100%', margin: 0, padding: 'var(--space-sm)' }}>
      <div className="diff-view__header" style={{ background: 'transparent', borderBottom: 'none', padding: '0 0 var(--space-md) 0' }}>
        <div className="diff-view__toggle-group">
          <button
            className={`diff-view__toggle-btn ${!isSplitMode ? 'diff-view__toggle-btn--active' : ''}`}
            onClick={() => setIsSplitMode(false)}
          >
            Unified
          </button>
          <button
            className={`diff-view__toggle-btn ${isSplitMode ? 'diff-view__toggle-btn--active' : ''}`}
            onClick={() => setIsSplitMode(true)}
          >
            Split
          </button>
        </div>

        <div className="diff-view__controls">
          <button className="diff-view__action-btn" onClick={handleToggleAll}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: areAllExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <span>{areAllExpanded ? 'Collapse all' : 'Expand all'}</span>
          </button>
        </div>
      </div>

      <div className="diff-view__body" style={{ background: 'transparent', overflowY: 'auto' }}>
        {propFilePath ? (
          // If a specific file path is targeted, only render that card
          <DiffFileCard
            key={propFilePath}
            filePath={propFilePath}
            wsPath={wsPath}
            isSplitMode={isSplitMode}
            initiallyExpanded={true}
            expandTrigger={expandTrigger}
            diffLines={diffData[propFilePath]?.lines || []}
            loading={diffData[propFilePath]?.loading ?? true}
            error={diffData[propFilePath]?.error ?? null}
          />
        ) : (
          // Otherwise render all modified files in sequence
          actualModifiedFiles.map(path => (
            <DiffFileCard
              key={path}
              filePath={path}
              wsPath={wsPath}
              isSplitMode={isSplitMode}
              initiallyExpanded={areAllExpanded}
              expandTrigger={expandTrigger}
              diffLines={diffData[path]?.lines || []}
              loading={diffData[path]?.loading ?? true}
              error={diffData[path]?.error ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}
