import { useState } from 'react';
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { useTranslation, type Lang } from '../../i18n';
import { TextParticle } from './TextParticle';
import { generateId } from '../../utils/generateId';
import { open } from '@tauri-apps/plugin-dialog';
import type { Workspace } from '../../types';

function formatProjectPath(path: string) {
  const cleanPath = path.replace(/\//g, '\\');
  const match = cleanPath.match(/^c:\\users\\([^\\]+)/i);
  if (match) {
    const userPart = match[0];
    return cleanPath.replace(userPart, '~');
  }
  return cleanPath;
}

function getRelativeTime(timestamp: number | undefined, lang: Lang): string {
  if (!timestamp) {
    switch (lang) {
      case 'es': return 'hace algún tiempo';
      case 'fr': return 'il y a quelque temps';
      case 'de': return 'vor einiger Zeit';
      default: return 'some time ago';
    }
  }

  const diffMs = Date.now() - timestamp;
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const formatT = (prefix: string, suffix: string) => (n: number, unit: string) =>
    `${prefix}${n} ${unit}${n > 1 ? 's' : ''}${suffix}`;

  const fEn = formatT('', ' ago');
  const fEs = formatT('hace ', '');
  const fFr = formatT('il y a ', '');

  const t = {
    en: {
      now: 'just now',
      sec: (n: number) => fEn(n, 'second'),
      min: (n: number) => fEn(n, 'minute'),
      hour: (n: number) => fEn(n, 'hour'),
      day: (n: number) => fEn(n, 'day'),
      many: 'long ago'
    },
    es: {
      now: 'ahora mismo',
      sec: (n: number) => fEs(n, 'segundo'),
      min: (n: number) => fEs(n, 'minuto'),
      hour: (n: number) => fEs(n, 'hora'),
      day: (n: number) => fEs(n, 'día'),
      many: 'hace mucho tiempo'
    },
    fr: {
      now: 'à l\'instant',
      sec: (n: number) => fFr(n, 'seconde'),
      min: (n: number) => fFr(n, 'minute'),
      hour: (n: number) => fFr(n, 'heure'),
      day: (n: number) => fFr(n, 'jour'),
      many: 'il y a longtemps'
    },
    it: {
      now: 'proprio ora',
      sec: (n: number) => `${n} second${n > 1 ? 'i' : 'o'} fa`,
      min: (n: number) => `${n} minut${n > 1 ? 'i' : 'o'} fa`,
      hour: (n: number) => `${n} or${n > 1 ? 'e' : 'a'} fa`,
      day: (n: number) => `${n} giorn${n > 1 ? 'i' : 'o'} fa`,
      many: 'molto tempo fa'
    },
    de: {
      now: 'gerade eben',
      sec: (n: number) => `vor ${n} Sekunde${n > 1 ? 'n' : ''}`,
      min: (n: number) => `vor ${n} Minute${n > 1 ? 'n' : ''}`,
      hour: (n: number) => `vor ${n} Stunde${n > 1 ? 'n' : ''}`,
      day: (n: number) => `vor ${n} Tag${n > 1 ? 'en' : ''}`,
      many: 'vor langer Zeit'
    }
  };

  const currentT = t[lang] || t.en;

  if (diffSec < 10) return currentT.now;
  if (diffSec < 60) return currentT.sec(diffSec);
  if (diffMin < 60) return currentT.min(diffMin);
  if (diffHour < 24) return currentT.hour(diffHour);
  if (diffDay < 30) return currentT.day(diffDay);
  return currentT.many;
}

export function WelcomeScreen() {
  const { workspaces } = useAppState();
  const dispatch = useAppDispatch();
  const { t, lang } = useTranslation();

  const [recentProjects, setRecentProjects] = useState<any[]>(() => {
    try {
      const data = localStorage.getItem('fit_recent_projects');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

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

  const handleSelectRecent = (project: any) => {
    const existing = workspaces.find(w => w.path === project.path || w.id === project.id);
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_WORKSPACE', payload: existing.id });
    } else {
      const workspace: Workspace = {
        id: project.id,
        name: project.name,
        path: project.path,
        color: project.color || '#60b0a2',
        icon: project.icon,
      };
      dispatch({ type: 'ADD_WORKSPACE', payload: workspace });
    }
  };

  if (recentProjects.length === 0) {
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
      </div>
    );
  }

  return (
    <div className="welcome-screen welcome-screen--list">
      <div className="welcome-screen__particle-container">
        <TextParticle text="Fit" fontSize={200} particleDensity={8} />
      </div>

      <div className="welcome-screen__recent-container">
        <div className="welcome-screen__recent-header">
          <h2 className="welcome-screen__recent-title-main">{t('welcome.recentProjects')}</h2>
          <button className="welcome-screen__open-btn-small" onClick={handleOpenProject}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            {t('welcome.openProject')}
          </button>
        </div>

        <div className="welcome-screen__projects-table">
          {recentProjects.map((project) => (
            <button
              key={project.id}
              className="welcome-screen__project-row"
              onClick={() => handleSelectRecent(project)}
            >
              <span className="welcome-screen__project-row-path">
                {formatProjectPath(project.path)}
              </span>
              <span className="welcome-screen__project-row-time">
                {getRelativeTime(project.lastOpened, lang)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
