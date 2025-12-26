import { io, Socket } from "socket.io-client";
import { getApiUrl } from "./query-client";
import { getTorSettings, getActiveGroups, type TorSettings } from "./storage";

let socket: Socket | null = null;
let currentUserId: string | null = null;
let currentPublicKey: string = "";
let torEnabled: boolean = false;
let currentTorSettings: TorSettings | null = null;

type MessageCallback = (msg: {
  id: string;
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
}) => void;

type GroupMessageCallback = (msg: {
  groupId: string;
  from: string;
  encrypted: string;
  content?: string;
  timestamp: number;
}) => void;

type TypingCallback = (data: { from: string }) => void;
type StatusCallback = (status: "connected" | "disconnected" | "registered" | "tor_connected" | "tor_connecting") => void;
type TorStatusCallback = (settings: TorSettings) => void;

const messageListeners: MessageCallback[] = [];
const groupMessageListeners: GroupMessageCallback[] = [];
const typingListeners: TypingCallback[] = [];
const statusListeners: StatusCallback[] = [];
const torStatusListeners: TorStatusCallback[] = [];

export async function initSocket(userId: string, publicKey: string): Promise<Socket> {
  if (socket?.connected && currentUserId === userId) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  currentUserId = userId;
  currentPublicKey = publicKey;
  const url = getApiUrl();
  
  const torSettings = await getTorSettings();
  currentTorSettings = torSettings;
  torEnabled = torSettings.enabled;

  if (torEnabled) {
    statusListeners.forEach((cb) => cb("tor_connecting"));
    torStatusListeners.forEach((cb) => cb(torSettings));
  }

  socket = io(url, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    extraHeaders: torEnabled ? {
      "X-Tor-Enabled": "true",
      "X-Tor-Proxy": `${torSettings.proxyHost}:${torSettings.proxyPort}`,
    } : undefined,
  });

  socket.on("connect", async () => {
    const userGroupsList = await getActiveGroups();
    const groupIds = userGroupsList.map(g => g.id);
    socket?.emit("register", { userId, publicKey, torEnabled, groups: groupIds });
    if (torEnabled) {
      statusListeners.forEach((cb) => cb("tor_connected"));
    }
  });

  socket.on("registered", () => {
    statusListeners.forEach((cb) => cb("registered"));
  });

  socket.on("message", (msg) => {
    messageListeners.forEach((cb) => cb(msg));
  });

  socket.on("group:message", (msg) => {
    groupMessageListeners.forEach((cb) => cb(msg));
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
  if (socket?.connected && currentUserId) {
    socket.emit("message", { to, from: currentUserId, encrypted, id });
  }
}

export function sendGroupMessage(groupId: string, encrypted: string, content: string): void {
  if (socket?.connected && currentUserId) {
    socket.emit("group:message", { groupId, from: currentUserId, encrypted, content });
  }
}

export function joinGroup(groupId: string): void {
  if (socket?.connected && currentUserId) {
    socket.emit("group:join", { groupId, userId: currentUserId });
  }
}

export function leaveGroup(groupId: string): void {
  if (socket?.connected && currentUserId) {
    socket.emit("group:leave", { groupId, userId: currentUserId });
  }
}

export function createGroupOnServer(groupId: string, members: string[]): void {
  if (socket?.connected) {
    socket.emit("group:create", { groupId, members });
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

export function onGroupMessage(callback: GroupMessageCallback): () => void {
  groupMessageListeners.push(callback);
  return () => {
    const index = groupMessageListeners.indexOf(callback);
    if (index > -1) groupMessageListeners.splice(index, 1);
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

export function isTorEnabled(): boolean {
  return torEnabled;
}

export function getTorConnectionInfo(): TorSettings | null {
  return currentTorSettings;
}

export function onTorStatusChange(callback: TorStatusCallback): () => void {
  torStatusListeners.push(callback);
  return () => {
    const index = torStatusListeners.indexOf(callback);
    if (index > -1) torStatusListeners.splice(index, 1);
  };
}

export async function reconnectWithTor(): Promise<void> {
  if (currentUserId) {
    const userId = currentUserId;
    const publicKey = currentPublicKey;
    disconnect();
    const torSettings = await getTorSettings();
    currentTorSettings = torSettings;
    torEnabled = torSettings.enabled;
    
    return new Promise((resolve, reject) => {
      initSocket(userId, publicKey).then((newSocket) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);
        
        const onConnect = () => {
          clearTimeout(timeout);
          newSocket.off("connect", onConnect);
          newSocket.off("connect_error", onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          newSocket.off("connect", onConnect);
          newSocket.off("connect_error", onError);
          reject(new Error("Connection failed"));
        };
        
        if (newSocket.connected) {
          resolve();
        } else {
          newSocket.on("connect", onConnect);
          newSocket.on("connect_error", onError);
        }
      }).catch(reject);
    });
  }
}

export async function reconnectToServer(): Promise<void> {
  if (currentUserId) {
    const userId = currentUserId;
    const publicKey = currentPublicKey;
    disconnect();
    
    return new Promise((resolve, reject) => {
      initSocket(userId, publicKey).then((newSocket) => {
        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 10000);
        
        const onConnect = () => {
          clearTimeout(timeout);
          newSocket.off("connect", onConnect);
          newSocket.off("connect_error", onError);
          resolve();
        };
        
        const onError = () => {
          clearTimeout(timeout);
          newSocket.off("connect", onConnect);
          newSocket.off("connect_error", onError);
          reject(new Error("Connection failed"));
        };
        
        if (newSocket.connected) {
          resolve();
        } else {
          newSocket.on("connect", onConnect);
          newSocket.on("connect_error", onError);
        }
      }).catch(reject);
    });
  }
}
