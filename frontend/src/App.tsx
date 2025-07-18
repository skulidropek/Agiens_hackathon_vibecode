import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SessionListPage from "./components/SessionListPage";
import ChatPage from "./components/ChatPage";
import { ProjectWorkspacePage } from "./components/ProjectWorkspacePage";
import { WebSocketProvider } from "./contexts/WebSocketProvider";
import { TerminalWebSocketProvider } from "./contexts/TerminalWebSocketProvider";

function App() {
  return (
    <WebSocketProvider>
      <TerminalWebSocketProvider>
        <Router>
          <div className="codex-root">
            <Routes>
              <Route path="/" element={<SessionListPage />} />
              <Route path="/chat/:sessionId" element={<ChatPage />} />
              <Route path="/workspace/:projectId" element={<ProjectWorkspacePage />} />
            </Routes>
          </div>
        </Router>
      </TerminalWebSocketProvider>
    </WebSocketProvider>
  );
}

export default App;
