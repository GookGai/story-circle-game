import { createContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Only connect when authenticated
    if (!user || !token) {
      // Disconnect any existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Create new socket connection
    const newSocket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      console.log('🔌 Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('🔌 Socket connection error:', err.message);
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Cleanup on unmount or auth change
    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
    };
  }, [user, token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
