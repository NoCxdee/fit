/* ================================================================
   Fit — CodeEditor Component
   Real CodeMirror 6 integration with Tauri IPC for I/O.
   ================================================================ */

import { useEffect, useRef, useState } from 'react';
export const unsavedContents = new Map<string, string>();
import { useAppState, useAppDispatch } from '../../stores/appStore';
import { readFile, writeFile, gitStatus } from '../../utils/ipc';
import { convertFileSrc } from '@tauri-apps/api/core';

// CodeMirror
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, highlightActiveLine, lineNumbers, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit, syntaxHighlighting, HighlightStyle, foldGutter } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Languages
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { python } from '@codemirror/lang-python';

const fitHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#c75ae4', fontWeight: 'bold' },
  { tag: t.controlKeyword, color: '#c75ae4', fontWeight: 'bold' },
  { tag: t.operator, color: '#c75ae4' },
  { tag: t.className, color: '#d29c22' },
  { tag: t.typeName, color: '#e06c75' },
  { tag: t.tagName, color: '#e06c75' },
  { tag: t.attributeName, color: '#c75ae4' },
  { tag: t.macroName, color: '#c75ae4' },
  { tag: t.variableName, color: '#dad2c1' },
  { tag: t.definition(t.variableName), color: '#dad2c1' },
  { tag: t.propertyName, color: '#3ba8e3' },
  { tag: [t.string, t.special(t.string)], color: '#d48a60' },
  { tag: t.number, color: '#d48a60' },
  { tag: t.bool, color: '#d48a60' },
  { tag: t.null, color: '#d48a60' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#75715e', fontStyle: 'italic' },
  { tag: t.modifier, color: '#c75ae4' },
  { tag: t.function(t.variableName), color: '#3ba8e3' },
  { tag: t.definition(t.propertyName), color: '#3ba8e3' },
  { tag: t.heading, color: '#dad2c1', fontWeight: 'bold' },
  { tag: t.punctuation, color: '#dad2c1' },
]);

interface CodeEditorProps {
  filePath: string;
  fileName: string;
  tabId: string;
}

