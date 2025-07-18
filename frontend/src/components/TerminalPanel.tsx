import React, { useState, useEffect, useCallback } from 'react';
import { XTerminalInstance } from './XTerminalInstance';
import styles from './TerminalPanel.module.css';
import { useTerminalWebSocket } from '../hooks/useTerminalWebSocket';

// A minimal type definition to help with development
interface TerminalSession {
  id: string;
  command: string;
  projectId: string;
  cwd: string;
  startTime: string;
  lastActivity: string;
  isActive: boolean;
  pid: number;
}

export const TerminalPanel: React.FC<{ projectId: string, isVisible: boolean }> = ({ projectId, isVisible }) => {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client, subscribe } = useTerminalWebSocket();

  const fetchTerminals = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3000/api/terminals?projectId=${projectId}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const result = await response.json();
      const sessions = result.data || []; // Extract the sessions array from the response
      setTerminals(sessions);
      if (sessions.length > 0 && !activeTerminalId) {
        setActiveTerminalId(sessions[0].id);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTerminalId]);

  // WebSocket подписка на обновления списка терминалов
  useEffect(() => {
    if (!isVisible || !client) return;

    // Подписываемся на обновления списка терминалов
    client.subscribeToTerminalList(projectId);

    // Подписываемся на WebSocket сообщения
    const unsubscribe = subscribe((message) => {
      if (message.type === 'terminal_list_update') {
        setTerminals(message.terminals);
        // Если нет активного терминала, выбираем первый
        if (!activeTerminalId && message.terminals.length > 0) {
          setActiveTerminalId(message.terminals[0].id);
        }
      }
    });

    // Отписываемся при размонтировании
    return () => {
      unsubscribe();
      client.unsubscribeFromTerminalList();
    };
  }, [isVisible, client, subscribe, projectId, activeTerminalId]);

  useEffect(() => {
    if (isVisible) {
      fetchTerminals();
    }
  }, [isVisible, fetchTerminals]);

  const createNewTerminal = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`http://localhost:3000/api/terminals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) throw new Error('Failed to create terminal');
      const result = await response.json();
      const newTerminal = result.data; // Extract the terminal data from the response
      setTerminals(prev => [...prev, newTerminal]);
      setActiveTerminalId(newTerminal.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  }, [projectId]);

  const closeTerminal = useCallback(async (id: string) => {
    try {
      await fetch(`http://localhost:3000/api/terminals/${id}`, { method: 'DELETE' });
      setTerminals(prev => {
        const newTerminals = prev.filter(t => t.id !== id);
        if (activeTerminalId === id) {
          setActiveTerminalId(newTerminals[0]?.id || null);
        }
        return newTerminals;
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  }, [activeTerminalId]);

  if (!isVisible) return null;

  return (
    <div className={styles.terminalPanel}>
      <div className={styles.tabBar}>
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            className={`${styles.tab} ${terminal.id === activeTerminalId ? styles.active : ''}`}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span className={styles.tabTitle}>
              {`Terminal ${terminal.id.slice(0, 8)}`}
            </span>
            <button 
              className={styles.tabClose}
              onClick={(e) => { e.stopPropagation(); closeTerminal(terminal.id); }}
            >
              ×
            </button>
          </div>
        ))}
        <button className={styles.newTabButton} onClick={createNewTerminal}>+</button>
      </div>
      <div className={styles.terminalContent}>
        {loading && <div className={styles.loading}>Loading...</div>}
        {error && <div className={styles.error}>Error: {error}</div>}
        {!loading && !error && (
          activeTerminalId ? (
            <XTerminalInstance terminalId={activeTerminalId} />
          ) : (
            <div className={styles.noTerminals}>
              <div>No active terminal. Select or create one.</div>
              <button className={styles.startButton} onClick={createNewTerminal}>
                Start Terminal
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}; 