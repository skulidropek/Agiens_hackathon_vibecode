#!/usr/bin/env node

/**
 * Gemini CLI Terminal Interception Wrapper
 * 
 * This script wraps gemini-cli to intercept all terminal sessions
 * and route them through our backend terminal management system.
 */

const { spawn } = require('node-pty');
const WebSocket = require('ws');
const fetch = require('node-fetch').default || require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'ws://localhost:3000/ws';

class GeminiCLIWrapper {
  constructor() {
    this.activeSessions = new Map();
    this.backendAvailable = false;
    this.checkBackendAvailability();
  }

  async checkBackendAvailability() {
    try {
      const response = await fetch(`${BACKEND_URL}/health`);
      this.backendAvailable = response.ok;
      console.log(`🔗 Backend connection: ${this.backendAvailable ? 'Available' : 'Unavailable'}`);
    } catch (error) {
      this.backendAvailable = false;
      console.log(`⚠️ Backend not available: ${error.message}`);
    }
  }

  async createTerminalSession(command, args = [], options = {}) {
    if (!this.backendAvailable) {
      console.log('📡 Backend unavailable, running terminal directly...');
      return this.runDirectTerminal(command, args, options);
    }

    try {
      // Create terminal session via backend API
      const response = await fetch(`${BACKEND_URL}/api/terminals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          command,
          args,
          cwd: options.cwd || process.cwd(),
          projectId: options.projectId || process.env.GEMINI_PROJECT_ID || 'default-project',
          env: options.env || {},
          cols: process.stdout.columns || 80,
          rows: process.stdout.rows || 24
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create terminal session: ${response.statusText}`);
      }

      const sessionData = await response.json();
      const sessionId = sessionData.data.id;

      console.log(`🚀 Terminal session created: ${sessionId}`);
      console.log(`📋 Command: ${command} ${args.join(' ')}`);
      console.log(`📂 Working directory: ${options.cwd || process.cwd()}`);

      // Connect to WebSocket for real-time communication
      const ws = new WebSocket(`${WEBSOCKET_URL}?type=terminal&sessionId=${sessionId}`);
      
      return new Promise((resolve, reject) => {
        ws.on('open', () => {
          console.log(`🔌 WebSocket connected for session: ${sessionId}`);
          
          const session = {
            id: sessionId,
            ws,
            command,
            args,
            isActive: true
          };

          this.activeSessions.set(sessionId, session);
          this.setupTerminalIO(session);
          
          resolve(session);
        });

        ws.on('error', (error) => {
          console.error(`❌ WebSocket error: ${error.message}`);
          reject(error);
        });

        ws.on('close', () => {
          console.log(`🔌 WebSocket closed for session: ${sessionId}`);
          this.activeSessions.delete(sessionId);
        });
      });

    } catch (error) {
      console.error(`❌ Failed to create backend session: ${error.message}`);
      console.log('📡 Falling back to direct terminal...');
      return this.runDirectTerminal(command, args, options);
    }
  }

  setupTerminalIO(session) {
    const { ws, id } = session;

    // Handle incoming data from backend
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'terminal_output':
            if (message.sessionId === id) {
              process.stdout.write(message.data);
            }
            break;
            
          case 'terminal_status':
            if (message.sessionId === id) {
              if (message.status === 'stopped') {
                console.log(`\n🔚 Terminal session ended: ${id}`);
                session.isActive = false;
                ws.close();
              }
            }
            break;
            
          case 'terminal_error':
            console.error(`❌ Terminal error: ${message.error}`);
            break;
        }
      } catch (error) {
        console.error(`❌ Error parsing WebSocket message: ${error.message}`);
      }
    });

    // Handle stdin input
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (data) => {
      if (session.isActive && ws.readyState === WebSocket.OPEN) {
        const message = {
          type: 'terminal_input',
          data: data,
          sessionId: id,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(message));
      }
    });

    // Handle process termination
    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });
  }

  runDirectTerminal(command, args, options) {
    console.log(`📡 Running terminal directly: ${command} ${args.join(' ')}`);
    
    const ptyProcess = spawn(command, args, {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });

    ptyProcess.onData((data) => {
      process.stdout.write(data);
    });

    ptyProcess.onExit((exitInfo) => {
      const exitCode = exitInfo.exitCode || 0;
      console.log(`\n🔚 Process exited with code: ${exitCode}`);
      process.exit(exitCode);
    });

    // Forward stdin to PTY
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (data) => {
      ptyProcess.write(data);
    });

    return Promise.resolve({ ptyProcess, isDirect: true });
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up terminal sessions...');
    
    for (const [sessionId, session] of this.activeSessions) {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      console.log(`🔚 Closed session: ${sessionId}`);
    }
    
    this.activeSessions.clear();
  }

  async listActiveSessions() {
    if (!this.backendAvailable) {
      console.log('📡 Backend unavailable, cannot list sessions');
      return [];
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/terminals?active=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`❌ Error fetching sessions: ${error.message}`);
      return [];
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🤖 Gemini CLI Terminal Wrapper

Usage:
  gemini-cli-wrapper <command> [args...]
  gemini-cli-wrapper --list-sessions
  gemini-cli-wrapper --help

Examples:
  gemini-cli-wrapper bash
  gemini-cli-wrapper python3 script.py
  gemini-cli-wrapper --list-sessions

Environment Variables:
  BACKEND_URL      Backend server URL (default: http://localhost:3000)
  WEBSOCKET_URL    WebSocket server URL (default: ws://localhost:3000/ws)
    `);
    process.exit(0);
  }

  const wrapper = new GeminiCLIWrapper();

  if (args[0] === '--list-sessions') {
    const sessions = await wrapper.listActiveSessions();
    console.log('\n📋 Active Terminal Sessions:');
    
    if (sessions.length === 0) {
      console.log('  No active sessions');
    } else {
      sessions.forEach(session => {
        console.log(`  📺 ${session.id}: ${session.command} (PID: ${session.pid})`);
        console.log(`      Started: ${new Date(session.startTime).toLocaleString()}`);
        console.log(`      Working Dir: ${session.cwd}`);
        console.log('');
      });
    }
    process.exit(0);
  }

  if (args[0] === '--help') {
    console.log('🤖 Gemini CLI Terminal Wrapper - Intercepts terminal sessions for backend management');
    process.exit(0);
  }

  // Extract command and arguments
  const [command, ...commandArgs] = args;
  
  // Determine project context
  const projectId = process.env.PROJECT_ID || null;
  const cwd = process.cwd();

  console.log(`🚀 Starting terminal session...`);
  console.log(`📋 Command: ${command} ${commandArgs.join(' ')}`);
  console.log(`📂 Working Directory: ${cwd}`);
  if (projectId) {
    console.log(`🏗️ Project ID: ${projectId}`);
  }

  try {
    await wrapper.createTerminalSession(command, commandArgs, {
      cwd,
      projectId,
      env: process.env
    });
  } catch (error) {
    console.error(`❌ Failed to start terminal session: ${error.message}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(`❌ Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`❌ Unhandled rejection at:`, promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ Main process error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = GeminiCLIWrapper; 