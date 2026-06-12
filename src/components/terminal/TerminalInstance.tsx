/* ================================================================
   Fit — TerminalInstance Component
   ================================================================ */

import { useEffect, useRef, useState, useCallback, CSSProperties } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { listen } from '@tauri-apps/api/event';
import { ptySpawn, ptyWrite, ptyResize, ptyKill, getClipboardFiles, readDir, readFile } from '../../utils/ipc';
import { useAppState, useAppDispatch, countTerminals, collectTerminalIds, markGridKeepAlive, consumeGridKeepAlive } from '../../stores/appStore';
import { useTranslation } from '../../i18n';
import { open } from '@tauri-apps/plugin-dialog';
import { homeDir } from '@tauri-apps/api/path';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  terminalId: string;
  shell: string;
  cwd: string;
}

interface SkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  type: 'global' | 'project';
}

const getCliOptions = (terminalId: string) => [
  {
    name: 'Agy',
    command: 'agy',
    description: 'Antigravity agentic coding assistant',
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z" fill="#8B5CF6" />
      </svg>
    )
  },
  {
    name: 'Gemini',
    command: 'gemini',
    description: "Google's multimodal reasoning model",
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id={`gemini-grad-${terminalId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B51E0" />
            <stop offset="100%" stopColor="#FA8C16" />
          </linearGradient>
        </defs>
        <path fillRule="evenodd" clipRule="evenodd" d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill={`url(#gemini-grad-${terminalId})`} />
      </svg>
    )
  },
  {
    name: 'Claude',
    command: 'claude',
    description: "Anthropic's helpful and harmless assistant",
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#CC7B5C" />
      </svg>
    )
  },
  {
    name: 'Codex',
    command: 'codex',
    description: 'OpenAI Codex code synthesis engine',
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z" fill="#10B981" />
      </svg>
    )
  },
  {
    name: 'OpenCode',
    command: 'opencode',
    description: 'Local open-source development workspace',
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M16 6H8v12h8V6zm4 16H4V2h16v20z" fill="#06B6D4" />
      </svg>
    )
  },
  {
    name: 'Grok',
    command: 'grok',
    description: "xAI's real-time knowledge assistant",
    logo: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path fillRule="evenodd" clipRule="evenodd" d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" fill="#F7F5F0" />
      </svg>
    )
  }
];


