import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SessionListPage from "./components/SessionListPage";
import ChatPage from "./components/ChatPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="codex-root">
        <Routes>
          <Route path="/" element={<SessionListPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
