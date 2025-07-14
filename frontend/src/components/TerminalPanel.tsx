import React, { useState, useEffect, useCallback } from 'react';
import { XTerminalInstance } from './XTerminalInstance';
import { terminalApiService, type TerminalSession } from '../services/terminal-api.service';
import styles from './TerminalPanel.module.css';

interface TerminalPanelProps {
  projectId: string;
  isVisible: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  projectId,
  isVisible
}) => {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminalTitles, setTerminalTitles] = useState<Record<string, string>>({});

  // Load terminals for current project
  const loadTerminals = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const sessions = await terminalApiService.getTerminals(projectId);
      setTerminals(sessions);
      
      // Set active terminal if none selected
      if (!activeTerminalId && sessions.length > 0) {
        setActiveTerminalId(sessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load terminals:', err);
      setError('Failed to load terminals');
    } finally {
      setLoading(false);
    }
  }, [projectId, activeTerminalId]);

  // Create new terminal
  const createTerminal = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const newTerminal = await terminalApiService.createTerminal({
        projectId,
        command: 'bash', // or could be configurable
      });
      
      if (newTerminal) {
        setTerminals(prev => [...prev, newTerminal]);
        setActiveTerminalId(newTerminal.id);
        setTerminalTitles(prev => ({
          ...prev,
          [newTerminal.id]: `Terminal ${newTerminal.id.slice(0, 8)}`
        }));
      }
    } catch (err) {
      console.error('Failed to create terminal:', err);
      setError('Failed to create terminal');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Close terminal
  const closeTerminal = useCallback(async (terminalId: string) => {
    try {
      await terminalApiService.deleteTerminal(terminalId);
      
      setTerminals(prev => {
        const updated = prev.filter(t => t.id !== terminalId);
        
        // Switch to another terminal if closing active one
        if (activeTerminalId === terminalId) {
          const nextTerminal = updated[0]; // Берем первый доступный терминал
          setActiveTerminalId(nextTerminal?.id || null);
        }
        
        return updated;
      });
      
      // Clean up title
      setTerminalTitles(prev => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [terminalId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err) {
      console.error('Failed to close terminal:', err);
    }
  }, [activeTerminalId]);

  // Handle terminal title change
  const handleTitleChange = useCallback((terminalId: string, title: string) => {
    setTerminalTitles(prev => ({
      ...prev,
      [terminalId]: title
    }));
  }, []);

  // Load terminals on mount and project change
  useEffect(() => {
    loadTerminals();
  }, [loadTerminals]);

  // Auto-refresh terminals every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadTerminals, 10000);
    return () => clearInterval(interval);
  }, [loadTerminals]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.terminalPanel}>
      {/* Header */}
      <div className={styles.terminalHeader}>
        <span className={styles.terminalTitle}>Terminal</span>
        <div className={styles.terminalActions}>
          <button
            className={styles.actionButton}
            onClick={createTerminal}
            disabled={loading}
            title="New Terminal"
          >
            +
          </button>
          <button
            className={styles.actionButton}
            onClick={loadTerminals}
            disabled={loading}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      {terminals.length > 0 && (
        <div className={styles.tabBar}>
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              className={`${styles.tab} ${
                activeTerminalId === terminal.id ? styles.active : ''
              }`}
              onClick={() => setActiveTerminalId(terminal.id)}
            >
              <span className={styles.tabTitle}>
                {terminalTitles[terminal.id] || `Terminal ${terminal.id.slice(0, 8)}`}
              </span>
              <button
                className={styles.tabClose}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(terminal.id);
                }}
                title="Close Terminal"
              >
                ×
              </button>
            </div>
          ))}
          <button
            className={styles.newTabButton}
            onClick={createTerminal}
            disabled={loading}
            title="New Terminal"
          >
            +
          </button>
        </div>
      )}

      {/* Content */}
      <div className={styles.terminalContent}>
        {loading && (
          <div className={styles.loading}>
            Loading terminals...
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <div>{error}</div>
            <button
              className={styles.retryButton}
              onClick={() => {
                setError(null);
                loadTerminals();
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && terminals.length === 0 && (
          <div className={styles.noTerminals}>
            <div>No terminals open</div>
            <button
              className={styles.startButton}
              onClick={createTerminal}
            >
              Start New Terminal
            </button>
          </div>
        )}

        {/* Terminal Instances */}
        {terminals.map((terminal) => (
          <XTerminalInstance
            key={terminal.id}
            session={terminal}
            isActive={activeTerminalId === terminal.id}
            onClose={() => closeTerminal(terminal.id)}
            onTitle={(title) => handleTitleChange(terminal.id, title)}
          />
        ))}
      </div>
    </div>
  );
}; 