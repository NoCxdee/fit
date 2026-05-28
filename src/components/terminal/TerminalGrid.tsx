/* ================================================================
   Fit — TerminalGrid Component
   ================================================================ */

import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { generateId } from '../../utils/generateId';
import { TerminalInstance } from './TerminalInstance';
import { LivePreview } from '../preview/LivePreview';

interface TerminalGridProps {
  sessionId: string;
}

export function TerminalGrid({ sessionId }: TerminalGridProps) {
  const { sessions } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return null;

  const { terminals, splitDirection, showPreview } = session;

  const handleAddTerminal = () => {
    dispatch({
      type: 'ADD_TERMINAL_TO_SESSION',
      payload: {
        sessionId,
        terminal: {
          id: generateId('term'),
          shell: 'powershell-core',
          cwd: '',
        },
      },
    });
  };

  if (terminals.length === 0) {
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

  const terminalsPanel = (
    <PanelGroup direction={splitDirection} style={{ flex: 1 }}>
      {terminals.map((terminal, idx) => (
        <Panel 
          key={terminal.id} 
          minSize={15} 
          defaultSize={100 / terminals.length}
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <TerminalInstance
            terminalId={terminal.id}
            shell={terminal.shell}
          />
        </Panel>
      )).reduce<React.ReactNode[]>((acc, panel, idx) => {
        if (idx > 0) {
          acc.push(
            <PanelResizeHandle
              key={`resize-${idx}`}
              className={splitDirection === 'horizontal' ? 'resize-handle' : 'resize-handle-h'}
            />
          );
        }
        acc.push(panel);
        return acc;
      }, [])}
    </PanelGroup>
  );

  return (
    <PanelGroup direction="horizontal" style={{ flex: 1 }}>
      <Panel key="terminals-pane" minSize={20} defaultSize={showPreview ? 50 : 100} style={{ display: 'flex', flexDirection: 'column' }}>
        {terminalsPanel}
      </Panel>
      {showPreview && <PanelResizeHandle key="resize-divider" className="resize-handle" />}
      {showPreview && (
        <Panel key="preview-pane" minSize={20} defaultSize={50} style={{ display: 'flex', flexDirection: 'column' }}>
          <LivePreview />
        </Panel>
      )}
    </PanelGroup>
  );
}
