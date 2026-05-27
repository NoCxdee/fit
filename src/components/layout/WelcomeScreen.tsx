import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { TextParticle } from './TextParticle';
import { generateId } from '../../utils/generateId';
import { open } from '@tauri-apps/plugin-dialog';
import type { Workspace } from '../../types';

export function WelcomeScreen() {
  const { workspaces } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const recentProjects = workspaces.slice(0, 5);

  const handleOpenProject = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('dialog.openWorkspace'),
      });
      if (selected && typeof selected === 'string') {
        const name = selected.split(/[\\/]/).pop() || 'Workspace';
        const workspace: Workspace = {
          id: generateId('ws'),
          name,
          path: selected,
          color: '#60b0a2',
        };
        dispatch({ type: 'ADD_WORKSPACE', payload: workspace });
      }
    } catch (error) {
      console.error('Failed to open workspace directory:', error);
    }
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-screen__particle-container">
        <TextParticle text="Fit" fontSize={200} particleDensity={8} />
      </div>

      <div className="welcome-screen__actions">
        <h2 className="welcome-screen__actions-title">{t('welcome.noProject')}</h2>
        <p className="welcome-screen__actions-text">{t('welcome.subtitle')}</p>
        <button className="welcome-screen__open-btn" onClick={handleOpenProject}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          {t('welcome.openProject')}
        </button>
      </div>

      {recentProjects.length > 0 && (
        <div className="welcome-screen__recent">
          <h3 className="welcome-screen__recent-title">{t('welcome.recentProjects')}</h3>
          <div className="welcome-screen__projects-list">
            {recentProjects.map((project) => (
              <button
                key={project.id}
                className="welcome-screen__project-item"
                onClick={() => dispatch({ type: 'SET_ACTIVE_WORKSPACE', payload: project.id })}
              >
                <div className="welcome-screen__project-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <div className="welcome-screen__project-info">
                  <span className="welcome-screen__project-name">{project.name}</span>
                  <span className="welcome-screen__project-path">{project.path}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
