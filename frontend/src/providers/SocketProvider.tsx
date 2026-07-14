"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthProvider";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace('/api/v1', '');
    const socketInstance = io(baseUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);

      socketInstance.emit("authenticate", user.id);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
