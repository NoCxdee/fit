/* ================================================================
   Fit — FileContextMenu Component
   ================================================================ */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import type { FileEntry } from '../../types';

interface FileContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  selectionCount?: number;
}

export function FileContextMenu({ x, y, onClose, onRename, onDelete, selectionCount }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('contextmenu', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('contextmenu', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const isMultiple = selectionCount !== undefined && selectionCount > 1;
  const menuWidth = 150;
  const menuHeight = isMultiple ? 40 : 80;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        width: `${menuWidth}px`,
        zIndex: 1000,
      }}
    >
      {!isMultiple && (
        <button
          className="context-menu__item"
          onClick={() => {
            onRename();
            onClose();
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t('file.rename')}
        </button>
      )}
      <button
        className="context-menu__item context-menu__item--danger"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {t('file.delete')}
      </button>
    </div>
  );
}
