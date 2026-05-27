import { useCallback } from 'react';

interface ResizeHandleProps {
  onResizeStart: (e: React.MouseEvent) => void;
  position: 'left' | 'right';
}

export function ResizeHandle({ onResizeStart, position }: ResizeHandleProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(e);
  }, [onResizeStart]);

  return (
    <div
      className={`resize-handle resize-handle--${position}`}
      onMouseDown={handleMouseDown}
    />
  );
}
