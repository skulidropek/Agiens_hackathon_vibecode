import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalWebSocket } from '../hooks/useTerminalWebSocket';

interface XTerminalInstanceProps {
  terminalId: string;
}

export const XTerminalInstance: React.FC<XTerminalInstanceProps> = ({ terminalId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { client } = useTerminalWebSocket();

  useEffect(() => {
    if (!terminalRef.current || !client) {
      return;
    }

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'monospace',
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(terminalRef.current);
    
    const unsubscribe = client.subscribeToTerminal(
      terminalId, 
      (data: string) => {
        terminal.write(data);
      },
      (history) => {
        // Отображаем историю терминала
        history.forEach(entry => {
          if (entry.type === 'output') {
            terminal.write(entry.data);
          }
        });
      }
    );

    const onDataDisposable = terminal.onData(data => {
      client.sendTerminalInput(terminalId, data);
    });

    const onResizeDisposable = terminal.onResize(({ cols, rows }) => {
      client.resizeTerminal(terminalId, { cols, rows });
    });

    return () => {
      unsubscribe();
      onDataDisposable.dispose();
      onResizeDisposable.dispose();
      terminal.dispose();
      resizeObserver.disconnect();
    };
  }, [terminalId, client]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
}; 