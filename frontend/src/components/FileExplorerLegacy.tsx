import React, { useEffect, useState } from "react";
import { Api } from "../api/Api";

interface FileApiItem {
  path: string;
  isDir: boolean;
}

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
}

// Внутренний тип для построения дерева
interface FileNodeInternal {
  name: string;
  path: string;
  isDir: boolean;
  children: { [key: string]: FileNodeInternal };
}

interface FileExplorerProps {
  projectId: string;
  onFileSelect: (filePath: string) => void;
}

const treeStyle: React.CSSProperties = {
  fontFamily: 'Fira Mono, Menlo, Monaco, monospace',
  fontSize: 15,
  color: '#fff',
  background: 'none',
  padding: 0,
  margin: 0,
  listStyle: 'none',
};
const dirStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#38bdf8',
  cursor: 'pointer',
  margin: '2px 0',
};
const fileStyle: React.CSSProperties = {
  color: '#fff',
  cursor: 'pointer',
  margin: '2px 0',
};

function buildTree(files: FileApiItem[]): FileNode[] {
  const root: { [key: string]: FileNodeInternal } = {};
  for (const file of files) {
    const parts = file.path.split("/");
    let curr: { [key: string]: FileNodeInternal } = root;
    let currPath = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currPath = currPath ? currPath + "/" + part : part;
      if (!curr[part]) {
        curr[part] = {
          name: part,
          path: currPath,
          isDir: i < parts.length - 1 || file.isDir,
          children: {},
        };
      }
      if (i === parts.length - 1) {
        curr[part].isDir = file.isDir;
      }
      curr = curr[part].children;
    }
  }
  function toArray(obj: { [key: string]: FileNodeInternal }): FileNode[] {
    return Object.values(obj).map((node) => {
      let children: FileNode[] | undefined = undefined;
      if (node.isDir && node.children && Object.keys(node.children).length > 0) {
        children = toArray(node.children);
      }
      return {
        name: node.name,
        path: node.path,
        isDir: node.isDir,
        children,
      };
    });
  }
  return toArray(root);
}

export const FileExplorerLegacy: React.FC<FileExplorerProps> = ({ projectId, onFileSelect }) => {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [expanded, setExpanded] = useState<{ [path: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    const fetchFiles = async () => {
      try {
        const api = new Api();
        const res = await api.filesProjectDetail(projectId, { recursive: true });
        const files: FileApiItem[] = Array.isArray(res.data) ? res.data : [];
        setTree(buildTree(files));
      } catch {
        setError("Ошибка загрузки файлов");
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [projectId]);

  const toggleDir = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const renderTree = (nodes: FileNode[]) => (
    <ul style={treeStyle}>
      {nodes.map((node) => (
        <li key={node.path}>
          {node.isDir ? (
            <div style={dirStyle} onClick={() => toggleDir(node.path)}>
              {expanded[node.path] ? "▼" : "▶"} {node.name}
            </div>
          ) : (
            <div style={fileStyle} onClick={() => onFileSelect(node.path)}>
              {node.name}
            </div>
          )}
          {node.isDir && expanded[node.path] && node.children && renderTree(node.children)}
        </li>
      ))}
    </ul>
  );

  if (loading) return <div style={{ color: '#38bdf8', padding: 18 }}>Загрузка файлов...</div>;
  if (error) return <div style={{ color: '#f87171', padding: 18 }}>{error}</div>;
  return <div style={{ padding: 18 }}>{renderTree(tree)}</div>;
}; 