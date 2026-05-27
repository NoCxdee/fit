/* ================================================================
   Fit — MainContent Component
   ================================================================ */

import { useAppState } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { TerminalGrid } from '../terminal/TerminalGrid';
import { CodeEditor } from '../editor/CodeEditor';
import { LivePreview } from '../preview/LivePreview';
import { DiffView } from '../editor/DiffView';

export function MainContent() {
  const { openTabs, activeTabId, activeSessionId } = useAppState();
  const { t } = useTranslation();

  const workspaceTabs = openTabs.filter(t => t.sessionId === activeSessionId);
  const showWelcome = workspaceTabs.length === 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, position: 'relative' }}>
      {showWelcome && (
        <div className="welcome-screen">
          <div className="welcome-screen__logo">F</div>
          <div className="welcome-screen__title">{t('main.welcome')}</div>
          <div className="welcome-screen__subtitle">
            {t('main.subtitle')}
            <br />
            {t('app.description')}
          </div>
        </div>
      )}

      {openTabs.map(tab => {
        const isActive = !showWelcome && tab.id === activeTabId && tab.sessionId === activeSessionId;
        return (
          <div
            key={tab.id}
            style={{
              display: isActive ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              height: '100%',
              width: '100%',
              minHeight: 0,
            }}
          >
            {tab.type === 'session' && tab.sessionId && (
              <TerminalGrid sessionId={tab.sessionId} />
            )}
            {tab.type === 'editor' && tab.filePath && (
              <CodeEditor
                filePath={tab.filePath}
                fileName={tab.title}
                tabId={tab.id}
              />
            )}
             {tab.type === 'preview' && (
              <LivePreview />
            )}
          </div>
        );
      })}
    </div>
  );
}
