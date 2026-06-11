/* ================================================================
   Fit — DiffView Component
   Renders side-by-side split diff or unified inline diff.
   Highly detailed, matches the custom design system and aesthetics.
   ================================================================ */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { readFile, gitShowFile } from '../../utils/ipc';
import { convertFileSrc } from '@tauri-apps/api/core';
import { unsavedContents } from './CodeEditor';
import { Columns, Eye, GitPullRequest, Info, Terminal, Edit3, UnfoldVertical, ChevronUp } from 'lucide-react';

interface DiffViewProps {
  filePath: string;
  fileName: string;
  tabId: string;
}

interface AlignedDiffLine {
  leftNum?: number;
  leftText?: string;
  leftType: 'unchanged' | 'deleted' | 'placeholder' | 'modified';
  rightNum?: number;
  rightText?: string;
  rightType: 'unchanged' | 'added' | 'placeholder' | 'modified';
}

function highlightSyntax(
  escaped: string,
  commentRegex: RegExp,
  stringRegex: RegExp,
  keywords: string[]
): string {
  let html = escaped;
  
  // 1. Comments
  const comments: string[] = [];
  html = html.replace(commentRegex, (_, match) => {
    comments.push(match);
    return `___COMMENT_${comments.length - 1}___`;
  });
  
  // 2. Strings
  const strings: string[] = [];
  html = html.replace(stringRegex, (_, match) => {
    strings.push(match);
    return `___STRING_${strings.length - 1}___`;
  });

  // 3. Keywords
  keywords.forEach(kw => {
    const reg = new RegExp(`\\b(${kw})\\b`, 'g');
    html = html.replace(reg, '<span style="color: #c75ae4; font-weight: bold;">$1</span>');
  });

  // 4. Numbers
  html = html.replace(/\b(\d+)\b/g, '<span style="color: #d48a60;">$1</span>');

  // Restore strings and comments
  strings.forEach((str, idx) => {
    html = html.replace(`___STRING_${idx}___`, `<span style="color: #d48a60;">${str}</span>`);
  });
  comments.forEach((com, idx) => {
    html = html.replace(`___COMMENT_${idx}___`, `<span style="color: #75715e; font-style: italic;">${com}</span>`);
  });

  return html;
}

