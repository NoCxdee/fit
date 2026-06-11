/* ================================================================
   Fit — TerminalGrid Component
   Recursive panel-tree renderer for nested terminal split layouts.
   ================================================================ */

import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppState, useAppDispatch, collectTerminalIds } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { generateId } from '../../utils/generateId';
import { TerminalInstance } from './TerminalInstance';
import { LivePreview } from '../preview/LivePreview';
import type { PanelNode } from '../../types';

interface TerminalGridProps {
  sessionId: string;
}

export function TerminalGrid({ sessionId }: TerminalGridProps) {
  const { sessions } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return null;

  const { rootPanel, showPreview } = session;

  const handleAddTerminal = () => {
    const termId = collectTerminalIds(rootPanel)[0];
    if (!termId) return;
    dispatch({
      type: 'SPLIT_TERMINAL',
      payload: {
        sessionId,
        terminalId: termId,
        direction: 'horizontal',
      },
    });
  };

  if (!rootPanel) {
    return (
      <div className="welcome-screen">
        <p style={{ color: 'var(--color-mute)', fontSize: 'var(--text-body-sm)' }}>
          {t('session.empty')}
        </p>
        <button className="btn btn-primary" onClick={handleAddTerminal}>
          {t('session.addTerminal')}
        </button>
      </div>
    );
  }

  function renderPanel(node: PanelNode, defaultSize: number = 100): React.ReactNode {
    if (node.type === 'terminal') {
      return (
        <Panel
          id={node.id}
          key={node.id}
          minSize={15}
          defaultSize={defaultSize}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <TerminalInstance
            terminalId={node.id}
            shell={node.shell}
            cwd={node.cwd}
          />
        </Panel>
      );
    }

    const elements: React.ReactNode[] = [];
    const childrenCount = node.children.length;
    const childDefaultSize = 100 / childrenCount;

    node.children.forEach((child, index) => {
      if (index > 0) {
        elements.push(
          <PanelResizeHandle
            key={`resize-${child.id}`}
            id={`resize-handle-${child.id}`}
            className={
              node.direction === 'horizontal'
                ? 'resize-handle-custom resize-handle-custom--horizontal'
                : 'resize-handle-custom resize-handle-custom--vertical'
            }
          />
        );
      }
      
      const childNode = renderPanel(child, childDefaultSize);
      if (child.type === 'split') {
        elements.push(
          <Panel
            id={`wrapper-${child.id}`}
            key={`wrapper-${child.id}`}
            minSize={15}
            defaultSize={childDefaultSize}
            style={{ display: 'flex', flexDirection: 'column' }}
          >
            {childNode}
          </Panel>
        );
      } else {
        elements.push(childNode);
      }
    });

    return (
      <PanelGroup id={node.id} key={node.id} direction={node.direction} style={{ flex: 1 }}>
        {elements}
      </PanelGroup>
    );
  }

  return (
    <PanelGroup id="main-group" direction="horizontal" style={{ flex: 1 }}>
      <Panel
        id="terminals-pane"
        key="terminals-pane"
        minSize={20}
        defaultSize={showPreview ? 50 : 100}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {renderPanel(rootPanel)}
      </Panel>
      {showPreview && (
        <PanelResizeHandle
          key="resize-divider"
          id="resize-divider"
          className="resize-handle-custom resize-handle-custom--horizontal"
        />
      )}
      {showPreview && (
        <Panel
          id="preview-pane"
          key="preview-pane"
          minSize={20}
          defaultSize={50}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <LivePreview />
        </Panel>
      )}
    </PanelGroup>
  );
}
