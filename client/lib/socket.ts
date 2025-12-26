import { io, Socket } from "socket.io-client";
import { getApiUrl } from "./query-client";

let socket: Socket | null = null;
let currentUserId: string | null = null;

type MessageCallback = (msg: {
  id: string;
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
}) => void;

type TypingCallback = (data: { from: string }) => void;
type StatusCallback = (status: "connected" | "disconnected" | "registered") => void;

const messageListeners: MessageCallback[] = [];
const typingListeners: TypingCallback[] = [];
const statusListeners: StatusCallback[] = [];

export function initSocket(userId: string, publicKey: string): Socket {
  if (socket?.connected && currentUserId === userId) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  currentUserId = userId;
  const url = getApiUrl();

  socket = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: true,
  });

  socket.on("connect", () => {
    socket?.emit("register", { userId, publicKey });
  });

  socket.on("registered", () => {
    statusListeners.forEach((cb) => cb("registered"));
  });

  socket.on("message", (msg) => {
    messageListeners.forEach((cb) => cb(msg));
  });

  socket.on("typing", (data) => {
    typingListeners.forEach((cb) => cb(data));
  });

  socket.on("disconnect", () => {
    statusListeners.forEach((cb) => cb("disconnected"));
  });

  socket.on("connect_error", () => {
    statusListeners.forEach((cb) => cb("disconnected"));
  });

  return socket;
}

export function sendMessage(to: string, encrypted: string, id: string): void {
  if (socket?.connected) {
    socket.emit("message", { to, encrypted, id });
  }
}

export function sendTyping(to: string): void {
  if (socket?.connected) {
    socket.emit("typing", { to });
  }
}

export function onMessage(callback: MessageCallback): () => void {
  messageListeners.push(callback);
  return () => {
    const index = messageListeners.indexOf(callback);
    if (index > -1) messageListeners.splice(index, 1);
  };
}

export function onTyping(callback: TypingCallback): () => void {
  typingListeners.push(callback);
  return () => {
    const index = typingListeners.indexOf(callback);
    if (index > -1) typingListeners.splice(index, 1);
  };
}

export function onStatusChange(callback: StatusCallback): () => void {
  statusListeners.push(callback);
  return () => {
    const index = statusListeners.indexOf(callback);
    if (index > -1) statusListeners.splice(index, 1);
  };
}

export function disconnect(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
