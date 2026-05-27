/* ================================================================
   Fit — TypeScript Type Definitions
   ================================================================ */

// ── Workspace ────────────────────────────────────────────────────
export interface Workspace {
  id: string;
  name: string;
  path: string;
  icon?: string;
  color?: string;
  lastOpened?: number;
}

// ── Session ──────────────────────────────────────────────────────
export interface Session {
  id: string;
  workspaceId: string;
  name: string;
  terminals: TerminalConfig[];
  splitDirection: SplitDirection;
  showPreview?: boolean;
}

export interface TerminalConfig {
  id: string;
  shell: string;
  cwd: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

export interface ShellInfo {
  shell_type: string;
  name: string;
  path: string;
  available: boolean;
}

// ── Tabs ─────────────────────────────────────────────────────────
export type TabType = 'session' | 'editor' | 'preview' | 'diff';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  sessionId?: string;
  filePath?: string;
  previewUrl?: string;
  isModified?: boolean;
  workspaceId?: string;
}

// ── File System ──────────────────────────────────────────────────
export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
  size?: number;
}

// ── Ports ────────────────────────────────────────────────────────
export interface PortEntry {
  port: number;
  pid: number;
  process: string;
  framework?: string;
}

export const FRAMEWORK_PORTS: Record<number, string> = {
  3000: 'Next.js',
  3001: 'Next.js (alt)',
  4173: 'Vite preview',
  4200: 'Angular',
  4321: 'Astro',
  5173: 'Vite',
  5174: 'Vite (alt)',
  5500: 'Live Server',
  6006: 'Storybook',
  8000: 'Python',
  8080: 'Dev Server',
  8888: 'Jupyter',
};

// ── Git / Source Control ──────────────────────────────────────────
export interface GitFileStatus {
  path: string;
  name: string;
  status: string; // 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' etc.
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatusResult {
  isRepo: boolean;
  branch: string;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  aheadCommits: GitCommitInfo[];
}

// ── App State ────────────────────────────────────────────────────
export interface AppState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  sessions: Session[];
  activeSessionId: string | null;
  openTabs: Tab[];
  activeTabId: string | null;
  fileDrawerOpen: boolean;
  drawerTab: 'files' | 'git';
  gitStatus: GitStatusResult | null;
  panelSizes: Record<string, number[]>;
  useWebGl: boolean;
  settingsOpen: boolean;
  aboutOpen: boolean;
  pendingUpdate: { version: string; body?: string } | null;
  diffSidebarOpen: boolean;
  diffFilePath: string | null;
}

export type AppAction =
  | { type: 'ADD_WORKSPACE'; payload: Workspace }
  | { type: 'REMOVE_WORKSPACE'; payload: string }
  | { type: 'EDIT_WORKSPACE'; payload: { id: string; name: string; color?: string; icon?: string } }
  | { type: 'SET_ACTIVE_WORKSPACE'; payload: string }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'RENAME_SESSION'; payload: { sessionId: string; name: string } }
  | { type: 'SET_ACTIVE_SESSION'; payload: string }
  | { type: 'SET_SESSION_SPLIT_DIRECTION'; payload: { sessionId: string; splitDirection: SplitDirection } }
  | { type: 'ADD_TERMINAL_TO_SESSION'; payload: { sessionId: string; terminal: TerminalConfig } }
  | { type: 'REMOVE_TERMINAL_FROM_SESSION'; payload: { sessionId: string; terminalId: string } }
  | { type: 'TOGGLE_SESSION_PREVIEW'; payload: { sessionId: string } }
  | { type: 'SET_USE_WEBGL'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_ABOUT' }
  | { type: 'SET_PENDING_UPDATE'; payload: { version: string; body?: string } | null }
  | { type: 'OPEN_TAB'; payload: Tab }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_TAB_MODIFIED'; payload: { tabId: string; isModified: boolean } }
  | { type: 'REORDER_TABS'; payload: { dragIndex: number; hoverIndex: number } }
  | { type: 'TOGGLE_FILE_DRAWER' }
  | { type: 'SET_FILE_DRAWER_OPEN'; payload: boolean }
  | { type: 'SET_DRAWER_TAB'; payload: 'files' | 'git' }
  | { type: 'SET_GIT_STATUS'; payload: GitStatusResult | null }
  | { type: 'TOGGLE_DIFF_SIDEBAR' }
  | { type: 'SET_DIFF_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_DIFF_FILE_PATH'; payload: string | null }
  | { type: 'SET_PANEL_SIZES'; payload: { key: string; sizes: number[] } }
  | { type: 'LOAD_STATE'; payload: AppState };
