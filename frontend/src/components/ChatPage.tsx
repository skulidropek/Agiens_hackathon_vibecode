import { useParams, useNavigate } from "react-router-dom";

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="codex-main">
      <header className="codex-appbar">
        <div className="codex-logo" onClick={() => navigate("/")} style={{cursor: 'pointer'}}>Codex</div>
        <nav className="codex-nav">
          <a href="#" className="codex-nav-link">Environments</a>
          <a href="#" className="codex-nav-link">Docs</a>
          <div className="codex-avatar">●</div>
        </nav>
      </header>
      <h1 className="codex-title">Session: {sessionId}</h1>
      <section className="codex-task-list-section">
        <h2 className="codex-task-list-title">Messages</h2>
        <div className="codex-task-list">
          {/* Здесь будет история сообщений */}
          <div className="codex-task-card">Demo message 1</div>
          <div className="codex-task-card">Demo message 2</div>
        </div>
      </section>
      <form className="codex-task-form" style={{marginTop: 32}}>
        <textarea
          className="codex-task-input"
          placeholder="Type your message..."
          rows={2}
        />
        <div className="codex-task-form-actions">
          <button type="submit" className="codex-btn codex-btn-primary">Send</button>
        </div>
      </form>
      <button className="codex-btn codex-btn-secondary" style={{marginTop: 24}} onClick={() => navigate("/")}>Back to sessions</button>
    </div>
  );
};

export default ChatPage; 