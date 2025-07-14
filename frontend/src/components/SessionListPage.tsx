import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Api } from "../api/Api";
import styles from "./SessionListPage.module.css";

// Тип Session (минимальный для списка)
type Session = {
  id: string;
  title?: string;
  isActive?: boolean;
  lastActivity?: string;
};

// Тип для передачи query-параметров в chatSessionsList
interface ChatSessionsListParams {
  query: { projectId: string };
}

const SessionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState<boolean>(false);
  const [sessionsError, setSessionsError] = useState<string>("");

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      setError("");
      try {
        const api = new Api();
        const res = await api.projectsList();
        const list = res.data?.projects || [];
        setProjects(list);
        if (list.length > 0) setSelectedProject(list[0].id);
      } catch {
        setError("Ошибка загрузки проектов");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;
    setSessionsLoading(true);
    setSessionsError("");
    const fetchSessions = async () => {
      try {
        const api = new Api();
        const params: ChatSessionsListParams = { query: { projectId: selectedProject } };
        const res = await api.chatSessionsList(params as unknown as Parameters<typeof api.chatSessionsList>[0]);
        let json: { data?: Session[] } | undefined;
        if (typeof res.json === 'function') {
          json = await res.json();
        } else {
          json = res as { data?: Session[] };
        }
        const sessionsArr = json?.data;
        setSessions(Array.isArray(sessionsArr) ? sessionsArr : []);
      } catch {
        setSessionsError("Ошибка загрузки сессий");
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [selectedProject]);

  return (
    <div className={styles.codexMain}>
      <header className={styles.codexAppbar}>
        <div className={styles.codexLogo}>Codex</div>
        <nav className={styles.codexNav}>
          <a href="#" className={styles.codexNavLink}>Environments</a>
          <a href="#" className={styles.codexNavLink}>Docs</a>
        </nav>
        <div className={styles.codexAvatar}>●</div>
      </header>
      <h1 className={styles.codexTitle}>What are we coding next?</h1>
      <div className={styles.wFullMaxWMD}>
        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="project-select">
          Project
        </label>
        {loading ? (
          <div className="mb-6 text-gray-400">Загрузка проектов...</div>
        ) : error ? (
          <div className="mb-6 text-red-500">{error}</div>
        ) : (
          <select
            id="project-select"
            className={styles.mb6}
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <form className={styles.codexTaskForm}>
          <textarea
            className={styles.codexTaskInput}
            placeholder="Describe a task or chat"
            rows={3}
          />
          <div className={styles.codexTaskFormActions}>
            <button type="button" className={styles.codexBtn}>Ask</button>
            <button type="submit" className={styles.codexBtn}>Code</button>
            <button 
              type="button" 
              className={styles.codexBtn}
              onClick={() => navigate(`/workspace/${selectedProject}`)}
              disabled={!selectedProject}
            >
              Workspace
            </button>
          </div>
        </form>
      </div>
      <section className={styles.codexTaskListSection}>
        <h2 className={styles.codexTaskListTitle}>Sessions</h2>
        <div className={styles.codexTaskList}>
          {sessionsLoading ? (
            <div className="text-gray-400">Загрузка сессий...</div>
          ) : sessionsError ? (
            <div className="text-red-500">{sessionsError}</div>
          ) : sessions.length === 0 ? (
            <div className="text-gray-400">Нет сессий</div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={styles.codexTaskCard}
                onClick={() => navigate(`/chat/${s.id}`, { state: { projectId: selectedProject } })}
              >
                {s.title || s.id}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default SessionListPage; 