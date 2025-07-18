import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TerminalWebSocketClient } from '../api/TerminalWebSocketClient';
import type { WebSocketMessage } from '../types';
import type { TerminalWebSocketContextType } from './TerminalWebSocketContext';
import { TerminalWebSocketContext } from './TerminalWebSocketContext';

interface TerminalWebSocketProviderProps {
  children: React.ReactNode;
}

export const TerminalWebSocketProvider: React.FC<TerminalWebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<TerminalWebSocketClient | null>(null);
  const messageHandlersRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  // Initialize client only once
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      console.log('TerminalWebSocketProvider: Creating new Terminal WebSocket client instance', new Date().toISOString());
      clientRef.current = TerminalWebSocketClient.getInstance();
    }
    return clientRef.current;
  }, []);

  // Handle incoming messages and distribute to all subscribers
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'connection_established') {
      console.log('TerminalWebSocketProvider: Connection established via message', new Date().toISOString());
      setIsConnected(true);
    }
    
    // Notify all subscribers
    messageHandlersRef.current.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in Terminal WebSocket message handler:', error);
      }
    });
  }, []);

  // Subscribe/unsubscribe message handlers
  const subscribe = useCallback((handler: (message: WebSocketMessage) => void) => {
    console.log('TerminalWebSocketProvider: Adding message handler', new Date().toISOString());
    messageHandlersRef.current.add(handler);

    // Return unsubscribe function
    return () => {
      console.log('TerminalWebSocketProvider: Removing message handler', new Date().toISOString());
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  // Initialize WebSocket connection once
  useEffect(() => {
    console.log('TerminalWebSocketProvider: Effect running', new Date().toISOString());
    
    const client = getClient();
    
    // Set up the message handler
    client.onMessage(handleMessage);
    
    // Connect to WebSocket
    client.connect();
    console.log('TerminalWebSocketProvider: Connection initiated', new Date().toISOString());

    // Cleanup on unmount
    return () => {
      console.log('TerminalWebSocketProvider: Effect cleanup', new Date().toISOString());
      setIsConnected(false);
    };
  }, [getClient, handleMessage]);

  const contextValue: TerminalWebSocketContextType = {
    isConnected,
    client: getClient(),
    subscribe,
  };

  return (
    <TerminalWebSocketContext.Provider value={contextValue}>
      {children}
    </TerminalWebSocketContext.Provider>
  );
}; 