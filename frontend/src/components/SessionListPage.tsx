import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Api } from "../api/Api";

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
        console.log('Selected projectId:', selectedProject);
        const params: ChatSessionsListParams = { query: { projectId: selectedProject } };
        console.log('Request params:', params);
        const res = await api.chatSessionsList(params as unknown as Parameters<typeof api.chatSessionsList>[0]);
        let json: { data?: Session[] } | undefined;
        if (typeof res.json === 'function') {
          json = await res.json();
          console.log('Parsed JSON:', json);
        } else {
          console.log('API response:', res);
          json = res as { data?: Session[] };
        }
        const sessionsArr = json?.data;
        setSessions(Array.isArray(sessionsArr) ? sessionsArr : []);
      } catch (err) {
        console.error('API error:', err);
        setSessionsError("Ошибка загрузки сессий");
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [selectedProject]);

  return (
    <div className="codex-main flex flex-col items-center">
      <header className="codex-appbar w-full flex flex-col items-center mb-6">
        <div className="codex-logo text-2xl font-bold mb-1">Codex</div>
        <nav className="codex-nav flex gap-4 text-sm mb-2">
          <a href="#" className="codex-nav-link text-blue-700 hover:underline">Environments</a>
          <a href="#" className="codex-nav-link text-blue-700 hover:underline">Docs</a>
        </nav>
        <div className="codex-avatar text-2xl">●</div>
      </header>
      <h1 className="codex-title text-3xl font-bold mb-8">What are we coding next?</h1>
      <div className="w-full max-w-md flex flex-col items-center">
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
            className="mb-6 w-full rounded-lg border border-gray-300 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <form className="codex-task-form w-full bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-4 mb-8">
          <textarea
            className="codex-task-input w-full border border-gray-300 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
            placeholder="Describe a task or chat"
            rows={3}
          />
          <div className="codex-task-form-actions flex justify-end gap-2">
            <button type="button" className="codex-btn codex-btn-secondary bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-semibold hover:bg-gray-300">Ask</button>
            <button type="submit" className="codex-btn codex-btn-primary bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-800">Code</button>
          </div>
        </form>
      </div>
      <section className="codex-task-list-section w-full max-w-md">
        <h2 className="codex-task-list-title text-lg font-semibold text-gray-500 mb-4">Sessions</h2>
        <div className="codex-task-list flex flex-col gap-3">
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
                className="codex-task-card bg-white rounded-xl shadow p-4 font-medium cursor-pointer hover:bg-blue-50"
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