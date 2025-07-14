# Terminal Interception System for Gemini CLI

This system provides comprehensive terminal session management and interception for gemini-cli, allowing you to monitor, control, and share terminal sessions across multiple frontend clients.

## 🏗️ Architecture Overview

```
Gemini CLI → PTY Wrapper → Backend Terminal Service → WebSocket → Frontend UI
```

### Components

1. **TerminalService** (`backend/src/services/terminal-service.ts`)
   - Manages PTY sessions using node-pty
   - Provides CRUD operations for terminal sessions
   - Handles session lifecycle and cleanup

2. **Terminal Routes** (`backend/src/routes/terminal-routes.ts`)
   - REST API for terminal session management
   - Endpoints: GET, POST, DELETE `/api/terminals`
   - Session statistics and filtering

3. **Terminal Handler** (`backend/src/websocket/terminal-handler.ts`)
   - WebSocket integration for real-time I/O
   - Broadcasts terminal output to multiple clients
   - Handles input forwarding and session subscription

4. **Gemini CLI Wrapper** (`gemini-cli-wrapper.js`)
   - Node.js script that intercepts gemini-cli commands
   - Routes terminal sessions through backend
   - Graceful fallback to direct execution

## 🚀 Setup and Installation

### 1. Backend Setup

The terminal system is already integrated into the existing backend. Ensure you have:

```bash
cd backend
npm install node-pty
npm install ws
npm install node-fetch
```

### 2. Start the Backend

```bash
cd backend
npm run dev
```

The backend will start with terminal services available at:
- REST API: `http://localhost:3000/api/terminals`
- WebSocket: `ws://localhost:3000/ws`

### 3. Install Gemini CLI Wrapper

```bash
# Make the wrapper executable
chmod +x gemini-cli-wrapper.js

# Install globally (optional)
npm install -g ./gemini-cli-wrapper.js

# Or create an alias
alias gcli="node /path/to/gemini-cli-wrapper.js"
```

### 4. Required Dependencies for Wrapper

```bash
npm install node-pty ws node-fetch
```

## 📖 Usage

### Basic Command Execution

```bash
# Run any command through the wrapper
./gemini-cli-wrapper.js bash
./gemini-cli-wrapper.js python3 script.py
./gemini-cli-wrapper.js npm run dev

# With alias
gcli bash
gcli "ls -la"
```

### Environment Variables

```bash
# Backend configuration
export BACKEND_URL="http://localhost:3000"
export WEBSOCKET_URL="ws://localhost:3000/ws"

# Project context (optional)
export PROJECT_ID="your-project-id"

# Run command with project context
gcli bash
```

### List Active Sessions

```bash
./gemini-cli-wrapper.js --list-sessions
```

Example output:
```
📋 Active Terminal Sessions:
  📺 abc123: bash (PID: 12345)
      Started: 2025-01-14 10:30:00
      Working Dir: /home/user/project

  📺 def456: python3 script.py (PID: 12346)
      Started: 2025-01-14 10:35:00
      Working Dir: /home/user/project
```

## 🔌 API Reference

### REST Endpoints

#### GET /api/terminals
Get all terminal sessions with optional filtering.

**Query Parameters:**
- `projectId` (string): Filter by project ID
- `active` (boolean): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-uuid",
      "command": "bash",
      "projectId": "project-uuid",
      "cwd": "/path/to/directory",
      "startTime": "2025-01-14T10:30:00Z",
      "lastActivity": "2025-01-14T10:35:00Z",
      "isActive": true,
      "pid": 12345
    }
  ],
  "timestamp": "2025-01-14T10:36:00Z"
}
```

#### POST /api/terminals
Create a new terminal session.

**Request Body:**
```json
{
  "command": "bash",
  "args": ["-c", "ls -la"],
  "cwd": "/path/to/directory",
  "projectId": "project-uuid",
  "env": {},
  "cols": 80,
  "rows": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-uuid",
    "command": "bash -c ls -la",
    "projectId": "project-uuid",
    "cwd": "/path/to/directory",
    "startTime": "2025-01-14T10:30:00Z",
    "isActive": true,
    "pid": 12345
  },
  "message": "Terminal session created successfully",
  "timestamp": "2025-01-14T10:30:00Z"
}
```

#### GET /api/terminals/:id
Get specific terminal session with optional history.

**Query Parameters:**
- `includeHistory` (boolean): Include session history

#### POST /api/terminals/:id/resize
Resize terminal session.

**Request Body:**
```json
{
  "cols": 120,
  "rows": 30
}
```

#### DELETE /api/terminals/:id
Kill terminal session.

**Query Parameters:**
- `signal` (string): Signal to send (default: SIGTERM)

#### GET /api/terminals/stats
Get terminal session statistics.

### WebSocket Messages

#### Client → Server Messages

**Terminal Input:**
```json
{
  "type": "terminal_input",
  "data": "ls -la\n",
  "sessionId": "session-uuid",
  "timestamp": "2025-01-14T10:30:00Z"
}
```

**Terminal Command:**
```json
{
  "type": "terminal_command",
  "command": "ls -la",
  "sessionId": "session-uuid",
  "timestamp": "2025-01-14T10:30:00Z"
}
```

#### Server → Client Messages

**Terminal Output:**
```json
{
  "type": "terminal_output",
  "data": "total 64\ndrwxr-xr-x 10 user user 4096 Jan 14 10:30 .\n",
  "sessionId": "session-uuid",
  "timestamp": "2025-01-14T10:30:00Z",
  "id": "message-uuid"
}
```

**Terminal Status:**
```json
{
  "type": "terminal_status",
  "status": "active",
  "sessionId": "session-uuid",
  "pid": 12345,
  "timestamp": "2025-01-14T10:30:00Z",
  "id": "message-uuid"
}
```

**Terminal Error:**
```json
{
  "type": "terminal_error",
  "error": "Command not found",
  "code": "COMMAND_ERROR",
  "timestamp": "2025-01-14T10:30:00Z",
  "id": "message-uuid"
}
```

## 🎯 Integration with Gemini CLI

### Option 1: Replace gemini-cli Binary

```bash
# Backup original gemini-cli
mv /usr/local/bin/gemini-cli /usr/local/bin/gemini-cli-original