function highlightLine(text: string, ext: string): React.ReactNode {
  if (text === undefined || text === null) return <span>&nbsp;</span>;
  if (text === '') return <span>&nbsp;</span>;

  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const escaped = escapeHtml(text);

  // JavaScript / TypeScript / JSON / TSX / JSX
  if (['js', 'jsx', 'ts', 'tsx', 'json'].includes(ext)) {
    const keywords = [
      'const', 'let', 'var', 'function', 'return', 'import', 'from', 'export', 
      'default', 'await', 'async', 'type', 'interface', 'class', 'if', 'else', 
      'try', 'catch', 'finally', 'new', 'this', 'true', 'false', 'null', 'undefined',
      'extends', 'implements', 'as', 'readonly', 'private', 'public', 'protected'
    ];
    const html = highlightSyntax(escaped, /(\/\/.*)/g, /(&quot;.*?&quot;|&#039;.*?&#039;|`.*?`)/g, keywords);
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Rust
  if (ext === 'rs') {
    const keywords = [
      'fn', 'let', 'mut', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod',
      'return', 'if', 'else', 'match', 'loop', 'while', 'for', 'in', 'dyn',
      'self', 'Self', 'const', 'static', 'unsafe', 'where', 'type', 'as'
    ];
    const html = highlightSyntax(escaped, /(\/\/.*)/g, /(&quot;.*?&quot;|&#039;.*?&#039;)/g, keywords);
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // Python
  if (ext === 'py') {
    const keywords = [
      'def', 'class', 'return', 'import', 'from', 'as', 'if', 'elif', 'else',
      'while', 'for', 'in', 'try', 'except', 'finally', 'raise', 'with', 'lambda',
      'global', 'nonlocal', 'assert', 'pass', 'break', 'continue', 'and', 'or', 'not',
      'is', 'None', 'True', 'False'
    ];
    const html = highlightSyntax(escaped, /(#.*)/g, /(&quot;.*?&quot;|&#039;.*?&#039;)/g, keywords);
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // HTML / XML
  if (['html', 'xml'].includes(ext)) {
    let html = escaped;
    html = html.replace(/(&lt;\/?[a-zA-Z0-9:-]+(?:\s+[^&gt;]*)?&gt;)/g, '<span style="color: #e06c75;">$1</span>');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  // CSS
  if (ext === 'css') {
    let html = escaped;
    html = html.replace(/([a-zA-Z-]+)\s*:/g, '<span style="color: #c75ae4;">$1</span>:');
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <span>{text}</span>;
}

// LCS-based Diff algorithm to align lines

function buildLcsMatrix(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1].trim() === newLines[j - 1].trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function backtrackDiff(dp: number[][], oldLines: string[], newLines: string[]): AlignedDiffLine[] {
  const lines: AlignedDiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1].trim() === newLines[j - 1].trim()) {
      const isIdentical = oldLines[i - 1] === newLines[j - 1];
      lines.unshift({
        leftNum: i,
        leftText: oldLines[i - 1],
        leftType: isIdentical ? 'unchanged' : 'modified',
        rightNum: j,
        rightText: newLines[j - 1],
        rightType: isIdentical ? 'unchanged' : 'modified',
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      lines.unshift({
        leftType: 'placeholder',
        rightNum: j,
        rightText: newLines[j - 1],
        rightType: 'added',
      });
      j--;
    } else {
      lines.unshift({
        leftNum: i,
        leftText: oldLines[i - 1],
        leftType: 'deleted',
        rightType: 'placeholder',
      });
      i--;
    }
  }
  return lines;
}

function alignDiffGroups(lines: AlignedDiffLine[]): AlignedDiffLine[] {
  const aligned: AlignedDiffLine[] = [];
  let idx = 0;
  while (idx < lines.length) {
    if (lines[idx].leftType === 'deleted' && lines[idx].rightType === 'placeholder') {
      const deletes: AlignedDiffLine[] = [];
      while (idx < lines.length && lines[idx].leftType === 'deleted' && lines[idx].rightType === 'placeholder') {
        deletes.push(lines[idx]);
        idx++;
      }
      
      const adds: AlignedDiffLine[] = [];
      while (idx < lines.length && lines[idx].leftType === 'placeholder' && lines[idx].rightType === 'added') {
        adds.push(lines[idx]);
        idx++;
      }
      
      const max = Math.max(deletes.length, adds.length);
      for (let k = 0; k < max; k++) {
        const del = deletes[k];
        const add = adds[k];
        if (del && add) {
          aligned.push({
            leftNum: del.leftNum,
            leftText: del.leftText,
            leftType: 'modified',
            rightNum: add.rightNum,
            rightText: add.rightText,
            rightType: 'modified',
          });
        } else if (del) {
          aligned.push(del);
        } else if (add) {
          aligned.push(add);
        }
      }
    } else {
      aligned.push(lines[idx]);
      idx++;
    }
  }
  return aligned;
}

function computeDiff(oldText: string, newText: string): AlignedDiffLine[] {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const dp = buildLcsMatrix(oldLines, newLines);
  const lines = backtrackDiff(dp, oldLines, newLines);
  return alignDiffGroups(lines);
}

function buildDiffItems(
  alignedLines: AlignedDiffLine[],
  isExpandedAll: boolean,
  expandedFolds: Set<number>,
  contextLines: number
) {
  const items: Array<
    | { type: 'line'; line: AlignedDiffLine; index: number }
    | { type: 'fold'; startIdx: number; count: number; foldId: number }
  > = [];

  if (isExpandedAll) {
    return alignedLines.map((line, index) => ({ type: 'line' as const, line, index }));
  }

  const isChange = new Array(alignedLines.length).fill(false);
  for (let i = 0; i < alignedLines.length; i++) {
    const line = alignedLines[i];
    if (
      line.leftType === 'deleted' ||
      line.leftType === 'modified' ||
      line.rightType === 'added' ||
      line.rightType === 'modified'
    ) {
      for (let c = Math.max(0, i - contextLines); c <= Math.min(alignedLines.length - 1, i + contextLines); c++) {
        isChange[c] = true;
      }
    }
  }

  let i = 0;
  let foldCounter = 0;
  while (i < alignedLines.length) {
    if (!isChange[i]) {
      const startIdx = i;
      while (i < alignedLines.length && !isChange[i]) {
        i++;
      }
      const count = i - startIdx;
      const foldId = foldCounter++;

      if (count > 5 && !expandedFolds.has(foldId)) {
        items.push({ type: 'fold', startIdx, count, foldId });
      } else {
        for (let k = startIdx; k < i; k++) {
          items.push({ type: 'line', line: alignedLines[k], index: k });
        }
      }
    } else {
      items.push({ type: 'line', line: alignedLines[i], index: i });
      i++;
    }
  }

  return items;
}


export function DiffView({ filePath, fileName, tabId }: DiffViewProps) {
  const { activeWorkspaceId, workspaces, gitStatus: status, activeTabId } = useAppState();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSplit, setIsSplit] = useState(true); // Split view is base/default
  const [isEditHovered, setIsEditHovered] = useState(false);
  const [isExpandedAll, setIsExpandedAll] = useState(false);
  const [expandedFolds, setExpandedFolds] = useState<Set<number>>(new Set());
  
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const firstChangeRef = useRef<HTMLDivElement | null>(null);

  const [oldContent, setOldContent] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isImage, setIsImage] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const fileExt = useMemo(() => fileName.split('.').pop()?.toLowerCase() || '', [fileName]);

  const relativePath = useMemo(() => {
    if (!activeWorkspace) return fileName;
    const wsPath = activeWorkspace.path.replace(/\\/g, '/');
    const fPath = filePath.replace(/\\/g, '/');
    if (fPath.startsWith(wsPath + '/')) {
      return fPath.substring(wsPath.length + 1);
    }
    return fileName;
  }, [filePath, fileName, activeWorkspace]);

  useEffect(() => {
    let isMounted = true;
    if (!activeWorkspace) return;

    // Detect image file extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tiff', 'tif', 'avif', 'apng'];
    if (ext && imageExtensions.includes(ext)) {
      if (isMounted) {
        setIsImage(true);
        setLoading(false);
      }
      return;
    }

    setIsImage(false);

    async function loadContents() {
      setLoading(true);
      setError(null);
      
      try {
        const relPath = relativePath;
        const isStagedOnly = status?.staged.some(s => s.path === relPath) && 
                            !status?.unstaged.some(u => u.path === relPath);

        let original = '';
        let modified = '';

        if (isStagedOnly) {
          // Compare HEAD vs Index
          original = await gitShowFile(activeWorkspace!.path, relPath, 'HEAD');
          modified = await gitShowFile(activeWorkspace!.path, relPath, 'index');
        } else {
          // Compare Index vs Disk / Memory
          try {
            original = await gitShowFile(activeWorkspace!.path, relPath, 'index');
          } catch {
            original = await gitShowFile(activeWorkspace!.path, relPath, 'HEAD');
          }

          // Read disk content or in-memory unsaved content
          const unsaved = unsavedContents.get(filePath);
          if (unsaved !== undefined) {
            modified = unsaved;
          } else {
            modified = await readFile(filePath);
          }
        }

        if (isMounted) {
          setOldContent(original);
          setNewContent(modified);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(String(err));
          setLoading(false);
        }
      }
    }

    loadContents();

    return () => {
      isMounted = false;
    };
  }, [filePath, relativePath, activeWorkspace, status, fileName]);

  const alignedLines = useMemo(() => {
    return computeDiff(oldContent, newContent);
  }, [oldContent, newContent]);

  const firstChangeIndex = useMemo(() => {
    return alignedLines.findIndex(line => 
      line.leftType === 'deleted' || 
      line.leftType === 'modified' || 
      line.rightType === 'added' || 
      line.rightType === 'modified'
    );
  }, [alignedLines]);

  const CONTEXT_LINES = 3;

  const diffItems = useMemo(() => {
    return buildDiffItems(alignedLines, isExpandedAll, expandedFolds, CONTEXT_LINES);
  }, [alignedLines, expandedFolds, isExpandedAll]);

  const handleToggleFold = (foldId: number) => {
    setExpandedFolds(prev => {
      const next = new Set(prev);
      if (next.has(foldId)) {
        next.delete(foldId);
      } else {
        next.add(foldId);
      }
      return next;
    });
  };

  const handleToggleExpandAll = () => {
    if (isExpandedAll) {
      setIsExpandedAll(false);
      setExpandedFolds(new Set());
    } else {
      setIsExpandedAll(true);
    }
  };

  // Synchronize scroll positions between split views
  useEffect(() => {
    if (!isSplit || loading) return;

    const leftEl = leftScrollRef.current;
    const rightEl = rightScrollRef.current;
    if (!leftEl || !rightEl) return;

    const onLeftScroll = () => {
      if (rightEl.scrollTop !== leftEl.scrollTop) {
        rightEl.scrollTop = leftEl.scrollTop;
      }
    };

    const onRightScroll = () => {
      if (leftEl.scrollTop !== rightEl.scrollTop) {
        leftEl.scrollTop = rightEl.scrollTop;
      }
    };

    leftEl.addEventListener('scroll', onLeftScroll, { passive: true });
    rightEl.addEventListener('scroll', onRightScroll, { passive: true });

    return () => {
      leftEl.removeEventListener('scroll', onLeftScroll);
      rightEl.removeEventListener('scroll', onRightScroll);
    };
  }, [loading, isSplit]);

  // Smooth scroll directly to the first modification when tab becomes active or loaded completed
  useEffect(() => {
    const isTabActive = activeTabId === tabId;
    if (!loading && firstChangeIndex !== -1 && isTabActive) {
      const timer = setTimeout(() => {
        if (firstChangeRef.current) {
          firstChangeRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, firstChangeIndex, isSplit, activeTabId, tabId]);

  const handleOpenInEditor = () => {
    dispatch({
      type: 'OPEN_TAB',
      payload: {
        id: `tab-editor-${filePath}`,
        type: 'editor',
        title: fileName,
        filePath: filePath,
      },
    });
  };

  if (isImage) {
    return (
      <div className="diff-view-image" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--color-canvas)', padding: '16px', gap: '12px', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', maxWidth: '100%', maxHeight: '100%' }}>
          <img 
            src={convertFileSrc(filePath)} 
            alt={fileName} 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '70vh', 
              objectFit: 'contain', 
              borderRadius: 'var(--radius-md)', 
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              border: '1px solid var(--color-hairline)'
            }} 
          />
          <div style={{ color: 'var(--color-mute)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', textAlign: 'center' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{fileName}</span>
            <div style={{ fontSize: 'var(--text-caption)', marginTop: '4px' }}>Binary file (modified image preview)</div>
            <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.7 }}>{filePath}</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px', background: 'var(--color-canvas)' }}>
        {/* Skeleton Header */}
        <div style={{ height: '40px', background: 'var(--color-canvas-soft)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite ease-in-out' }} />
        {/* Skeleton Code Body */}
        <div style={{ flex: 1, display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, background: 'var(--color-canvas-soft)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite ease-in-out' }} />
          <div style={{ flex: 1, background: 'var(--color-canvas-soft)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite ease-in-out' }} />
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes pulse {
            0% { opacity: 0.6; }
            50% { opacity: 0.3; }
            100% { opacity: 0.6; }
          }
        `}} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: 'var(--color-canvas)', color: 'var(--color-mute)' }}>
        <Info size={48} style={{ color: 'var(--color-accent-amber)', marginBottom: '16px' }} />
        <h3 style={{ color: 'var(--color-primary)', marginBottom: '8px' }}>Failed to compute changes</h3>
        <p style={{ fontSize: '13px' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--color-canvas)', padding: '16px', gap: '12px', fontFamily: 'var(--font-mono)' }}>
      
      {/* Diff Header block - matches the requested styling */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--color-canvas-soft)',
        borderRadius: 'var(--radius-lg)',
        padding: '10px 16px',
        border: '1px solid var(--color-hairline)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--color-body)',
        height: '38px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          {/* Custom Status Icon representing modification */}
          <div style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: 'var(--color-accent-amber)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            color: 'var(--color-on-primary)',
            fontWeight: 'bold',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)'
          }}>
            ~
          </div>
          <span style={{ color: 'var(--color-ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
            {relativePath}
          </span>
        </div>
        
        {/* Toggle buttons for Diff view actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '16px' }}>
          <button
            onClick={handleToggleExpandAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isExpandedAll ? 'var(--color-hover)' : 'transparent',
              color: isExpandedAll ? 'var(--color-ink)' : 'var(--color-mute)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              transition: 'all var(--transition-fast)'
            }}
            title={isExpandedAll ? "Collapse Unchanged" : "Expand All"}
          >
            {isExpandedAll ? <ChevronUp size={12} style={{ color: 'var(--color-accent-amber)' }} /> : <UnfoldVertical size={12} style={{ color: 'var(--color-accent-amber)' }} />}
            {isExpandedAll ? "Collapse" : "Expand All"}
          </button>

          {/* Vertical divider */}
          <div style={{ width: '1px', height: '14px', background: 'var(--color-hairline)', margin: '0 6px' }} />

          <button
            onClick={handleOpenInEditor}
            onMouseEnter={() => setIsEditHovered(true)}
            onMouseLeave={() => setIsEditHovered(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isEditHovered ? 'var(--color-hover)' : 'transparent',
              color: isEditHovered ? 'var(--color-ink)' : 'var(--color-mute)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'var(--font-sans)',
              transition: 'all var(--transition-fast)'
            }}
            title="Open in Editor"
          >
            <Edit3 size={12} style={{ color: 'var(--color-accent-amber)' }} />
            Edit File
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div style={{
        flex: 1,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        {isSplit ? (
          /* ==================== SPLIT DIFF VIEW ==================== */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: '1.6'
          }}>
            {/* Sticky Headers Row */}
            <div style={{ display: 'flex', gap: '16px', flexShrink: 0, marginBottom: '8px' }}>
              {/* Left Header */}
              <div style={{
                flex: 1,
                background: 'var(--color-canvas-soft)',
                padding: '10px 16px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                color: 'var(--color-accent-red)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>-</span> BEFORE
              </div>
              
              {/* Right Header */}
              <div style={{
                flex: 1,
                background: 'var(--color-canvas-soft)',
                padding: '10px 16px',
                border: '1px solid var(--color-hairline)',
                borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
                color: 'var(--color-accent-green)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '1.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: 'var(--font-mono)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>+</span> AFTER
              </div>
            </div>

            {/* Scrollable Rows Container (Unified native scrolling for both columns) */}
            <div 
              ref={leftScrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                paddingBottom: '8px'
              }}
            >
              {diffItems.map((item, idx) => {
                if (item.type === 'fold') {
                  return (
                    <div key={`fold-${item.foldId}`} style={{ display: 'flex', gap: '16px', margin: '2px 0', flexShrink: 0 }}>
                      <div
                        onClick={() => handleToggleFold(item.foldId)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          height: '28px',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-canvas)',
                          border: '1px dashed var(--color-hairline)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-mute)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-canvas-soft)'; e.currentTarget.style.color = 'var(--color-ink)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-canvas)'; e.currentTarget.style.color = 'var(--color-mute)'; }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                          <UnfoldVertical size={11} style={{ opacity: 0.7 }} />
                          Show {item.count} unchanged lines
                        </span>
                      </div>
                      <div
                        onClick={() => handleToggleFold(item.foldId)}
                        style={{
                          flex: 1,
                          display: 'flex',
                          height: '28px',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-canvas)',
                          border: '1px dashed var(--color-hairline)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--color-mute)',
                          fontSize: '11px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-canvas-soft)'; e.currentTarget.style.color = 'var(--color-ink)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-canvas)'; e.currentTarget.style.color = 'var(--color-mute)'; }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                          <UnfoldVertical size={11} style={{ opacity: 0.7 }} />
                          Show {item.count} unchanged lines
                        </span>
                      </div>
                    </div>
                  );
                }

                const { line, index } = item;
                const isLeftPlaceholder = line.leftType === 'placeholder';
                const isRightPlaceholder = line.rightType === 'placeholder';

                const leftBg = isLeftPlaceholder ? 'transparent' : (line.leftType === 'deleted' || line.leftType === 'modified' ? 'rgba(201, 112, 112, 0.18)' : 'var(--color-canvas-soft)');
                const rightBg = isRightPlaceholder ? 'transparent' : (line.rightType === 'added' || line.rightType === 'modified' ? 'rgba(140, 184, 122, 0.18)' : 'var(--color-canvas-soft)');

                const leftIndicator = isLeftPlaceholder ? 'transparent' : (line.leftType === 'deleted' || line.leftType === 'modified' ? 'var(--color-accent-red)' : 'transparent');
                const rightIndicator = isRightPlaceholder ? 'transparent' : (line.rightType === 'added' || line.rightType === 'modified' ? 'var(--color-accent-green)' : 'transparent');

                const isFirstChange = index === firstChangeIndex;
                const isLastRow = index === alignedLines.length - 1;

                return (
                  <div 
                    key={`line-${index}`} 
                    ref={isFirstChange ? firstChangeRef : undefined}
                    style={{ display: 'flex', gap: '16px', flexShrink: 0 }}
                  >
                    {/* Left Cell */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      background: leftBg,
                      borderLeft: '1px solid var(--color-hairline)',
                      borderRight: '1px solid var(--color-hairline)',
                      borderBottom: isLastRow ? '1px solid var(--color-hairline)' : 'none',
                      borderTop: index === 0 ? '1px solid var(--color-hairline)' : 'none',
                      borderBottomLeftRadius: isLastRow ? 'var(--radius-xl)' : 0,
                      borderBottomRightRadius: isLastRow ? 'var(--radius-xl)' : 0,
                      minHeight: '20px',
                      alignItems: 'flex-start',
                      lineHeight: '20px',
                      position: 'relative'
                    }}>
                      {/* Left Diff Indicator Line */}
                      {leftIndicator !== 'transparent' && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '4px',
                          background: leftIndicator
                        }} />
                      )}
                      
                      <div style={{ width: '45px', flexShrink: 0, textAlign: 'right', paddingRight: '10px', color: 'var(--color-mute)', opacity: 0.5, userSelect: 'none', fontSize: '11px', lineHeight: '20px', paddingLeft: '8px' }}>
                        {line.rightNum ?? line.leftNum}
                      </div>
                      <div style={{ width: '12px', flexShrink: 0 }} />
                      <pre style={{ margin: 0, paddingLeft: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: isLeftPlaceholder ? 'transparent' : 'var(--color-primary)', opacity: line.leftType === 'deleted' || line.leftType === 'modified' ? 0.95 : 0.8, fontSize: '13px', lineHeight: '20px', fontFamily: 'var(--font-mono)' }}>
                        {isLeftPlaceholder ? ' ' : highlightLine(line.leftText || '', fileExt)}
                      </pre>
                    </div>

                    {/* Right Cell */}
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      background: rightBg,
                      borderLeft: '1px solid var(--color-hairline)',
                      borderRight: '1px solid var(--color-hairline)',
                      borderBottom: isLastRow ? '1px solid var(--color-hairline)' : 'none',
                      borderTop: index === 0 ? '1px solid var(--color-hairline)' : 'none',
                      borderBottomLeftRadius: isLastRow ? 'var(--radius-xl)' : 0,
                      borderBottomRightRadius: isLastRow ? 'var(--radius-xl)' : 0,
                      minHeight: '20px',
                      alignItems: 'flex-start',
                      lineHeight: '20px',
                      position: 'relative'
                    }}>
                      {/* Right Diff Indicator Line */}
                      {rightIndicator !== 'transparent' && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '4px',
                          background: rightIndicator
                        }} />
                      )}
                      
                      <div style={{ width: '45px', flexShrink: 0, textAlign: 'right', paddingRight: '10px', color: 'var(--color-mute)', opacity: 0.5, userSelect: 'none', fontSize: '11px', lineHeight: '20px', paddingLeft: '8px' }}>
                        {line.rightNum ?? line.leftNum}
                      </div>
                      <div style={{ width: '12px', flexShrink: 0 }} />
                      <pre style={{ margin: 0, paddingLeft: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: isRightPlaceholder ? 'transparent' : 'var(--color-primary)', opacity: line.rightType === 'added' || line.rightType === 'modified' ? 0.95 : 0.8, fontSize: '13px', lineHeight: '20px', fontFamily: 'var(--font-mono)' }}>
                        {isRightPlaceholder ? ' ' : highlightLine(line.rightText || '', fileExt)}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ==================== UNIFIED (INLINE) VIEW ==================== */
          <div 
            ref={leftScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              background: 'var(--color-canvas-soft)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-xl)',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: '1.6',
              padding: '8px 0'
            }}
          >
            {diffItems.flatMap((item, idx) => {
              if (item.type === 'fold') {
                return (
                  <div
                    key={`uni-fold-${item.foldId}`}
                    onClick={() => handleToggleFold(item.foldId)}
                    style={{
                      display: 'flex',
                      height: '28px',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--color-canvas)',
                      borderTop: '1px dashed var(--color-hairline)',
                      borderBottom: '1px dashed var(--color-hairline)',
                      color: 'var(--color-mute)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-canvas-soft)'; e.currentTarget.style.color = 'var(--color-ink)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-canvas)'; e.currentTarget.style.color = 'var(--color-mute)'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                      <UnfoldVertical size={11} style={{ opacity: 0.7 }} />
                      Show {item.count} unchanged lines
                    </span>
                  </div>
                );
              }

              const { line, index } = item;
              const elements: React.ReactNode[] = [];
              const isFirstChange = index === firstChangeIndex;

              // 1. If it's unchanged, output single line
              if (line.leftType === 'unchanged') {
                elements.push(
                  <div key={`uni-eq-${index}`} style={{ display: 'flex', minHeight: '20px', alignItems: 'flex-start', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}>
                    {/* Gutters for Left and Right numbers */}
                    <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', paddingRight: '8px', color: 'var(--color-mute)', opacity: 0.4, userSelect: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}>
                      {line.leftNum}
                    </div>
                    <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', paddingRight: '8px', color: 'var(--color-mute)', opacity: 0.4, userSelect: 'none', fontSize: '11px', borderRight: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}>
                      {line.rightNum}
                    </div>
                    <div style={{ width: '20px', flexShrink: 0, textAlign: 'center', color: 'transparent', userSelect: 'none', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}> </div>
                    <pre style={{ margin: 0, paddingLeft: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-primary)', opacity: 0.75, fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '20px' }}>
                      {highlightLine(line.leftText || '', fileExt)}
                    </pre>
                  </div>
                );
              }

              // 2. If it's deleted or modified, output the deleted line
              if (line.leftType === 'deleted' || line.leftType === 'modified') {
                elements.push(
                  <div 
                    key={`uni-del-${index}`} 
                    ref={isFirstChange ? firstChangeRef : undefined}
                    style={{ display: 'flex', minHeight: '20px', alignItems: 'flex-start', background: 'rgba(201, 112, 112, 0.18)', borderLeft: '4px solid var(--color-accent-red)', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}
                  >
                    <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', paddingRight: '8px', color: 'var(--color-mute)', opacity: 0.5, userSelect: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}>
                      {line.leftNum}
                    </div>
                    <div style={{ width: '40px', flexShrink: 0, paddingRight: '8px', borderRight: '1px solid var(--color-hairline)', userSelect: 'none', height: '20px' }}></div>
                    <div style={{ width: '20px', flexShrink: 0, textAlign: 'center', color: 'var(--color-accent-red)', fontWeight: 'bold', userSelect: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}></div>
                    <pre style={{ margin: 0, paddingLeft: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '20px' }}>
                      {highlightLine(line.leftText || '', fileExt)}
                    </pre>
                  </div>
                );
              }

              // 3. If it's added or modified, output the added line
              if (line.rightType === 'added' || line.rightType === 'modified') {
                elements.push(
                  <div 
                    key={`uni-add-${index}`} 
                    ref={isFirstChange && !elements.length ? firstChangeRef : undefined}
                    style={{ display: 'flex', minHeight: '20px', alignItems: 'flex-start', background: 'rgba(140, 184, 122, 0.18)', borderLeft: '4px solid var(--color-accent-green)', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}
                  >
                    <div style={{ width: '40px', flexShrink: 0, paddingRight: '8px', userSelect: 'none', height: '20px' }}></div>
                    <div style={{ width: '40px', flexShrink: 0, textAlign: 'right', paddingRight: '8px', color: 'var(--color-mute)', opacity: 0.5, userSelect: 'none', fontSize: '11px', borderRight: '1px solid var(--color-hairline)', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}>
                      {line.rightNum}
                    </div>
                    <div style={{ width: '20px', flexShrink: 0, textAlign: 'center', color: 'var(--color-accent-green)', fontWeight: 'bold', userSelect: 'none', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: '20px' }}></div>
                    <pre style={{ margin: 0, paddingLeft: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '13px', lineHeight: '20px' }}>
                      {highlightLine(line.rightText || '', fileExt)}
                    </pre>
                  </div>
                );
              }

              return elements;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
