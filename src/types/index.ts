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
  /** @deprecated Legacy — migrated to rootPanel on load. Do not write new code against this. */
  terminals?: TerminalConfig[];
  /** @deprecated Legacy — migrated to rootPanel on load. Do not write new code against this. */
  splitDirection?: SplitDirection;
  rootPanel: PanelNode;
  showPreview?: boolean;
  previewUrl?: string;
}

export type SplitDirection = 'horizontal' | 'vertical';

/** Tree node for recursive terminal split layout. */
export type PanelNode = TerminalPanel | SplitPanel;

export interface TerminalPanel {
  id: string;
  type: 'terminal';
  shell: string;
  cwd: string;
}

export interface SplitPanel {
  id: string;
  type: 'split';
  direction: SplitDirection;
  children: PanelNode[];
}

/** @deprecated Use TerminalPanel or PanelNode instead. */
export interface TerminalConfig {
  id: string;
  shell: string;
  cwd: string;
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


// ── Git / Source Control ──────────────────────────────────────────
export interface GitFileStatus {
  path: string;
  name: string;
  status: string; // 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' etc.
  additions?: number;
  deletions?: number;
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
  hash: string;
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
  autoSave: boolean;
  settingsOpen: boolean;
  aboutOpen: boolean;
  pendingUpdate: { version: string; body?: string } | null;
  inspectorMode: boolean;
  capturedElement: string | null;
  autoHideSidebar: boolean;
  linkOpeningMode?: 'browser' | 'preview';
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
  | { type: 'SPLIT_TERMINAL'; payload: { sessionId: string; terminalId: string; direction: SplitDirection } }
  | { type: 'SPLIT_TERMINAL_GRID'; payload: { sessionId: string; terminalId: string; cols: number; rows: number } }
  | { type: 'REMOVE_TERMINAL_PANEL'; payload: { sessionId: string; terminalId: string } }
  | { type: 'TOGGLE_SESSION_PREVIEW'; payload: { sessionId: string } }
  | { type: 'SET_USE_WEBGL'; payload: boolean }
  | { type: 'SET_AUTO_SAVE'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_ABOUT' }
  | { type: 'TOGGLE_AUTO_HIDE_SIDEBAR' }
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
  | { type: 'SET_PANEL_SIZES'; payload: { key: string; sizes: number[] } }
  | { type: 'SET_INSPECTOR_MODE'; payload: boolean }
  | { type: 'SET_CAPTURED_ELEMENT'; payload: string | null }
  | { type: 'SET_LINK_OPENING_MODE'; payload: 'browser' | 'preview' }
  | { type: 'SET_SESSION_PREVIEW_URL'; payload: { sessionId: string; previewUrl: string; showPreview?: boolean } }
  | { type: 'LOAD_STATE'; payload: AppState };

