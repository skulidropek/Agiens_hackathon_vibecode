import { createContext } from 'react';
import type { WebSocketMessage } from '../types';
import type { TerminalWebSocketClient } from '../api/TerminalWebSocketClient';

export interface TerminalWebSocketContextType {
  isConnected: boolean;
  client: TerminalWebSocketClient;
  subscribe: (handler: (message: WebSocketMessage) => void) => () => void;
}

export const TerminalWebSocketContext = createContext<TerminalWebSocketContextType | null>(null); 