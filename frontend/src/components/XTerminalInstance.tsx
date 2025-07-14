import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { TerminalSession } from '../services/terminal-api.service';
import { terminalWebSocketService } from '../services/terminal-websocket.service';

interface XTerminalInstanceProps {
  session: TerminalSession;
  isActive: boolean;
  onClose: () => void;
  onTitle?: (title: string) => void;
}

export const XTerminalInstance: React.FC<XTerminalInstanceProps> = ({
  session,
  isActive,
  onClose,
  onTitle
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [, setWs] = useState<WebSocket | null>(null);
  const [, setTitle] = useState<string>(`Terminal ${session.id.slice(0, 8)}`);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Fira Code, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      }
    });

    // Initialize addons
    const fit = new FitAddon();
    const webLinks = new WebLinksAddon();
    
    term.loadAddon(fit);
    term.loadAddon(webLinks);
    
    terminal.current = term;
    fitAddon.current = fit;

    // Open terminal
    term.open(terminalRef.current);
    fit.fit();

    // Setup WebSocket connection using service
    const connectWebSocket = async () => {
      try {
        const websocket = await terminalWebSocketService.connect(session.id);
        setWs(websocket);

        // Setup message handler
        terminalWebSocketService.onMessage(session.id, (message) => {
          if (message.type === 'terminal_output') {
            term.write(message.data || '');
          } else if (message.type === 'terminal_exit') {
            term.writeln('\r\n\x1b[31mTerminal session ended\x1b[0m');
            onClose();
          } else if (message.type === 'error') {
            term.writeln(`\r\n\x1b[31mError: ${message.error}\x1b[0m`);
          }
        });

      } catch (error) {
        console.error('Failed to connect terminal WebSocket:', error);
        term.writeln('\r\n\x1b[31mConnection failed\x1b[0m');
      }
    };

    connectWebSocket();

    // Handle user input
    term.onData((data) => {
      terminalWebSocketService.sendInput(session.id, data);
    });

    // Handle terminal resize
    term.onResize((size) => {
      terminalWebSocketService.sendResize(session.id, size.cols, size.rows);
    });

    // Handle title changes
    term.onTitleChange((newTitle) => {
      const terminalTitle = newTitle || `Terminal ${session.id.slice(0, 8)}`;
      setTitle(terminalTitle);
      onTitle?.(terminalTitle);
    });

    // Cleanup
    return () => {
      terminalWebSocketService.disconnect(session.id);
      term.dispose();
    };
  }, [session.id, onClose, onTitle]);

  // Handle resize when terminal becomes active
  useEffect(() => {
    if (isActive && fitAddon.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        fitAddon.current?.fit();
      }, 100);
    }
  }, [isActive]);

  return (
    <div 
      className="xterm-container"
      style={{ 
        width: '100%', 
        height: '100%',
        display: isActive ? 'block' : 'none'
      }}
    >
      <div 
        ref={terminalRef}
        style={{ 
          width: '100%', 
          height: '100%',
          padding: '8px'
        }}
      />
    </div>
  );
}; 