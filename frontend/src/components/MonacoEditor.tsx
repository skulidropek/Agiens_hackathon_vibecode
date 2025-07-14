import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@monaco-editor/react';
import styles from './MonacoEditor.module.css';

interface MonacoEditorProps {
  filePath?: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => void;
  language?: string;
  readOnly?: boolean;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  filePath,
  content,
  onContentChange,
  onSave,
  language,
  readOnly = false
}) => {
  const editorRef = useRef<{ getValue: () => string; setValue: (value: string) => void; getPosition: () => unknown; setPosition: (position: unknown) => void; getAction: (id: string) => { run: () => void } | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Определяем язык по расширению файла
  const getLanguageFromPath = useCallback((path: string): string => {
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'css':
        return 'css';
      case 'scss':
      case 'sass':
        return 'scss';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'php':
        return 'php';
      case 'rb':
        return 'ruby';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      case 'xml':
        return 'xml';
      case 'yml':
      case 'yaml':
        return 'yaml';
      case 'sql':
        return 'sql';
      case 'sh':
      case 'bash':
        return 'shell';
      default:
        return 'plaintext';
    }
  }, []);

  const effectiveLanguage = language || (filePath ? getLanguageFromPath(filePath) : 'plaintext');

  const handleEditorDidMount = useCallback((editor: { getValue: () => string; setValue: (value: string) => void; getPosition: () => unknown; setPosition: (position: unknown) => void; addCommand: (keybinding: number, handler: () => void) => void; getAction: (id: string) => { run: () => void } | null; onDidBlurEditorText: (callback: () => void) => void }) => {
    editorRef.current = editor;
    setIsLoading(false);

    // Настраиваем горячие клавиши (упрощенная версия)
    editor.addCommand(2097, () => { // Ctrl+S
      const currentContent = editor.getValue();
      onSave(currentContent);
      setHasUnsavedChanges(false);
    });

    // Настраиваем автосохранение при потере фокуса
    editor.onDidBlurEditorText(() => {
      if (hasUnsavedChanges) {
        const currentContent = editor.getValue();
        onSave(currentContent);
        setHasUnsavedChanges(false);
      }
    });
  }, [onSave, hasUnsavedChanges]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    const newContent = value || '';
    onContentChange(newContent);
    setHasUnsavedChanges(newContent !== content);
  }, [content, onContentChange]);

  // Обновляем содержимое редактора при изменении файла
  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.getValue()) {
      const editor = editorRef.current;
      const position = editor.getPosition();
      editor.setValue(content);
      if (position) {
        editor.setPosition(position);
      }
      setHasUnsavedChanges(false);
    }
  }, [content]);

  const handleSaveClick = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.getValue();
      onSave(currentContent);
      setHasUnsavedChanges(false);
    }
  };

  const handleFormatClick = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const getFileIcon = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return '📄';
      case 'ts':
      case 'tsx':
        return '📘';
      case 'css':
      case 'scss':
        return '🎨';
      case 'html':
        return '🌐';
      case 'json':
        return '📋';
      case 'md':
        return '📝';
      case 'py':
        return '🐍';
      case 'java':
        return '☕';
      case 'cpp':
      case 'c':
        return '⚙️';
      case 'php':
        return '🐘';
      case 'rb':
        return '💎';
      case 'go':
        return '🐹';
      case 'rs':
        return '🦀';
      default:
        return '📄';
    }
  };

  if (!filePath) {
    return (
      <div className={styles.noFileSelected}>
        <div className={styles.noFileIcon}>📁</div>
        <div className={styles.noFileText}>Select a file to edit</div>
      </div>
    );
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.editorHeader}>
        <div className={styles.fileInfo}>
          <span className={styles.fileIcon}>{getFileIcon(filePath)}</span>
          <span className={styles.fileName}>{filePath}</span>
          {hasUnsavedChanges && <span className={styles.unsavedIndicator}>●</span>}
        </div>
        
        <div className={styles.editorActions}>
          <button
            className={styles.actionButton}
            onClick={handleFormatClick}
            disabled={readOnly}
            title="Format Document (Shift+Alt+F)"
          >
            Format
          </button>
          <button
            className={`${styles.actionButton} ${styles.saveButton}`}
            onClick={handleSaveClick}
            disabled={readOnly || !hasUnsavedChanges}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>

      <div className={styles.editorWrapper}>
        {isLoading && (
          <div className={styles.loading}>
            <div className={styles.loadingSpinner}></div>
            <span>Loading editor...</span>
          </div>
        )}
        
        <Editor
          height="100%"
          language={effectiveLanguage}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            readOnly,
            minimap: { enabled: true },
            fontSize: 14,
            lineHeight: 20,
            fontFamily: 'Fira Code, Monaco, Menlo, monospace',
            fontLigatures: true,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            selectOnLineNumbers: true,
            matchBrackets: 'always',
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            unfoldOnClickAfterEndOfLine: false,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            trimAutoWhitespace: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            acceptSuggestionOnCommitCharacter: true,
            snippetSuggestions: 'top',
            emptySelectionClipboard: false,
            copyWithSyntaxHighlighting: true,
            multiCursorModifier: 'ctrlCmd',
            accessibilitySupport: 'auto',
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: 'never',
              seedSearchStringFromSelection: 'always'
            },
            hover: {
              enabled: true,
              delay: 300,
              sticky: true
            },
            parameterHints: {
              enabled: true,
              cycle: false
            },
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true
            }
          }}
        />
      </div>
    </div>
  );
}; 