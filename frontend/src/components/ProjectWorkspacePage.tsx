import React, { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import SplitPanelLayout from "./SplitPanelLayout";
import SessionListPage from "./SessionListPage";
import FileExplorer from "./FileExplorer";
import FileViewer from "./FileViewer";
import { Api } from "../api/Api";

const ProjectWorkspacePage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = useCallback(async (filePath: string) => {
    setSelectedFile(filePath);
    setFileContent(undefined);
    setLoading(true);
    setError("");
    try {
      if (!projectId) return;
      const api = new Api();
      const res = await api.filesProjectDetail2(projectId, filePath);
      let content = "";
      if (Array.isArray(res.data)) {
        content = res.data.join("\n");
      } else if (typeof res.data === "string") {
        content = res.data;
      } else if (res.data && typeof res.data.data === "string") {
        content = res.data.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        content = res.data.data.join("\n");
      }
      setFileContent(content);
    } catch {
      setError("Ошибка загрузки файла");
      setFileContent(undefined);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const handleCloseViewer = useCallback(() => {
    setSelectedFile(null);
    setFileContent(undefined);
    setError("");
  }, []);

  return (
    <SplitPanelLayout
      left={<SessionListPage />}
      right={
        <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <FileExplorer projectId={projectId || ""} onFileSelect={handleFileSelect} />
          {selectedFile && (
            <div style={{ flex: 1, minHeight: 0, marginTop: 12, background: "#18181b", borderRadius: 10, boxShadow: "0 2px 12px 0 #0006" }}>
              <FileViewer
                filePath={selectedFile}
                content={loading ? undefined : fileContent}
                onClose={handleCloseViewer}
                inline
              />
              {error && <div style={{ color: '#f87171', padding: 18 }}>{error}</div>}
            </div>
          )}
        </div>
      }
    />
  );
};

export default ProjectWorkspacePage; 