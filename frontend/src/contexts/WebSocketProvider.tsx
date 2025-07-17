import React, { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketClient } from '../api/WebSocketClient';
import type { WebSocketMessage } from '../types';
import type { WebSocketContextType } from '../types/websocket';
import { WebSocketContext } from './WebSocketContext';

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<WebSocketClient | null>(null);
  const messageHandlersRef = useRef<Set<(message: WebSocketMessage) => void>>(new Set());

  // Initialize client only once
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      console.log('WebSocketProvider: Creating new WebSocket client instance', new Date().toISOString());
      clientRef.current = WebSocketClient.getInstance();
    }
    return clientRef.current;
  }, []);

  // Handle incoming messages and distribute to all subscribers
  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'connection_established') {
      console.log('WebSocketProvider: Connection established via message', new Date().toISOString());
      setIsConnected(true);
    }
    
    // Notify all subscribers
    messageHandlersRef.current.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in WebSocket message handler:', error);
      }
    });
  }, []);

  // Subscribe/unsubscribe message handlers
  const subscribe = useCallback((handler: (message: WebSocketMessage) => void) => {
    console.log('WebSocketProvider: Adding message handler', new Date().toISOString());
    messageHandlersRef.current.add(handler);

    // Return unsubscribe function
    return () => {
      console.log('WebSocketProvider: Removing message handler', new Date().toISOString());
      messageHandlersRef.current.delete(handler);
    };
  }, []);

  // Initialize WebSocket connection once
  useEffect(() => {
    console.log('WebSocketProvider: Effect running', new Date().toISOString());
    
    const client = getClient();
    
    // Set up the message handler
    client.onMessage(handleMessage);
    
    // Connect to WebSocket
    client.connect();
    console.log('WebSocketProvider: Connection initiated', new Date().toISOString());

    // Cleanup on unmount
    return () => {
      console.log('WebSocketProvider: Effect cleanup', new Date().toISOString());
      setIsConnected(false);
    };
  }, [getClient, handleMessage]);

  const contextValue: WebSocketContextType = {
    isConnected,
    client: getClient(),
    subscribe,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}; 