const isShellPrompt = (val: string) => {
  const trimmed = val.trim();
  if (!trimmed) return false;

  // Common prompt symbols
  const hasPromptSymbol = /[>#\$%❯➜~]$/.test(trimmed);
  if (!hasPromptSymbol) return false;

  // If it's a bare prompt symbol or very short (like ">", ">>>", "$", "#"), it's likely a REPL or subcommand, not a main shell prompt
  if (/^[>#\$%❯➜~]+$/.test(trimmed)) {
    return false;
  }

  // Windows shell prompts (PowerShell / CMD)
  if (trimmed.endsWith('>')) {
    return trimmed.includes('PS ') || 
           /[A-Za-z]:[\\/]/.test(trimmed) || 
           trimmed.includes('\\') || 
           trimmed.includes('/');
  }

  // Unix/Linux prompts ending with $, %, or #
  if (/[#\$%❯➜]$/.test(trimmed)) {
    return trimmed.includes('@') || 
           trimmed.includes('/') || 
           trimmed.includes('\\') || 
           trimmed.includes('~') ||
           trimmed.includes(':') ||
           trimmed.length > 5;
  }

  return true;
};

const shouldShowFilesAndSkills = (commandStr: string): boolean => {
  if (!commandStr) return false;
  
  const trimmed = commandStr.trim();
  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  
  // Resolve base executable name (e.g. ./my-tool -> my-tool, C:\path\npm.cmd -> npm)
  const baseName = firstWord
    .replace(/^(\.\/|\.\.\\)+/, '')
    .split(/[/\\]/)
    .pop() || '';
    
  const execName = baseName.split('.')[0];
  
  // Blacklist of commands that do NOT need files/skills context buttons in the terminal
  const blacklist = [
    'npm',
    'npx',
    'pnpm',
    'yarn',
    'bun',
    'cd',
    'ls',
    'dir',
    'pwd',
    'clear',
    'cls',
    'exit'
  ];
  
  return !blacklist.includes(execName);
};

export function TerminalInstance({ terminalId, shell, cwd }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const webGlAddonRef = useRef<WebglAddon | null>(null);
  const canvasAddonRef = useRef<CanvasAddon | null>(null);
  const { sessions, activeSessionId, useWebGl, capturedElement, linkOpeningMode } = useAppState();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragFileName, setDragFileName] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [selectedCli, setSelectedCliState] = useState<string | null>(() => {
    return sessionStorage.getItem(`active_cli_${terminalId}`) || null;
  });

  const setSelectedCli = useCallback((val: string | null) => {
    setSelectedCliState(val);
    if (val) {
      sessionStorage.setItem(`active_cli_${terminalId}`, val);
    } else {
      sessionStorage.removeItem(`active_cli_${terminalId}`);
    }
  }, [terminalId]);
  const [showCliBar, setShowCliBar] = useState(true);

  const linkOpeningModeRef = useRef(linkOpeningMode);
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    linkOpeningModeRef.current = linkOpeningMode;
  }, [linkOpeningMode]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);
  const idleTimeoutRef = useRef<any>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [showSkillsDropdown, setShowSkillsDropdown] = useState(false);
  const [skillsList, setSkillsList] = useState<{ global: SkillInfo[]; project: SkillInfo[] }>({ global: [], project: [] });
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsSearchQuery, setSkillsSearchQuery] = useState('');
  const skillsSearchRef = useRef<HTMLInputElement>(null);
  const [showCliDropdown, setShowCliDropdown] = useState(false);
  const [cliSearchQuery, setCliSearchQuery] = useState('');
  const cliSearchRef = useRef<HTMLInputElement>(null);
  const [customClis, setCustomClis] = useState<{ name: string; command: string; description: string; isCustom: boolean }[]>(() => {
    try {
      const saved = localStorage.getItem('custom_cli_shortcuts');
      return saved ? JSON.parse(saved).map((c: any) => ({ ...c, isCustom: true })) : [];
    } catch (e) {
      console.error('Failed to load custom CLI shortcuts:', e);
      return [];
    }
  });
  const [isAddingCustomCli, setIsAddingCustomCli] = useState(false);
  const [newCliName, setNewCliName] = useState('');
  const [newCliCommand, setNewCliCommand] = useState('');
  const [newCliDescription, setNewCliDescription] = useState('');

  const handleAddCustomCliSubmit = () => {
    if (!newCliName.trim() || !newCliCommand.trim()) return;

    const newCli = {
      name: newCliName.trim(),
      command: newCliCommand.trim(),
      description: newCliDescription.trim(),
      isCustom: true
    };

    const updated = [...customClis, newCli];
    setCustomClis(updated);
    try {
      localStorage.setItem('custom_cli_shortcuts', JSON.stringify(updated.map(({ name, command, description }) => ({ name, command, description }))));
    } catch (e) {
      console.error('Failed to save custom CLI shortcut:', e);
    }

    setIsAddingCustomCli(false);
    setNewCliName('');
    setNewCliCommand('');
    setNewCliDescription('');
  };

  const handleDeleteCustomCli = (nameToDelete: string) => {
    const updated = customClis.filter(c => c.name !== nameToDelete);
    setCustomClis(updated);
    try {
      localStorage.setItem('custom_cli_shortcuts', JSON.stringify(updated.map(({ name, command, description }) => ({ name, command, description }))));
    } catch (e) {
      console.error('Failed to delete custom CLI shortcut:', e);
    }
  };

  const [favoriteClis, setFavoriteClis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('favorite_cli_shortcuts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load favorite CLI shortcuts:', e);
      return [];
    }
  });

  const handleToggleFavorite = (cliName: string) => {
    let updated: string[];
    if (favoriteClis.includes(cliName)) {
      updated = favoriteClis.filter(name => name !== cliName);
    } else {
      updated = [...favoriteClis, cliName];
    }
    setFavoriteClis(updated);
    try {
      localStorage.setItem('favorite_cli_shortcuts', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save favorite CLI shortcuts:', e);
    }
  };

  const [headerWidth, setHeaderWidth] = useState<number>(0);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!headerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderWidth(entry.contentRect.width);
      }
    });
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    if ('fonts' in document) {
      Promise.all([
        document.fonts.load('13px "JetBrains Mono"'),
        document.fonts.ready
      ]).then(() => {
        if (active) setFontsLoaded(true);
      }).catch(() => {
        if (active) setFontsLoaded(true);
      });
    } else {
      setFontsLoaded(true);
    }
    return () => {
      active = false;
    };
  }, []);

  const handleCliClick = (command: string) => {
    if (!isReady) return;
    if (shouldShowFilesAndSkills(command)) {
      setSelectedCli(command);
    } else {
      setSelectedCli(null);
    }
    ptyWrite(terminalId, `${command}\r`).catch(console.error);
    setShowCliBar(false);
  };

  const handleMediaClick = async () => {
    try {
      const selected = await open({
        multiple: true,
        directory: false,
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        if (paths.length > 0) {
          const pathsStr = paths.map(p => `"${p}"`).join(' ') + ' ';
          await ptyWrite(terminalId, pathsStr);
          termRef.current?.focus();
        }
      }
    } catch (err) {
      console.error('Failed to open file dialog or write paths:', err);
    }
  };

  const loadSkills = async () => {
    setIsLoadingSkills(true);
    try {
      const home = await homeDir();
      const separator = cwd.includes('\\') ? '\\' : '/';

      const globalSkills: SkillInfo[] = [];
      const projectSkills: SkillInfo[] = [];
      const processedGlobalFolders = new Set<string>();

      const EXCLUDED_HOME_DIRS = new Set([
        '.cargo', '.rustup', '.docker', '.kube', '.ssh', '.git', 
        '.npm', '.cache', '.local', '.vscode', '.electron', '.idea'
      ]);

      const EXCLUDED_PROJECT_DIRS = new Set([
        'node_modules', '.git', 'dist', 'build', '.fallow'
      ]);

      const scanDirectory = async (dirPath: string, type: 'global' | 'project') => {
        try {
          const entries = await readDir(dirPath);
          if (!entries || entries.length === 0) return;
          
          for (const entry of entries) {
            if (entry.isDir) {
              const folderName = entry.name;
              if (folderName.startsWith('.')) {
                continue;
              }
              const skillDirName = folderName.toLowerCase();
              
              if (type === 'global' && processedGlobalFolders.has(skillDirName)) {
                continue;
              }

              let name = folderName.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              let description = 'No description available.';
              const skillMdPath = `${entry.path}${separator}SKILL.md`;
              
              try {
                const skillMdContent = await readFile(skillMdPath);
                if (skillMdContent) {
                  const yamlMatch = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                  if (yamlMatch) {
                    const yamlText = yamlMatch[1];
                    const nameMatch = yamlText.match(/^name:\s*(.+)$/m);
                    const descMatch = yamlText.match(/^description:\s*(.+)$/m);
                    if (nameMatch) {
                      name = nameMatch[1].replace(/['"]/g, '').trim();
                    }
                    if (descMatch) {
                      description = descMatch[1].replace(/['"]/g, '').trim();
                    }
                  } else {
                    const titleMatch = skillMdContent.match(/^#\s*(.+)$/m);
                    if (titleMatch) {
                      name = titleMatch[1].trim();
                    }
                  }
                }
              } catch (e) {
                // Ignore if SKILL.md doesn't exist
              }

              const skillObj: SkillInfo = {
                id: entry.path,
                name,
                description,
                path: entry.path,
                type
              };

              if (type === 'global') {
                globalSkills.push(skillObj);
                processedGlobalFolders.add(skillDirName);
              } else {
                projectSkills.push(skillObj);
              }
            }
          }
        } catch (e) {
          // Ignore directory scan errors
        }
      };

      // 1. Scan project-specific skills (look for direct "skills" folder or "<subDir>/skills" inside first-level directories)
      try {
        const projectEntries = await readDir(cwd);
        for (const entry of projectEntries) {
          if (entry.isDir && !EXCLUDED_PROJECT_DIRS.has(entry.name.toLowerCase())) {
            if (entry.name.toLowerCase() === 'skills') {
              await scanDirectory(entry.path, 'project');
            } else {
              const potentialPath = `${entry.path}${separator}skills`;
              await scanDirectory(potentialPath, 'project');
            }
          }
        }
      } catch (err) {
        console.error('Failed to scan project directory for skills:', err);
      }

      // 2. Scan all hidden folders in the home folder for a skills subfolder
      try {
        const homeEntries = await readDir(home);
        for (const entry of homeEntries) {
          if (entry.isDir && entry.name.startsWith('.') && !EXCLUDED_HOME_DIRS.has(entry.name.toLowerCase())) {
            if (entry.name.toLowerCase() === '.gemini') {
              // Special case: scan all subdirectories under .gemini for skills
              try {
                const geminiEntries = await readDir(entry.path);
                for (const gemSub of geminiEntries) {
                  if (gemSub.isDir) {
                    const potentialPath = `${gemSub.path}${separator}skills`;
                    await scanDirectory(potentialPath, 'global');
                  }
                }
              } catch (e) {
                console.error('Error scanning .gemini directory:', e);
              }
            } else {
              // Standard hidden directory: scan the skills subfolder directly
              const potentialPath = `${entry.path}${separator}skills`;
              await scanDirectory(potentialPath, 'global');
            }
          }
        }
      } catch (err) {
        console.error('Failed to scan home directory for skills:', err);
      }

      setSkillsList({ global: globalSkills, project: projectSkills });
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setIsLoadingSkills(false);
    }
  };

  const handleSkillClick = async (skill: SkillInfo) => {
    const folderName = skill.path.split(/[/\\]/).pop() || skill.name;
    try {
      await ptyWrite(terminalId, '/' + folderName + ' ');
      setShowSkillsDropdown(false);
      termRef.current?.focus();
    } catch (err) {
      console.error('Failed to write skill to PTY:', err);
    }
  };

  const renderSkillsDropdown = () => {
    const query = skillsSearchQuery.toLowerCase().trim();
    const filteredProject = query
      ? skillsList.project.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
      : skillsList.project;
    const filteredGlobal = query
      ? skillsList.global.filter(s => s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query))
      : skillsList.global;

    const renderSkillItem = (skill: SkillInfo, accentColor: string) => (
      <div 
        key={skill.id} 
        className="skills-dropdown__item"
        onClick={() => handleSkillClick(skill)}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: accentColor, marginTop: '2px' }}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <div className="skills-dropdown__item-content">
          <div className="skills-dropdown__item-name">{skill.name}</div>
          <div className="skills-dropdown__item-desc">{skill.description}</div>
        </div>
        <button 
          className="skills-dropdown__item-copy-btn"
          onClick={(e) => {
            e.stopPropagation();
            const separator = skill.path.includes('\\') ? '\\' : '/';
            const mdPath = `${skill.path}${separator}SKILL.md`;
            dispatch({
              type: 'OPEN_TAB',
              payload: {
                id: `tab-editor-${mdPath}`,
                type: 'editor',
                title: 'SKILL.md',
                filePath: mdPath,
              },
            });
            setShowSkillsDropdown(false);
            setSkillsSearchQuery('');
          }}
          title={t('terminal.openSkillFile')}
          style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7" />
            <polyline points="7 7 17 7 17 17" />
          </svg>
        </button>
      </div>
    );

    return (
      <>
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
          onClick={(e) => {
            e.stopPropagation();
            setShowSkillsDropdown(false);
            setSkillsSearchQuery('');
          }} 
        />
        
        <div className="skills-dropdown" style={{ zIndex: 1000 }}>
          <div className="skills-dropdown__search">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={skillsSearchRef}
              type="text"
              className="skills-dropdown__search-input"
              placeholder="Search skills..."
              value={skillsSearchQuery}
              onChange={(e) => setSkillsSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              autoFocus
            />
            {skillsSearchQuery && (
              <button
                className="skills-dropdown__search-clear"
                onClick={() => {
                  setSkillsSearchQuery('');
                  skillsSearchRef.current?.focus();
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {isLoadingSkills && <span className="skills-dropdown__loader" />}
          </div>
          
          <div className="skills-dropdown__scroll">
            <div className="skills-dropdown__section">
              <div className="skills-dropdown__section-title">
                <span>{t('terminal.projectSkills')}</span>
                <span className="skills-dropdown__badge skills-dropdown__badge--project">
                  {filteredProject.length}
                </span>
              </div>
              
              {filteredProject.length === 0 ? (
                <div className="skills-dropdown__empty">
                  {query ? 'No matching project skills.' : t('terminal.noProjectSkills')}
                </div>
              ) : (
                filteredProject.map(skill => renderSkillItem(skill, 'var(--color-accent-blue)'))
              )}
            </div>
            
            <div className="skills-dropdown__divider" />
            
            <div className="skills-dropdown__section">
              <div className="skills-dropdown__section-title">
                <span>{t('terminal.globalSkills')}</span>
                <span className="skills-dropdown__badge skills-dropdown__badge--global">
                  {filteredGlobal.length}
                </span>
              </div>
              
              {filteredGlobal.length === 0 ? (
                <div className="skills-dropdown__empty">
                  {query ? 'No matching global skills.' : t('terminal.noGlobalSkills')}
                </div>
              ) : (
                filteredGlobal.map(skill => renderSkillItem(skill, 'var(--color-accent-purple)'))
              )}
            </div>
          </div>
        </div>
      </>
    );
  };



  const renderCliDropdown = () => {
    const defaultCliLogo = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-accent-amber)', flexShrink: 0 }}>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    );

    const allClis = customClis.map(c => ({
      ...c,
      logo: defaultCliLogo,
      isCustom: true
    }));

    const query = cliSearchQuery.toLowerCase().trim();
    const filteredClis = query
      ? allClis.filter(c => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query) || c.command.toLowerCase().includes(query))
      : allClis;

    const favorites = filteredClis.filter(c => favoriteClis.includes(c.name));
    const customsOnly = filteredClis.filter(c => !favoriteClis.includes(c.name));
    const presetsOnly: typeof allClis = [];

    const renderCliItem = (cli: typeof allClis[0], isFav: boolean) => {
      const isStarred = favoriteClis.includes(cli.name);
      return (
        <div 
          key={cli.name} 
          className="skills-dropdown__item"
          onClick={() => {
            handleCliClick(cli.command);
            setShowCliDropdown(false);
            setCliSearchQuery('');
          }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <div style={{ flexShrink: 0, marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px' }}>
              {cli.logo}
            </div>
            <div className="skills-dropdown__item-content" style={{ marginLeft: 'var(--space-sm)', minWidth: 0, flex: 1 }}>
              <div className="skills-dropdown__item-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cli.name}</div>
              <div className="skills-dropdown__item-desc" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cli.description}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(cli.name);
              }}
              title={isStarred ? "Remove from favorites" : "Add to favorites"}
              style={{ 
                color: isStarred ? 'var(--color-accent-amber)' : 'rgba(255,255,255,0.2)', 
                background: 'none', 
                border: 'none', 
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!isStarred) e.currentTarget.style.color = 'var(--color-accent-amber)';
              }}
              onMouseLeave={(e) => {
                if (!isStarred) e.currentTarget.style.color = 'rgba(255,255,255,0.2)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>

            {cli.isCustom && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteCustomCli(cli.name);
                  if (favoriteClis.includes(cli.name)) {
                    handleToggleFavorite(cli.name);
                  }
                }}
                title={t('terminal.deleteCustomCli')}
                style={{ 
                  color: 'rgba(255,255,255,0.4)', 
                  background: 'none', 
                  border: 'none', 
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ff4d4f'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <>
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 999 }} 
          onClick={(e) => {
            e.stopPropagation();
            setShowCliDropdown(false);
            setCliSearchQuery('');
            setIsAddingCustomCli(false);
            setNewCliName('');
            setNewCliCommand('');
            setNewCliDescription('');
          }} 
        />
        
        {isAddingCustomCli ? (
          <div className="skills-dropdown" style={{ zIndex: 1000, width: '280px', padding: '16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-mute)', textTransform: 'uppercase', marginBottom: '6px' }}>
                {t('terminal.addCustomCliTitle')}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--color-mute)' }}>
                  {t('terminal.cliNameLabel')}
                </label>
                <input
                  type="text"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    color: 'var(--color-body-strong)',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                  placeholder={t('terminal.cliNamePlaceholder')}
                  value={newCliName}
                  onChange={(e) => setNewCliName(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--color-mute)' }}>
                  {t('terminal.cliCommandLabel')}
                </label>
                <input
                  type="text"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    color: 'var(--color-body-strong)',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                  placeholder={t('terminal.cliCommandPlaceholder')}
                  value={newCliCommand}
                  onChange={(e) => setNewCliCommand(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '10px', color: 'var(--color-mute)' }}>
                  {t('terminal.cliDescLabel')}
                </label>
                <input
                  type="text"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '9999px',
                    color: 'var(--color-body-strong)',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-sans)',
                    outline: 'none',
                  }}
                  placeholder={t('terminal.cliDescPlaceholder')}
                  value={newCliDescription}
                  onChange={(e) => setNewCliDescription(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                  onClick={() => {
                    setIsAddingCustomCli(false);
                    setNewCliName('');
                    setNewCliCommand('');
                    setNewCliDescription('');
                  }}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: 'var(--color-body-strong)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                >
                  {t('workspace.cancel')}
                </button>
                <button
                  onClick={handleAddCustomCliSubmit}
                  disabled={!newCliName.trim() || !newCliCommand.trim()}
                  style={{
                    flex: 1,
                    background: (!newCliName.trim() || !newCliCommand.trim()) ? 'rgba(212, 168, 87, 0.3)' : 'var(--color-accent-amber)',
                    border: 'none',
                    borderRadius: '9999px',
                    color: '#1c1816',
                    padding: '6px 12px',
                    fontSize: '11px',
                    cursor: (!newCliName.trim() || !newCliCommand.trim()) ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (newCliName.trim() && newCliCommand.trim()) {
                      e.currentTarget.style.opacity = '0.9';
                    }
                  }}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  {t('workspace.save')}
                </button>
              </div>
            </div>
          </div>
        ) : allClis.length === 0 ? (
          <div className="skills-dropdown" style={{ zIndex: 1000, width: '240px', padding: '16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--color-mute)', fontWeight: '400' }}>
              {t('terminal.noShortcutsYet')}
            </div>
            <button
              onClick={() => setIsAddingCustomCli(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                background: 'rgba(212, 168, 87, 0.08)',
                border: '1px dashed rgba(212, 168, 87, 0.3)',
                borderRadius: '9999px',
                color: 'var(--color-accent-amber)',
                padding: '6px 14px',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(212, 168, 87, 0.15)';
                e.currentTarget.style.borderColor = 'var(--color-accent-amber)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212, 168, 87, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(212, 168, 87, 0.3)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>{t('terminal.addCliShortcut')}</span>
            </button>
          </div>
        ) : (
          <div className="skills-dropdown" style={{ zIndex: 1000, width: '280px' }}>
            <div className="skills-dropdown__search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={cliSearchRef}
                type="text"
                className="skills-dropdown__search-input"
                placeholder={t('terminal.searchClis')}
                value={cliSearchQuery}
                onChange={(e) => setCliSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                autoFocus
              />
              {cliSearchQuery && (
                <button
                  className="skills-dropdown__search-clear"
                  onClick={() => {
                    setCliSearchQuery('');
                    cliSearchRef.current?.focus();
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            
            <div className="skills-dropdown__scroll">
              {favorites.length > 0 && (
                <>
                  <div className="skills-dropdown__section">
                    <div className="skills-dropdown__section-title">
                      <span>{t('terminal.favoritesTitle')}</span>
                      <span className="skills-dropdown__badge" style={{ backgroundColor: 'var(--color-accent-amber)', color: '#1c1816' }}>
                        {favorites.length}
                      </span>
                    </div>
                    {favorites.map(cli => renderCliItem(cli, true))}
                  </div>
                  <div style={{ height: '1px', background: 'var(--color-hairline)', margin: '4px 0' }} />
                </>
              )}

              {presetsOnly.length > 0 && (
                <div className="skills-dropdown__section">
                  <div className="skills-dropdown__section-title">
                    <span>{t('terminal.cliSectionHeader')}</span>
                    <span className="skills-dropdown__badge" style={{ backgroundColor: 'var(--color-accent-amber)', color: '#1c1816' }}>
                      {presetsOnly.length}
                    </span>
                  </div>
                  {presetsOnly.map(cli => renderCliItem(cli, false))}
                </div>
              )}

              {presetsOnly.length > 0 && customsOnly.length > 0 && (
                <div style={{ height: '1px', background: 'var(--color-hairline)', margin: '4px 0' }} />
              )}

              {customsOnly.length > 0 && (
                <div className="skills-dropdown__section">
                  <div className="skills-dropdown__section-title">
                    <span>{t('terminal.customSectionHeader')}</span>
                    <span className="skills-dropdown__badge" style={{ backgroundColor: 'var(--color-accent-amber)', color: '#1c1816' }}>
                      {customsOnly.length}
                    </span>
                  </div>
                  {customsOnly.map(cli => renderCliItem(cli, false))}
                </div>
              )}

              {favorites.length === 0 && presetsOnly.length === 0 && customsOnly.length === 0 && (
                <div className="skills-dropdown__empty">
                  {t('terminal.noMatchingClis')}
                </div>
              )}
            </div>
            
            <div style={{ padding: '8px', borderTop: '1px solid var(--color-hairline)' }}>
              <button
                onClick={() => setIsAddingCustomCli(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  background: 'rgba(212, 168, 87, 0.08)',
                  border: '1px dashed rgba(212, 168, 87, 0.3)',
                  borderRadius: '9999px',
                  color: 'var(--color-accent-amber)',
                  padding: '6px 14px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(212, 168, 87, 0.15)';
                  e.currentTarget.style.borderColor = 'var(--color-accent-amber)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(212, 168, 87, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(212, 168, 87, 0.3)';
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>{t('terminal.addCliShortcut')}</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  const handleDropCapturedElement = () => {
    if (capturedElement && termRef.current && isReady) {
      const isHtml = capturedElement.trim().startsWith('<');
      const textToWrite = isHtml ? capturedElement : `"${capturedElement}"`;
      ptyWrite(terminalId, textToWrite).catch(console.error);
      dispatch({ type: 'SET_CAPTURED_ELEMENT', payload: null });
    }
  };

  // ── Helper Actions ──────────────────────────────────────────────

  const handleClipboardPaste = useCallback(async () => {
    try {
      const files = await getClipboardFiles(cwd);
      if (files && files.length > 0) {
        const formatted = files.map(f => `"${f}"`).join(', ');
        await ptyWrite(terminalId, formatted);
      } else {
        const text = await navigator.clipboard.readText();
        if (text) {
          await ptyWrite(terminalId, text);
        }
      }
    } catch (err) {
      console.error('Failed to parse clipboard files:', err);
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          await ptyWrite(terminalId, text);
        }
      } catch (clipErr) {
        console.error('Clipboard text fallback failed:', clipErr);
      }
    }
  }, [terminalId, cwd]);

  const deleteSelection = useCallback(async (term: Terminal) => {
    if (!term.hasSelection()) return;
    const range = term.getSelectionPosition();
    if (range && term.buffer && term.buffer.active) {
      const cols = term.cols;
      const cursorX = term.buffer.active.cursorX;
      const cursorY = term.buffer.active.cursorY;
      const baseY = term.buffer.active.baseY;

      const startX = range.start.x;
      const startY = range.start.y;
      const endX = range.end.x;
      const endY = range.end.y;

      const cursorIndex = (baseY + cursorY) * cols + cursorX;
      const startIndex = startY * cols + startX;
      const endIndex = endY * cols + endX;

      const cursorRowAbsolute = baseY + cursorY;
      if (Math.abs(startY - cursorRowAbsolute) <= 3 && Math.abs(endY - cursorRowAbsolute) <= 3) {
        try {
          if (cursorIndex > endIndex) {
            const leftArrowsCount = cursorIndex - endIndex;
            await ptyWrite(terminalId, '\x1b[D'.repeat(leftArrowsCount));
          } else if (cursorIndex < endIndex) {
            const rightArrowsCount = endIndex - cursorIndex;
            await ptyWrite(terminalId, '\x1b[C'.repeat(rightArrowsCount));
          }

          const selectionLength = endIndex - startIndex;
          await ptyWrite(terminalId, '\x7f'.repeat(selectionLength));

          if (cursorIndex > endIndex) {
            const rightRestoreCount = cursorIndex - endIndex;
            await ptyWrite(terminalId, '\x1b[C'.repeat(rightRestoreCount));
          } else if (cursorIndex < endIndex) {
            const leftRestoreCount = startIndex - cursorIndex;
            if (leftRestoreCount > 0) {
              await ptyWrite(terminalId, '\x1b[D'.repeat(leftRestoreCount));
            }
          }

          term.clearSelection();
        } catch (err) {
          console.error('Failed to delete selected text in PTY:', err);
        }
      }
    }
  }, [terminalId]);

  const checkPromptState = useCallback((term: Terminal) => {
    const buffer = term.buffer.active;
    if (buffer.type === 'alternate') {
       setShowCliBar(false);
       return;
    }
    const cursorY = buffer.cursorY;
    const line = buffer.getLine(cursorY + buffer.baseY);
    if (!line) return;
    
    const text = line.translateToString(false).substring(0, buffer.cursorX).trimEnd();
    const isPrompt = isShellPrompt(text);
    setShowCliBar(isPrompt);
    if (isPrompt) {
      setSelectedCli(null);
    }
  }, []);

  // ── Tauri native File Drag & Drop ─────────────────────────────
  useEffect(() => {
    let unEnter: (() => void) | null = null;
    let unOver: (() => void) | null = null;
    let unLeave: (() => void) | null = null;
    let unDrop: (() => void) | null = null;

    const isOverThisPane = (pos: { x: number; y: number }) => {
      const el = wrapperRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return (
        pos.x >= rect.left &&
        pos.x <= rect.right &&
        pos.y >= rect.top &&
        pos.y <= rect.bottom
      );
    };

    const setup = async () => {
      unEnter = await listen<{ paths: string[]; position: { x: number; y: number } }>(
        'tauri://drag-enter',
        (event) => {
          if (isOverThisPane(event.payload.position)) {
            setIsDraggingFile(true);
            if (event.payload.paths && event.payload.paths.length > 0) {
              const name = event.payload.paths[0].split(/[/\\]/).pop() || null;
              setDragFileName(name);
            }
          }
        }
      );

      unOver = await listen<{ position: { x: number; y: number } }>(
        'tauri://drag-over',
        (event) => {
          const over = isOverThisPane(event.payload.position);
          setIsDraggingFile(prev => {
            if (over && !prev) return true;
            if (!over && prev) return false;
            return prev;
          });
        }
      );

      unLeave = await listen('tauri://drag-leave', () => {
        setIsDraggingFile(false);
        setDragFileName(null);
      });

      unDrop = await listen<{ paths: string[]; position: { x: number; y: number } }>(
        'tauri://drag-drop',
        (event) => {
          setIsDraggingFile(false);
          setDragFileName(null);
          if (
            isOverThisPane(event.payload.position) &&
            event.payload.paths &&
            event.payload.paths.length > 0 &&
            termRef.current &&
            isReady
          ) {
            const pathsStr = event.payload.paths.map(p => `"${p}"`).join(' ');
            ptyWrite(terminalId, pathsStr).catch(console.error);
          }
        }
      );
    };

    setup();

    return () => {
      unEnter?.();
      unOver?.();
      unLeave?.();
      unDrop?.();
    };
  }, [terminalId, isReady]);

  // ── Terminal lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (!fontsLoaded) return;
    const container = containerRef.current;
    if (!container) return;

    let isDestroyed = false;
    let unlistenOutput: (() => void) | null = null;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono Regular','JetBrains Mono',Consolas,monospace",
      fontSize: 13,
      lineHeight: 1.0,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorInactiveStyle: 'none',
      theme: {
        background: '#2b2622',
        foreground: '#f7f5f0',
        cursor: '#d4a857',
        cursorAccent: '#2b2622',
        selectionBackground: 'rgba(212, 168, 87, 0.3)',
        black: '#2b2622',
        red: '#e76c5f',
        green: '#8cb87a',
        yellow: '#d4a857',
        blue: '#6fa3c9',
        magenta: '#a88bc7',
        cyan: '#60b0a2',
        white: '#f7f5f0',
        brightBlack: '#aea69c',
        brightRed: '#e76c5f',
        brightGreen: '#8cb87a',
        brightYellow: '#d4a857',
        brightBlue: '#6fa3c9',
        brightMagenta: '#a88bc7',
        brightCyan: '#60b0a2',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    // Custom Link Provider to handle URLs in the terminal
    term.registerLinkProvider({
      provideLinks(y: number, callback: (links: any[]) => void) {
        const line = term.buffer.active.getLine(y - 1);
        if (!line) {
          callback([]);
          return;
        }
        const text = line.translateToString(true);
        const regex = /https?:\/\/[^\s"'()]+/g;
        const links: any[] = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
          const matchedText = match[0];
          const startX = match.index;
          const range = {
            start: { x: startX + 1, y: y },
            end: { x: startX + matchedText.length, y: y }
          };
          links.push({
            range,
            text: matchedText,
            activate(event: MouseEvent, uri: string) {
              const mode = linkOpeningModeRef.current || 'browser';
              const sessionId = activeSessionIdRef.current || '';
              if (mode === 'preview') {
                dispatch({
                  type: 'SET_SESSION_PREVIEW_URL',
                  payload: { sessionId, previewUrl: uri, showPreview: true }
                });
              } else {
                import('@tauri-apps/plugin-shell').then(({ open: openExternal }) => {
                  openExternal(uri).catch(console.error);
                }).catch(console.error);
              }
            }
          });
        }
        callback(links);
      }
    });

    // Ignore any cursor style changes from escape sequences to keep the cursor as a thin vertical line everywhere
    term.parser.registerCsiHandler({ final: 'q' }, () => true);
    term.parser.registerCsiHandler({ intermediates: ' ', final: 'q' }, () => true);

    let hasFocus = false;
    const handleFocus = () => { hasFocus = true; };
    const handleBlur = () => { hasFocus = false; };
    term.textarea?.addEventListener('focus', handleFocus);
    term.textarea?.addEventListener('blur', handleBlur);

    const handleDictationInsert = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      if (hasFocus && customEvent.detail && customEvent.detail.text) {
        ptyWrite(terminalId, customEvent.detail.text).catch(console.error);
        customEvent.preventDefault();
        customEvent.stopPropagation();
      }
    };

    window.addEventListener('fit-dictation-insert', handleDictationInsert, true);

    let pasteHandled = false;
    let pasteTimeout: any = null;

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        pasteHandled = true;
        if (pasteTimeout) clearTimeout(pasteTimeout);
        pasteTimeout = setTimeout(() => {
          pasteHandled = false;
        }, 100);
        handleClipboardPaste();
        return false;
      }

      if (e.type === 'keydown' && (e.key === 'Backspace' || e.key === 'Delete') && term.hasSelection()) {
        deleteSelection(term);
        return false;
      }
      return true;
    });

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!pasteHandled) {
        handleClipboardPaste();
      }
    };

    container.addEventListener('paste', handlePaste, true);

    // Patch viewport scroll logic
    let vp: any = null;
    if ((term as any).viewport) {
      vp = (term as any).viewport;
    } else if ((term as any)._core?.viewport) {
      vp = (term as any)._core.viewport;
    }
    if (vp && typeof vp.syncScrollArea === 'function') {
      const origSync = vp.syncScrollArea;
      vp.syncScrollArea = function (...args: any[]) {
        if (isDestroyed) return;
        try {
          return origSync.apply(this, args);
        } catch (e: any) {
          if (
            e instanceof TypeError &&
            (e.message?.includes('dimensions') ||
              e.message?.includes('undefined') ||
              e.message?.includes('null'))
          ) {
            return;
          }
          console.warn('xterm syncScrollArea exception:', e);
        }
      };
    }

    const tryFit = () => {
      try {
        if (!isDestroyed && fitAddon && containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddon.fit();
        }
      } catch (e) {}
    };

    // Use rAF chain to let PanelGroup layout settle before first fit
    let fitTimeout: ReturnType<typeof setTimeout>;
    requestAnimationFrame(() => {
      fitTimeout = setTimeout(tryFit, 100);
    });
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    async function setupPty() {
      try {
        let attempts = 0;
        while ((!containerRef.current || containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) && attempts < 25) {
          await new Promise(r => setTimeout(r, 20));
          attempts++;
        }

        if (isDestroyed) return;

        // Let PanelGroup layout settle with double-rAF before first fit
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => requestAnimationFrame(r));

        try {
          if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
            fitAddon.fit();
          }
        } catch (e) {}

        if (isDestroyed) return;

        const unsub = await listen<{ pty_id: string; data: string }>('pty-output', (event) => {
          if (!isDestroyed && event.payload.pty_id === terminalId) {
            let data = event.payload.data;
            const urlRegex = /(https?:\/\/[^\s"'()]+)/g;
            data = data.replace(urlRegex, '\x1b[38;5;214m$1\x1b[39m');
            term.write(data, () => {
              if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
              idleTimeoutRef.current = setTimeout(() => checkPromptState(term), 200);
            });
          }
        });
        if (isDestroyed) {
          unsub();
          return;
        } else {
          unlistenOutput = unsub;
        }

        await ptySpawn(terminalId, shell, cwd, term.cols, term.rows);

        if (isDestroyed) return;

        let inputBuffer = '';
        term.onData((data) => {
          if (!isDestroyed) {
            if (data === '\r' || data === '\n') {
              setShowCliBar(false);
              const cmd = inputBuffer.trim();
              if (cmd === '/exit') {
                inputBuffer = '';
                setSelectedCli(null);
                setShowCliBar(true);
                term.reset();
                term.write('\x1b[2J\x1b[H');
                term.write('\r\n\x1b[33mResetting terminal session...\x1b[0m\r\n');
                
                ptyKill(terminalId)
                  .then(() => ptySpawn(terminalId, shell, cwd, term.cols, term.rows))
                  .catch(console.error);
                return;
              }
              
              if (cmd) {
                if (shouldShowFilesAndSkills(cmd)) {
                  setSelectedCli(cmd);
                } else {
                  setSelectedCli(null);
                }
              }
              inputBuffer = '';
            } else if (data === '\x7f' || data === '\b') {
              inputBuffer = inputBuffer.slice(0, -1);
            } else if (data.length > 0 && data.charCodeAt(0) >= 32) {
              inputBuffer += data;
            }

            ptyWrite(terminalId, data).catch(console.error);
          }
        });

        term.onResize(({ cols, rows }) => {
          if (!isDestroyed && cols > 0 && rows > 0) {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
              if (!isDestroyed) {
                ptyResize(terminalId, cols, rows).catch(console.error);
              }
            }, 60);
          }
        });

        // Re-fit after PTY is spawned to catch any late PanelGroup layout changes
        setTimeout(tryFit, 200);
        setIsReady(true);
      } catch (err) {
        if (!isDestroyed) {
          console.error('Failed to spawn PTY:', err);
          term.write(`\r\n\x1b[31mFailed to spawn PTY: ${err}\x1b[0m\r\n`);
        }
      }
    }

    setupPty();

    const handleResize = () => tryFit();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      if (!isDestroyed) {
        requestAnimationFrame(tryFit);
      }
    });
    observer.observe(container);

    return () => {
      isDestroyed = true;
      if (resizeTimeout) clearTimeout(resizeTimeout);
      term.textarea?.removeEventListener('focus', handleFocus);
      term.textarea?.removeEventListener('blur', handleBlur);
      window.removeEventListener('fit-dictation-insert', handleDictationInsert, true);
      clearTimeout(fitTimeout);
      if (pasteTimeout) clearTimeout(pasteTimeout);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('paste', handlePaste, true);
      observer.disconnect();
      if (unlistenOutput) unlistenOutput();
      // Skip ptyKill if this terminal is being restructured by a grid split
      if (!consumeGridKeepAlive(terminalId)) {
        ptyKill(terminalId).catch(console.error);
      }
      if (webGlAddonRef.current) {
        try { webGlAddonRef.current.dispose(); } catch (e) {}
        webGlAddonRef.current = null;
      }
      if (canvasAddonRef.current) {
        try { canvasAddonRef.current.dispose(); } catch (e) {}
        canvasAddonRef.current = null;
      }
      try { term.dispose(); } catch (e) {}
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [fontsLoaded, terminalId, cwd, shell, handleClipboardPaste, deleteSelection, checkPromptState]);

  useEffect(() => {
    const term = termRef.current;
    if (!term || !isReady) return;

    if (webGlAddonRef.current) {
      try {
        webGlAddonRef.current.dispose();
      } catch (e) {}
      webGlAddonRef.current = null;
    }
    if (canvasAddonRef.current) {
      try {
        canvasAddonRef.current.dispose();
      } catch (e) {}
      canvasAddonRef.current = null;
    }

    if (useWebGl) {
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
        webGlAddonRef.current = webgl;
      } catch (e) {
        console.warn('WebGL addon failed to load, falling back to Canvas:', e);
        try {
          const canvas = new CanvasAddon();
          term.loadAddon(canvas);
          canvasAddonRef.current = canvas;
        } catch (canvasErr) {}
      }
    } else {
      try {
        const canvas = new CanvasAddon();
        term.loadAddon(canvas);
        canvasAddonRef.current = canvas;
      } catch (e) {
        console.warn('Canvas addon failed to load:', e);
      }
    }
  }, [useWebGl, isReady]);


  const handleClose = () => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        const otherIds = collectTerminalIds(session.rootPanel).filter(id => id !== terminalId);
        markGridKeepAlive(otherIds);
      }
      // Explicitly kill the PTY before removing from the tree so the
      // process is terminated even though the cleanup skips ptyKill.
      ptyKill(terminalId).catch(console.error);
      dispatch({
        type: 'REMOVE_TERMINAL_PANEL',
        payload: { sessionId: activeSessionId, terminalId }
      });
    }
  };

  const handleSplitRight = () => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        markGridKeepAlive(collectTerminalIds(session.rootPanel));
      }
      dispatch({
        type: 'SPLIT_TERMINAL',
        payload: { sessionId: activeSessionId, terminalId, direction: 'horizontal' }
      });
    }
  };

  const handleSplitDown = () => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        markGridKeepAlive(collectTerminalIds(session.rootPanel));
      }
      dispatch({
        type: 'SPLIT_TERMINAL',
        payload: { sessionId: activeSessionId, terminalId, direction: 'vertical' }
      });
    }
  };

  const handleSplitGrid = (cols: number, rows: number) => {
    if (activeSessionId) {
      const session = sessions.find(s => s.id === activeSessionId);
      if (session) {
        // Mark all existing terminal ids so their PTYs survive the
        // tree restructure (component unmount/remount).
        markGridKeepAlive(collectTerminalIds(session.rootPanel));
      }
      dispatch({
        type: 'SPLIT_TERMINAL_GRID',
        payload: { sessionId: activeSessionId, terminalId, cols, rows }
      });
    }
  };

  const handleTogglePreview = () => {
    if (activeSessionId) {
      dispatch({
        type: 'TOGGLE_SESSION_PREVIEW',
        payload: { sessionId: activeSessionId }
      });
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const terminalCount = activeSession ? countTerminals(activeSession.rootPanel) : 0;

  return (
    <div className="terminal-container" ref={wrapperRef}>
      <div 
        ref={headerRef}
        className={`terminal-header ${
          headerWidth > 0 && headerWidth < 450 ? 'terminal-header--narrow' : ''
        } ${
          headerWidth > 0 && headerWidth < 320 ? 'terminal-header--very-narrow' : ''
        } terminal-header--count-${terminalCount}`}
      >
        <div className="terminal-header__shell">
          {selectedCli ? (
            <div className="terminal-active-cli" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
              <button
                className="terminal-header__action-btn"
                onClick={handleMediaClick}
                title={t('terminal.mediaPicker')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="terminal-header__btn-text">Files</span>
              </button>

              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className={`terminal-header__action-btn ${showSkillsDropdown ? 'terminal-header__action-btn--active' : ''}`}
                  onClick={() => {
                    const nextShow = !showSkillsDropdown;
                    setShowSkillsDropdown(nextShow);
                    if (nextShow) {
                      loadSkills();
                    }
                  }}
                  title={t('terminal.skillsList')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <span className="terminal-header__btn-text">Skills</span>
                  <svg className="terminal-header__chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginLeft: '2px' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showSkillsDropdown && renderSkillsDropdown()}
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                className={`terminal-header__action-btn ${showCliDropdown ? 'terminal-header__action-btn--active' : ''}`}
                onClick={() => {
                  const nextShow = !showCliDropdown;
                  setShowCliDropdown(nextShow);
                  if (!nextShow) {
                    setIsAddingCustomCli(false);
                    setNewCliName('');
                    setNewCliCommand('');
                    setNewCliDescription('');
                  }
                }}
                title={t('terminal.shortcutsTrigger')}
                disabled={!isReady}
              >
                <svg width="12" height="12" viewBox="0 0 256 256" fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M80,224V128a48,48,0,0,1,48-48h88" />
                  <polyline points="176 128 224 80 176 32" />
                </svg>
                <span className="terminal-header__btn-text">{t('terminal.shortcutsTrigger')}</span>
                <svg className="terminal-header__chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, marginLeft: '2px' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showCliDropdown && renderCliDropdown()}
            </div>
          )}
          <button
            className="terminal-header__action-btn"
            onClick={handleSplitRight}
            title={t('terminal.splitRight')}
            disabled={!isReady}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
          <button
            className="terminal-header__action-btn"
            onClick={handleSplitDown}
            title={t('terminal.splitDown')}
            disabled={!isReady}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </button>
          <button
            className={`terminal-header__action-btn ${activeSession?.showPreview ? 'terminal-header__action-btn--active' : ''}`}
            onClick={handleTogglePreview}
            title={t('terminal.togglePreview')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        </div>
        <div className="terminal-header__actions">
          {terminalCount > 1 && (
            <button 
              className="terminal-header__action-btn terminal-header__close-btn" 
              onClick={handleClose} 
              title={t('terminal.close')} 
              style={{ transition: 'all 0.15s ease' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ff4d4f';
                e.currentTarget.style.borderColor = '#ff4d4f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-mute)';
                e.currentTarget.style.borderColor = 'var(--color-hairline)';
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div 
        className="terminal-wrapper" 
        style={{ padding: '8px 4px 8px 4px', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        
        {capturedElement && (
          <div 
            className="terminal-drop-overlay"
            onClick={handleDropCapturedElement}
          >
            <div className="terminal-drop-overlay__content">
              <span>{t('terminal.pasteCaptured')}</span>
            </div>
          </div>
        )}

        {isDraggingFile && (
          <div className="terminal-file-drop-overlay">
            <div className="terminal-file-drop-overlay__content">
              <div className="terminal-file-drop-overlay__icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <span className="terminal-file-drop-overlay__label">{t('terminal.dropFile')}</span>
              {dragFileName && (
                <span className="terminal-file-drop-overlay__filename">{dragFileName}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
