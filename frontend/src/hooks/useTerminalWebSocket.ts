import { useContext } from 'react';
import { TerminalWebSocketContext } from '../contexts/TerminalWebSocketContext';

export const useTerminalWebSocket = () => {
  const context = useContext(TerminalWebSocketContext);
  if (!context) {
    throw new Error('useTerminalWebSocket must be used within a TerminalWebSocketProvider');
  }
  return context;
}; 