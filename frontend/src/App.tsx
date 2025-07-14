import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SessionListPage from "./components/SessionListPage";
import ChatPage from "./components/ChatPage";
import { ProjectWorkspacePage } from "./components/ProjectWorkspacePage";
import { WebSocketProvider } from "./contexts/WebSocketProvider";

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <div className="codex-root">
          <Routes>
            <Route path="/" element={<SessionListPage />} />
            <Route path="/chat/:sessionId" element={<ChatPage />} />
            <Route path="/workspace/:projectId" element={<ProjectWorkspacePage />} />
          </Routes>
        </div>
      </Router>
    </WebSocketProvider>
  );
}

export default App;
