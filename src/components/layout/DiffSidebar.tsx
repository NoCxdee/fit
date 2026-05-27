/* ================================================================
   Fit — DiffSidebar Component (Additional Right-Aligned Sidebar)
   ================================================================ */

import { useState, useCallback, useRef } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { ResizeHandle } from './ResizeHandle';
import { DiffView } from '../editor/DiffView';

export function DiffSidebar() {
  const { diffFilePath, panelSizes, diffSidebarOpen } = useAppState();
  const dispatch = useAppDispatch();

  const [sidebarWidth, setSidebarWidth] = useState<number>(
    (panelSizes || {})['diffSidebar']?.[0] ?? 450
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    resizeStartRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidthRef.current,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.startX - e.clientX;
      const newWidth = Math.max(300, Math.min(750, resizeStartRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (resizeStartRef.current) {
        dispatch({
          type: 'SET_PANEL_SIZES',
          payload: { key: 'diffSidebar', sizes: [sidebarWidthRef.current] },
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

  const handleClose = () => {
    dispatch({ type: 'SET_DIFF_SIDEBAR_OPEN', payload: false });
  };

  return (
    <div 
      className={`diff-sidebar ${!diffSidebarOpen ? 'diff-sidebar--closed' : ''}`}
      style={{ 
        width: `${sidebarWidth}px`,
        display: !diffSidebarOpen ? 'none' : 'flex'
      }}
    >
      <ResizeHandle position="left" onResizeStart={handleResizeStart} />
      
      {/* Sidebar Header */}
      <div className="diff-sidebar__header">
        <span className="diff-sidebar__title">Review Changes</span>
        <button 
          onClick={handleClose}
          className="diff-sidebar__close-btn"
          title="Close Diff Panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="diff-sidebar__body">
        <DiffView filePath={diffFilePath || undefined} />
      </div>
    </div>
  );
}
