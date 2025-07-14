import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FileExplorer } from './FileExplorer';
import { MonacoEditor } from './MonacoEditor';
import { TerminalPanel } from './TerminalPanel';
import { useFileWatcher } from '../hooks/useFileWatcher';
import styles from './ProjectWorkspacePage.module.css';

export const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTerminalVisible, setIsTerminalVisible] = useState(true);
  const { state: fileWatcherState, actions: fileWatcherActions } = useFileWatcher();

  // Инициализируем проект и запускаем file watcher
  useEffect(() => {
    if (projectId && fileWatcherState.isConnected) {
      console.log('Starting file watcher for project:', projectId);
      fileWatcherActions.startWatching(projectId);
    }

    return () => {
      if (projectId) {
        fileWatcherActions.stopWatching(projectId);
      }
    };
  }, [projectId, fileWatcherState.isConnected, fileWatcherActions]);

  // Обработка выбора файла
  const handleFileSelect = useCallback(async (filePath: string) => {
    if (!filePath || !projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('Loading file:', filePath);
      const content = await fileWatcherActions.getFileContent(filePath, projectId);
      setSelectedFile(filePath);
      setFileContent(content);
    } catch (err) {
      console.error('Error loading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setIsLoading(false);
    }
  }, [fileWatcherActions, projectId]);

  // Обработка изменения содержимого файла
  const handleContentChange = useCallback((content: string) => {
    setFileContent(content);
  }, []);

  // Обработка сохранения файла
  const handleSave = useCallback(async (content: string) => {
    if (!selectedFile) return;

    try {
      console.log('Saving file:', selectedFile);
      await fileWatcherActions.saveFileContent(selectedFile, content);
      setFileContent(content);
    } catch (err) {
      console.error('Error saving file:', err);
      setError(err instanceof Error ? err.message : 'Failed to save file');
    }
  }, [selectedFile, fileWatcherActions]);

  // Обработка создания файла
  const handleCreate = async (parentPath: string | null, fileName: string, isDirectory: boolean) => {
    try {
      const fullPath = parentPath ? `${parentPath}/${fileName}` : fileName;
      console.log('Creating item:', fullPath, 'isDirectory:', isDirectory);
      await fileWatcherActions.createFile(fullPath, isDirectory);
    } catch (err) {
      console.error('Failed to create item', err);
    }
  };

  // Обработка удаления файла
  const handleFileDelete = useCallback(async (filePath: string) => {
    if (window.confirm(`Are you sure you want to delete ${filePath}?`)) {
      try {
        await fileWatcherActions.deleteFile(filePath);
      } catch (err) {
        console.error('Error deleting item', err);
      }
    }
  }, [fileWatcherActions]);

  // Обработка переименования файла
  const handleFileRename = async (oldPath: string, newPath: string) => {
    if (!projectId) return;
    
    try {
      await fileWatcherActions.renameFile(oldPath, newPath, projectId);
    } catch (error) {
      console.error('Error renaming file:', error);
      setError(error instanceof Error ? error.message : 'Failed to rename file');
    }
  };

  if (!projectId) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>Project ID is required</div>
      </div>
    );
  }

  return (
    <div className={styles.workspacePage}>
      <div className={styles.header}>
        <h1 className={styles.title}>Project Workspace</h1>
        <div className={styles.connectionStatus}>
          <span className={`${styles.statusDot} ${fileWatcherState.isConnected ? styles.connected : styles.disconnected}`}></span>
          <span className={styles.statusText}>
            {fileWatcherState.isConnected ? 'Connected' : 'Disconnected'}
          </span>
          {fileWatcherState.isWatching && (
            <span className={styles.watchingText}>• Watching</span>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorText}>{error}</span>
          <button 
            className={styles.errorClose}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className={styles.workspaceContent}>
        <div className={styles.leftPanel}>
          <FileExplorer
            files={fileWatcherState.files}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onFileCreate={handleCreate}
            onFileDelete={handleFileDelete}
            onFileRename={handleFileRename}
          />
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.editorSection}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}></div>
                <span>Loading file...</span>
              </div>
            ) : (
              <MonacoEditor
                filePath={selectedFile}
                content={fileContent}
                onContentChange={handleContentChange}
                onSave={handleSave}
              />
            )}
          </div>
          
          <div className={styles.terminalSection}>
            <div className={styles.terminalToggle}>
              <button 
                className={styles.toggleButton}
                onClick={() => setIsTerminalVisible(!isTerminalVisible)}
              >
                {isTerminalVisible ? '⬇ Hide Terminal' : '⬆ Show Terminal'}
              </button>
            </div>
            {isTerminalVisible && projectId && (
              <TerminalPanel 
                projectId={projectId} 
                isVisible={isTerminalVisible}
              />
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.footerInfo}>
          <span>Files: {fileWatcherState.files.size}</span>
          <span>Project: {projectId}</span>
          {selectedFile && <span>Selected: {selectedFile}</span>}
        </div>
      </div>
    </div>
  );
}; 