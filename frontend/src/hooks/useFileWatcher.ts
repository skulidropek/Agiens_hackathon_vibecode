import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FileInfo, WebSocketMessage } from '../types';
import type { FileContentApiResponse } from '../types/api';
import { Api } from '../api/Api';
import { useWebSocket } from './useWebSocket';

export interface FileWatcherState {
  isConnected: boolean;
  isWatching: boolean;
  files: Map<string, FileInfo>;
  error: string | null;
}

export interface UseFileWatcherReturn {
  state: FileWatcherState;
  actions: {
    startWatching: (projectId: string) => void;
    stopWatching: (projectId: string) => void;
    getFileContent: (filePath: string, projectId: string) => Promise<string>;
    saveFileContent: (filePath: string, content: string) => Promise<void>;
    createFile: (filePath: string, isDirectory: boolean) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    renameFile: (oldPath: string, newPath: string, projectId: string) => Promise<void>;
  };
}

const apiClient = new Api();

export const useFileWatcher = (): UseFileWatcherReturn => {
  const { isConnected, client, subscribe } = useWebSocket();
  const [state, setState] = useState<FileWatcherState>({
    isConnected: false,
    isWatching: false,
    files: new Map(),
    error: null,
  });

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log('🛎️ useFileWatcher: Received WebSocket message', message, new Date().toISOString());
    if (message.type === 'connection_established') {
      setState((prev) => {
        const newState = { ...prev, isConnected: true, error: null };
        console.log('🔄 useFileWatcher: State updated after connection_established', newState, new Date().toISOString());
        return newState;
      });
      return;
    }

    if (message.type === 'file_watch_started') {
      setState((prev) => {
        const newState = { ...prev, isWatching: true, error: null };
        console.log('👁️ useFileWatcher: State updated after file_watch_started', newState, new Date().toISOString());
        return newState;
      });
      return;
    }

    if (message.type === 'error') {
      setState((prev) => {
        const newState = { ...prev, error: message.message };
        console.log('❗ useFileWatcher: State updated after error message', newState, new Date().toISOString());
        return newState;
      });
      return;
    }

    if (message.type !== 'file_event') {
      console.log('ℹ️ useFileWatcher: Ignoring unsupported message type', message);
      return;
    }
    
    setState((prev) => {
      const newFiles = new Map(prev.files);
      const { eventType, filePath, data } = message;

      console.log('🗂️ useFileWatcher: Processing file_event', { eventType, filePath }, new Date().toISOString());

      switch (eventType) {
        case 'watcher_ready':
          console.log('✅ useFileWatcher: Watcher ready, setting isWatching true');
          return { ...prev, isWatching: true }; // Не очищаем файлы, сервер отправит актуальные
        
        case 'file_created':
        case 'file_modified':
          if (data.fileInfo) {
            newFiles.set(filePath, data.fileInfo);
          }
          break;
        
        case 'file_deleted':
          newFiles.delete(filePath);
          break;

        case 'directory_created':
           if (data.fileInfo) {
            newFiles.set(filePath, data.fileInfo);
          }
          break;

        case 'directory_deleted':
          // Удаляем саму директорию и все вложенные файлы/папки
          newFiles.delete(filePath);
          for (const key of newFiles.keys()) {
            if (key.startsWith(`${filePath}/`)) {
              newFiles.delete(key);
            }
          }
          break;
        
        case 'file_error':
          console.log('⚠️ useFileWatcher: file_error event received', data.error);
          return { ...prev, error: data.error || 'Unknown file error' };
      }
      const newState = { ...prev, files: newFiles };
      console.log('📂 useFileWatcher: State updated after file_event', newState, new Date().toISOString());
      return newState;
    });
  }, []);

  // Subscribe to WebSocket messages
  useEffect(() => {
    console.log('📡 useFileWatcher: Subscribing to WebSocket messages', new Date().toISOString());
    const unsubscribe = subscribe(handleWebSocketMessage);
    return () => {
      console.log('📡 useFileWatcher: Unsubscribing from WebSocket messages', new Date().toISOString());
      unsubscribe();
    };
  }, [subscribe, handleWebSocketMessage]);

  // Update state when connection status changes
  useEffect(() => {
    console.log('🔗 useFileWatcher: Connection status changed:', isConnected, new Date().toISOString());
    setState(prev => ({ ...prev, isConnected }));
  }, [isConnected]);

  const startWatching = useCallback((projectId: string) => {
    console.log('👀 useFileWatcher: Starting to watch project:', projectId, new Date().toISOString());
    client.startWatching(projectId);
  }, [client]);

  const stopWatching = useCallback((projectId: string) => {
    client.stopWatching(projectId);
    setState(prev => ({...prev, isWatching: false}));
  }, [client]);

  const getFileContent = useCallback(async (filePath: string, projectId: string): Promise<string> => {
    if (!projectId) {
      const error = new Error('Project ID is required to get file content');
      console.error(error);
      throw error;
    }

    try {
      console.log('Fetching file content for:', filePath, 'in project:', projectId);
      
      const response = await apiClient.filesProjectDetail2(projectId, filePath);
      
      console.log('API response:', response.data);
      
      const responseData = response.data as FileContentApiResponse;

      if (responseData.success && responseData.data) {
        const fileContent = responseData.data;
        if (typeof fileContent.content === 'string') {
          console.log('Successfully loaded file content, length:', fileContent.content.length);
          return fileContent.content;
        } else {
          const errorMsg = `Invalid file content type: ${typeof fileContent.content}`;
          console.error(errorMsg, fileContent.content);
          throw new Error(errorMsg);
        }
      }
      
      const errorMessage = `API call failed: success=${responseData.success}, data=${JSON.stringify(responseData.data)}`;
      console.error(errorMessage);
      throw new Error(errorMessage);

    } catch (error) {
      console.error(`Error getting content for file "${filePath}" in project "${projectId}":`, error);
      throw error;
    }
  }, []);

  const saveFileContent = useCallback(async (filePath: string, content: string): Promise<void> => {
    // Сохранение может идти и через WebSocket для real-time, и через REST для надежности.
    // wsClientRef.current?.saveFileContent(filePath, content);
     try {
      await apiClient.filesCreate(filePath, { content });
    } catch (error) {
      console.error('Error saving file content via API:', error);
      throw error;
    }
  }, []);
  
  const createFile = useCallback(async (filePath: string, isDirectory: boolean): Promise<void> => {
    try {
      // Создание файла или папки через API
      await apiClient.filesCreate(filePath, { content: isDirectory ? undefined : '' });
    } catch (error) {
      console.error('Error creating file/directory via API:', error);
      throw error;
    }
  }, []);
  
  const deleteFile = useCallback(async (filePath: string): Promise<void> => {
     try {
      await apiClient.filesDelete(filePath);
    } catch (error) {
      console.error('Error deleting file/directory via API:', error);
      throw error;
    }
  }, []);
  
  const renameFile = useCallback(async (oldPath: string, newPath: string, projectId: string): Promise<void> => {
    // В текущем API нет эндпоинта для переименования, нужна имплементация
    // Можно симулировать через get -> create -> delete
    try {
      const content = await getFileContent(oldPath, projectId);
      await createFile(newPath, false);
      await saveFileContent(newPath, content);
      await deleteFile(oldPath);
    } catch (error) {
       console.error(`Error renaming file from ${oldPath} to ${newPath}:`, error);
       throw error;
    }
  }, [getFileContent, createFile, saveFileContent, deleteFile]);

  const actions = useMemo(() => ({
    startWatching,
    stopWatching,
    getFileContent,
    saveFileContent,
    createFile,
    deleteFile,
    renameFile
  }), [startWatching, stopWatching, getFileContent, saveFileContent, createFile, deleteFile, renameFile]);

  return { state, actions };
}; 