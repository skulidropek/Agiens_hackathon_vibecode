import React, { useState, useEffect, useMemo } from 'react';
import type { FileInfo } from '../types';
import styles from './FileExplorer.module.css';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  fileInfo?: FileInfo;
  isExpanded?: boolean;
}

interface FileExplorerProps {
  files: Map<string, FileInfo>;
  onFileSelect: (filePath: string) => void;
  selectedFile?: string;
  onFileCreate?: (parentPath: string, fileName: string, isDirectory: boolean) => void;
  onFileDelete?: (filePath: string) => void;
  onFileRename?: (oldPath: string, newPath: string) => void;
  fillHeight?: boolean;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  selectedFile,
  onFileCreate,
  onFileDelete,
  onFileRename,
  fillHeight = true,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    filePath: string;
    isDirectory: boolean;
  } | null>(null);

  // Строим дерево файлов из плоского списка
  const fileTree = useMemo(() => {
    const root: FileTreeNode = {
      name: 'root',
      path: '',
      type: 'directory',
      children: []
    };

    const pathMap = new Map<string, FileTreeNode>();
    pathMap.set('', root);

    // Сортируем файлы по пути для правильного построения дерева
    const sortedFiles = Array.from(files.entries()).sort(([a], [b]) => a.localeCompare(b));

    for (const [path, fileInfo] of sortedFiles) {
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';
      let currentNode = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        let node = pathMap.get(currentPath);
        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isLast ? fileInfo.type : 'directory',
            children: fileInfo.type === 'directory' || !isLast ? [] : undefined,
            fileInfo: isLast ? fileInfo : undefined
          };
          pathMap.set(currentPath, node);
          
          if (!currentNode.children) {
            currentNode.children = [];
          }
          currentNode.children.push(node);
        }

        currentNode = node;
      }
    }

    // Сортируем дочерние элементы: сначала папки, потом файлы
    const sortChildren = (node: FileTreeNode) => {
      if (node.children) {
        node.children.sort((a, b) => {
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortChildren);
      }
    };

    sortChildren(root);
    return root.children || [];
  }, [files]);

  const toggleExpanded = (path: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, filePath: string, isDirectory: boolean) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      filePath,
      isDirectory
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleFileCreate = (parentPath: string, isDirectory: boolean) => {
    const fileName = prompt(`Enter ${isDirectory ? 'directory' : 'file'} name:`);
    if (fileName && onFileCreate) {
      onFileCreate(parentPath, fileName, isDirectory);
    }
    handleContextMenuClose();
  };

  const handleFileDelete = (filePath: string) => {
    if (confirm(`Are you sure you want to delete ${filePath}?`)) {
      onFileDelete?.(filePath);
    }
    handleContextMenuClose();
  };

  const handleFileRename = (filePath: string) => {
    const newName = prompt('Enter new name:', filePath.split('/').pop());
    if (newName && onFileRename) {
      const parentPath = filePath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      onFileRename(filePath, newPath);
    }
    handleContextMenuClose();
  };

  const renderFileNode = (node: FileTreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedFile === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path} className={styles.fileNode}>
        <div
          className={`${styles.fileItem} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpanded(node.path);
            } else {
              onFileSelect(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path, node.type === 'directory')}
        >
          {node.type === 'directory' && (
            <span className={styles.expandIcon}>
              {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
            </span>
          )}
          
          <span className={styles.fileIcon}>
            {node.type === 'directory' ? '📁' : getFileIcon(node.name)}
          </span>
          
          <span className={styles.fileName}>{node.name}</span>
          
          {node.fileInfo && node.type === 'file' && (
            <span className={styles.fileSize}>
              {formatFileSize(node.fileInfo.size)}
            </span>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div className={styles.children}>
            {node.children.map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
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
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return '🖼️';
      default:
        return '📄';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Закрываем контекстное меню при клике вне его
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  return (
    <div
      className={styles.fileExplorer}
      style={fillHeight ? undefined : { height: 'auto', maxHeight: '40vh' }}
    >
      <div className={styles.header}>
        <h3>Files</h3>
        <button 
          className={styles.refreshButton}
          onClick={() => window.location.reload()}
          title="Refresh"
        >
          🔄
        </button>
      </div>

      <div className={styles.fileTree}>
        {fileTree.map(node => renderFileNode(node))}
      </div>

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          {contextMenu.isDirectory && (
            <>
              <button onClick={() => handleFileCreate(contextMenu.filePath, false)}>
                New File
              </button>
              <button onClick={() => handleFileCreate(contextMenu.filePath, true)}>
                New Directory
              </button>
            </>
          )}
          <button onClick={() => handleFileRename(contextMenu.filePath)}>
            Rename
          </button>
          <button onClick={() => handleFileDelete(contextMenu.filePath)}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}; 