# Install wrapper as gemini-cli
cp gemini-cli-wrapper.js /usr/local/bin/gemini-cli
chmod +x /usr/local/bin/gemini-cli
```

### Option 2: Alias Method

```bash
# Add to ~/.bashrc or ~/.zshrc
alias gemini-cli="node /path/to/gemini-cli-wrapper.js"
```

### Option 3: Environment Variable Method

```bash
# Set environment variable for gemini-cli to use wrapper
export GEMINI_CLI_WRAPPER="/path/to/gemini-cli-wrapper.js"
```

## 🖥️ Frontend Integration

The backend provides WebSocket endpoints that frontend applications can connect to for:

1. **Real-time Terminal Output**: Subscribe to terminal sessions and display output
2. **Input Forwarding**: Send user input to terminal sessions
3. **Session Management**: List, create, and manage terminal sessions
4. **Multi-client Support**: Multiple frontend clients can connect to the same session

### WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws?type=terminal&sessionId=abc123');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'terminal_output':
      displayOutput(message.data);
      break;
    case 'terminal_status':
      updateSessionStatus(message.status);
      break;
  }
};

// Send input
ws.send(JSON.stringify({
  type: 'terminal_input',
  data: 'ls -la\n',
  sessionId: 'abc123'
}));
```

## 🔧 Configuration

### Backend Configuration

Environment variables for the backend:

```bash
# Terminal service settings
TERMINAL_SESSION_TIMEOUT=1800000  # 30 minutes in ms
TERMINAL_MAX_HISTORY=1000         # Max history entries per session
TERMINAL_CLEANUP_INTERVAL=300000  # 5 minutes in ms

# WebSocket settings
WEBSOCKET_PING_INTERVAL=30000     # 30 seconds
WEBSOCKET_TIMEOUT=60000           # 60 seconds
```

### Wrapper Configuration

Environment variables for the wrapper:

```bash
# Backend connection
BACKEND_URL="http://localhost:3000"
WEBSOCKET_URL="ws://localhost:3000/ws"

# Default project context
PROJECT_ID="default-project-id"

# Terminal settings
TERM="xterm-256color"
COLORTERM="truecolor"
```

## 🚨 Error Handling

The system includes comprehensive error handling:

1. **Backend Unavailable**: Wrapper falls back to direct terminal execution
2. **WebSocket Disconnection**: Automatic reconnection attempts
3. **Session Cleanup**: Automatic cleanup of inactive sessions
4. **Process Management**: Proper signal handling for graceful shutdown

## 🔍 Debugging

### Enable Debug Logging

```bash
# Backend
DEBUG=terminal:* npm run dev

# Wrapper
DEBUG=gemini-wrapper node gemini-cli-wrapper.js bash
```

### Common Issues

1. **Backend Connection Failed**
   - Check if backend is running on correct port
   - Verify BACKEND_URL environment variable
   - Check firewall settings

2. **WebSocket Connection Issues**
   - Verify WEBSOCKET_URL format
   - Check for proxy/firewall blocking WebSocket connections
   - Ensure backend WebSocket server is properly configured

3. **Terminal Not Responding**
   - Check session status via `/api/terminals/:id`
   - Verify PTY process is still running
   - Check for resource limits

## 📊 Monitoring

### Session Statistics

```bash
curl http://localhost:3000/api/terminals/stats
```

### Health Check

```bash
curl http://localhost:3000/api/health
```

### WebSocket Status

Monitor WebSocket connections through backend logs or implement custom monitoring endpoints.

## 🔒 Security Considerations

1. **Command Validation**: Consider implementing command whitelisting for production
2. **Authentication**: Add authentication for terminal API endpoints
3. **Resource Limits**: Implement limits on concurrent sessions per user
4. **Audit Logging**: Log all terminal commands for security audit
5. **Network Security**: Use TLS for production WebSocket connections

## 🏃‍♂️ Performance

- **Session Limit**: Default max 100 concurrent sessions per instance
- **Memory Usage**: ~10MB per active PTY session
- **CPU Usage**: Minimal overhead, scales with terminal activity
- **Network**: WebSocket bandwidth depends on terminal output volume

## 🧪 Testing

### Unit Tests

```bash
cd backend
npm test -- --grep "TerminalService"
npm test -- --grep "TerminalHandler"
```

### Integration Tests

```bash
# Test wrapper functionality
node gemini-cli-wrapper.js echo "Hello World"

# Test API endpoints
curl -X POST http://localhost:3000/api/terminals \
  -H "Content-Type: application/json" \
  -d '{"command": "echo", "args": ["test"]}'
```

## 📝 License

This terminal interception system is part of the AI Coding Platform and follows the same license terms. 