export function CodeEditor({ filePath, fileName, tabId }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { activeWorkspaceId, workspaces, activeTabId, autoSave } = useAppState();
  const autoSaveRef = useRef(autoSave);
  const autoSaveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    autoSaveRef.current = autoSave;
  }, [autoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isImage, setIsImage] = useState(false);


  // Load content from file system
  const originalContentRef = useRef<string>('');

  useEffect(() => {
    let isMounted = true;

    // Detect image file extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg', 'tiff', 'tif', 'avif', 'apng'];
    if (ext && imageExtensions.includes(ext)) {
      if (isMounted) {
        setIsImage(true);
        setLoading(false);
      }
      return;
    }

    setIsImage(false);
    setLoading(true);
    setError(null);
    setContent(null);

    readFile(filePath)
      .then(text => {
        if (isMounted) {
          originalContentRef.current = text;
          setContent(text);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [filePath, fileName]);

  // Handle local dictation text insertion
  useEffect(() => {
    const handleInsert = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      if (viewRef.current && viewRef.current.hasFocus && customEvent.detail && customEvent.detail.text) {
        const view = viewRef.current;
        const mainSelection = view.state.selection.main;
        const textToInsert = customEvent.detail.text;

        view.dispatch({
          changes: {
            from: mainSelection.from,
            to: mainSelection.to,
            insert: textToInsert,
          },
          selection: { anchor: mainSelection.from + textToInsert.length },
          userEvent: 'input.type',
        });
        view.focus();
        customEvent.preventDefault();
      }
    };

    window.addEventListener('fit-dictation-insert', handleInsert);
    return () => {
      window.removeEventListener('fit-dictation-insert', handleInsert);
    };
  }, []);

  // Initialize CodeMirror editor when ref and content are ready
  useEffect(() => {
    if (!loading && content !== null && containerRef.current) {
      initEditor(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, content, filePath]);

  const initEditor = (initialContent: string) => {
    if (!containerRef.current) return;
    if (viewRef.current) viewRef.current.destroy();

    // Determine language extensions
    const ext = fileName.split('.').pop()?.toLowerCase();
    const languageExt = (() => {
      switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
        case 'mjs':
        case 'cjs':
          return javascript({ jsx: true, typescript: ext.includes('ts') });
        case 'html':
        case 'htm':
          return html();
        case 'css':
        case 'scss':
        case 'less':
          return css();
        case 'json':
          return json();
        case 'md':
        case 'mdx':
          return markdown();
        case 'rs':
          return rust();
        case 'py':
          return python();
        default:
          return [];
      }
    })();

    // Simple warm dark theme based on DESIGN.md
    const fitTheme = EditorView.theme({
      '&': {
        color: 'var(--color-primary)',
        backgroundColor: 'var(--color-canvas)',
        height: '100%',
        fontSize: '13px',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        lineHeight: '1.6',
      },
      '.cm-content': {
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        caretColor: 'var(--color-accent)',
        padding: 'var(--space-md) 0',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--color-accent)',
        borderLeftWidth: '2px',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
        backgroundColor: 'rgba(212, 168, 87, 0.2)',
      },
      '.cm-panels': {
        backgroundColor: 'var(--color-canvas-soft)',
        color: 'var(--color-primary)',
      },
      '.cm-panels.cm-panels-top': { borderBottom: '2px solid black' },
      '.cm-panels.cm-panels-bottom': { borderTop: '2px solid black' },
      '.cm-searchMatch': {
        backgroundColor: '#72a1ff59',
        outline: '1px solid #457dff',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: '#6199ff2f',
      },
      '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.03)' },
      '.cm-selectionMatch': { backgroundColor: '#aafe661a' },
      '&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket': {
        backgroundColor: '#bad0f847',
      },
      '.cm-gutters': {
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        backgroundColor: 'var(--color-canvas)',
        color: 'var(--color-mute)',
        border: 'none',
        paddingRight: 'var(--space-sm)',
        paddingLeft: 'var(--space-xs)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        color: 'var(--color-primary)',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'transparent',
        border: 'none',
        color: 'var(--color-mute)',
      },
      '.cm-tooltip': {
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-canvas-soft)',
      },
      '.cm-tooltip .cm-tooltip-arrow:before': {
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
      },
      '.cm-tooltip .cm-tooltip-arrow:after': {
        borderTopColor: 'var(--color-canvas-soft)',
        borderBottomColor: 'var(--color-canvas-soft)',
      },
    }, { dark: true });

    // Handle Ctrl+S
    const saveCommand = (view: EditorView) => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      const content = view.state.doc.toString();
      writeFile(filePath, content)
        .then(() => {
          originalContentRef.current = content;
          unsavedContents.delete(filePath);
          dispatch({
            type: 'SET_TAB_MODIFIED',
            payload: { tabId: tabId, isModified: false }
          });
          const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
          if (activeWorkspace) {
            gitStatus(activeWorkspace.path)
              .then(res => {
                dispatch({ type: 'SET_GIT_STATUS', payload: res });
              })
              .catch(err => console.error('Failed to update git status after save:', err));
          }
        })
        .catch(err => console.error('Failed to save file:', err));
      return true;
    };

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        history(),
        indentUnit.of('  '),
        syntaxHighlighting(fitHighlightStyle),
        fitTheme,
        languageExt,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
          { key: 'Mod-s', run: saveCommand }
        ]),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const currentContent = update.state.doc.toString();
            const isChanged = currentContent !== originalContentRef.current;
            if (isChanged) {
              unsavedContents.set(filePath, currentContent);
            } else {
              unsavedContents.delete(filePath);
            }
            dispatch({
              type: 'SET_TAB_MODIFIED',
              payload: { tabId: tabId, isModified: isChanged }
            });

            // Debounced autosave
            if (autoSaveRef.current && isChanged) {
              if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
              }
              autoSaveTimeoutRef.current = setTimeout(() => {
                writeFile(filePath, currentContent)
                  .then(() => {
                    originalContentRef.current = currentContent;
                    unsavedContents.delete(filePath);
                    dispatch({
                      type: 'SET_TAB_MODIFIED',
                      payload: { tabId: tabId, isModified: false }
                    });
                    const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
                    if (activeWorkspace) {
                      gitStatus(activeWorkspace.path)
                        .then(res => {
                          dispatch({ type: 'SET_GIT_STATUS', payload: res });
                        })
                        .catch(err => console.error('Failed to update git status after autosave:', err));
                    }
                  })
                  .catch(err => console.error('Autosave failed:', err));
              }, 1000);
            }
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
  };

  if (isImage) {
    return (
      <div className="editor-container" style={{ alignItems: 'center', justifyContent: 'center', padding: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', maxWidth: '100%', maxHeight: '100%' }}>
          <img 
            src={convertFileSrc(filePath)} 
            alt={fileName} 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '70vh', 
              objectFit: 'contain', 
              borderRadius: 'var(--radius-md)', 
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              border: '1px solid var(--color-hairline)'
            }} 
          />
          <div style={{ color: 'var(--color-mute)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)', textAlign: 'center' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--color-ink)' }}>{fileName}</span>
            <div style={{ fontSize: 'var(--text-caption)', marginTop: '4px' }}>{filePath}</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="editor-container" style={{ padding: 'var(--space-xl)', color: 'var(--color-mute)' }}>
        Loading {fileName}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-container" style={{ padding: 'var(--space-xl)' }}>
        <p style={{ color: 'var(--color-danger)' }}>Failed to load {fileName}</p>
        <p style={{ color: 'var(--color-mute)', fontSize: 'var(--text-caption)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="editor-container" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }} />
    </div>
  );
}
