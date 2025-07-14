import type { WebSocketMessage } from '../types';
import type { WebSocketClient } from '../api/WebSocketClient';

export interface WebSocketContextType {
  isConnected: boolean;
  client: WebSocketClient;
  subscribe: (handler: (message: WebSocketMessage) => void) => () => void;
} 