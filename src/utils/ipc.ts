/* ================================================================
   Fit — Tauri IPC Wrappers
   Type-safe wrappers around Rust commands.
   ================================================================ */

import { invoke } from '@tauri-apps/api/core';
import { check, type Update } from '@tauri-apps/plugin-updater';
import type { AppState, FileEntry, ShellInfo, PortEntry, GitStatusResult } from '../types';

// ── Filesystem ───────────────────────────────────────────────────

export async function readDir(path: string): Promise<FileEntry[]> {
  try {
    return await invoke<FileEntry[]>('read_dir', { path });
  } catch (error) {
    console.error('IPC readDir error:', error);
    return [];
  }
}

export async function readFile(path: string): Promise<string> {
  return await invoke<string>('read_file', { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return await invoke<void>('write_file', { path, content });
}

// ── PTY ──────────────────────────────────────────────────────────

export async function ptySpawn(ptyId: string, shell: string, cwd: string, cols: number, rows: number): Promise<void> {
  return await invoke<void>('pty_spawn', { ptyId, shell, cwd, cols, rows });
}

export async function ptyWrite(ptyId: string, data: string): Promise<void> {
  return await invoke<void>('pty_write', { ptyId, data });
}

export async function ptyResize(ptyId: string, cols: number, rows: number): Promise<void> {
  return await invoke<void>('pty_resize', { ptyId, cols, rows });
}

export async function ptyKill(ptyId: string): Promise<void> {
  return await invoke<void>('pty_kill', { ptyId });
}

// ── Ports & Shell ────────────────────────────────────────────────

export async function scanPorts(): Promise<PortEntry[]> {
  try {
    return await invoke<PortEntry[]>('scan_ports');
  } catch (error) {
    console.error('IPC scanPorts error:', error);
    return [];
  }
}

export async function detectShells(): Promise<ShellInfo[]> {
  try {
    return await invoke<ShellInfo[]>('detect_shells');
  } catch (error) {
    console.error('IPC detectShells error:', error);
    return [];
  }
}

// ── State Persistence ────────────────────────────────────────────

export async function loadState(): Promise<AppState> {
  return await invoke<AppState>('load_state');
}

export async function saveState(state: AppState): Promise<void> {
  return await invoke<void>('save_state', { state });
}

// ── Git / Source Control ──────────────────────────────────────────

export async function gitStatus(path: string): Promise<GitStatusResult> {
  return await invoke<GitStatusResult>('git_status', { path });
}

export async function gitStage(path: string, filePath: string): Promise<void> {
  return await invoke<void>('git_stage', { path, filePath });
}

export async function gitUnstage(path: string, filePath: string): Promise<void> {
  return await invoke<void>('git_unstage', { path, filePath });
}

export async function gitStageAll(path: string): Promise<void> {
  return await invoke<void>('git_stage_all', { path });
}

export async function gitUnstageAll(path: string): Promise<void> {
  return await invoke<void>('git_unstage_all', { path });
}

export async function gitCommit(path: string, message: string): Promise<void> {
  return await invoke<void>('git_commit', { path, message });
}

export async function gitPush(path: string): Promise<void> {
  return await invoke<void>('git_push', { path });
}

export async function gitPull(path: string): Promise<void> {
  return await invoke<void>('git_pull', { path });
}

export async function gitFetch(path: string): Promise<void> {
  return await invoke<void>('git_fetch', { path });
}

export async function gitShowFile(path: string, filePath: string, gitRef?: string): Promise<string> {
  return await invoke<string>('git_show_file', { path, filePath, gitRef });
}

export async function gitDiscardFile(path: string, filePath: string): Promise<void> {
  return await invoke<void>('git_discard_file', { path, filePath });
}

// ── Updater ──────────────────────────────────────────────────────

export async function checkUpdate(): Promise<{ available: boolean; version: string; body?: string; error?: string }> {
  try {
    const update = await check();
    if (update) {
      return { available: true, version: update.version, body: update.body || undefined };
    }
    return { available: false, version: '' };
  } catch (err) {
    const msg = String(err);
    if (import.meta.env.DEV) {
      return { available: false, version: '', error: 'DEV_MODE' };
    }
    return { available: false, version: '', error: msg };
  }
}

export async function installUpdate(): Promise<void> {
  try {
    const update = await check();
    if (update) {
      await update.downloadAndInstall();
    }
  } catch (err) {
    console.error('Install update failed:', err);
    throw err;
  }
}

export async function createFile(path: string): Promise<void> {
  return await invoke<void>('create_file', { path });
}

export async function createDir(path: string): Promise<void> {
  return await invoke<void>('create_dir', { path });
}

export async function searchFiles(path: string, query: string): Promise<FileEntry[]> {
  try {
    return await invoke<FileEntry[]>('search_files', { path, query });
  } catch (error) {
    console.error('IPC searchFiles error:', error);
    return [];
  }
}

