import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";

interface PendingMessage {
  id: string;
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
  groupId?: string;
  content?: string;
}

interface GroupInfo {
  id: string;
  members: string[];
}

const connectedUsers = new Map<string, string>();
const pendingMessages = new Map<string, PendingMessage[]>();
const groups = new Map<string, GroupInfo>();
const deliveredMessageIds = new Set<string>();
const MESSAGE_TTL = 24 * 60 * 60 * 1000;
const DELIVERED_IDS_TTL = 24 * 60 * 60 * 1000;

function generateMessageId(): string {
  return `srv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function cleanupDeliveredIds() {
  if (deliveredMessageIds.size > 100000) {
    deliveredMessageIds.clear();
  }
}

setInterval(cleanupDeliveredIds, 60 * 60 * 1000);

function cleanupExpiredMessages() {
  const now = Date.now();
  for (const [userId, messages] of pendingMessages.entries()) {
    const validMessages = messages.filter(msg => now - msg.timestamp < MESSAGE_TTL);
    if (validMessages.length === 0) {
      pendingMessages.delete(userId);
    } else {
      pendingMessages.set(userId, validMessages);
    }
  }
}

setInterval(cleanupExpiredMessages, 60 * 60 * 1000);

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      connectedUsers: connectedUsers.size,
      pendingMessages: Array.from(pendingMessages.values()).reduce((acc, msgs) => acc + msgs.length, 0),
    });
  });

  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Relay] Client connected: ${socket.id}`);

    socket.on("register", (data: { userId: string; publicKey?: string; torEnabled?: boolean; groups?: string[] } | string) => {
      const userId = typeof data === "string" ? data : data.userId;
      const userGroups = typeof data === "object" ? data.groups : undefined;
      
      connectedUsers.set(userId, socket.id);
      console.log(`[Relay] User registered: ${userId}`);

      if (userGroups && userGroups.length > 0) {
        userGroups.forEach((groupId) => {
          socket.join(groupId);
          const group = groups.get(groupId);
          if (group) {
            if (!group.members.includes(userId)) {
              group.members.push(userId);
            }
          } else {
            groups.set(groupId, { id: groupId, members: [userId] });
          }
        });
        console.log(`[Relay] User ${userId} rejoined ${userGroups.length} groups`);
      }

      const pending = pendingMessages.get(userId);
      if (pending && pending.length > 0) {
        pending.forEach((msg) => {
          if (msg.groupId) {
            socket.emit("group:message", {
              groupId: msg.groupId,
              from: msg.from,
              encrypted: msg.encrypted,
              content: msg.content,
              timestamp: msg.timestamp,
            });
          } else {
            socket.emit("message", msg);
          }
        });
        pendingMessages.delete(userId);
        console.log(`[Relay] Delivered ${pending.length} pending messages to ${userId}`);
      }
    });

    socket.on("message", (data: { to: string; from: string; encrypted: string; id?: string }) => {
      const messageId = data.id || generateMessageId();
      
      if (deliveredMessageIds.has(messageId)) {
        console.log(`[Relay] Duplicate message ignored: ${messageId}`);
        return;
      }
      
      const targetSocketId = connectedUsers.get(data.to);
      const timestamp = Date.now();

      if (targetSocketId) {
        io.to(targetSocketId).emit("message", {
          id: messageId,
          from: data.from,
          encrypted: data.encrypted,
          timestamp,
        });
        deliveredMessageIds.add(messageId);
        console.log(`[Relay] Message delivered: ${data.from} -> ${data.to}`);
      } else {
        const pending = pendingMessages.get(data.to) || [];
        pending.push({
          id: messageId,
          from: data.from,
          to: data.to,
          encrypted: data.encrypted,
          timestamp,
        });
        pendingMessages.set(data.to, pending);
        console.log(`[Relay] Message queued for offline user: ${data.to}`);
      }
    });

    socket.on("group:create", (data: { groupId: string; members: string[] }) => {
      groups.set(data.groupId, { id: data.groupId, members: data.members });
      socket.join(data.groupId);
      console.log(`[Relay] Group created: ${data.groupId} with ${data.members.length} members`);
    });

    socket.on("group:join", (data: { groupId: string; userId: string }) => {
      const group = groups.get(data.groupId);
      if (group && !group.members.includes(data.userId)) {
        group.members.push(data.userId);
      }
      socket.join(data.groupId);
      console.log(`[Relay] User ${data.userId} joined group: ${data.groupId}`);
    });

    socket.on("group:leave", (data: { groupId: string; userId: string }) => {
      const group = groups.get(data.groupId);
      if (group) {
        group.members = group.members.filter(m => m !== data.userId);
        if (group.members.length === 0) {
          groups.delete(data.groupId);
        }
      }
      socket.leave(data.groupId);
      console.log(`[Relay] User ${data.userId} left group: ${data.groupId}`);
    });

    socket.on("group:message", (data: { groupId: string; from: string; encrypted: string; content: string; id?: string }) => {
      const messageId = data.id || generateMessageId();
      
      if (deliveredMessageIds.has(messageId)) {
        console.log(`[Relay] Duplicate group message ignored: ${messageId}`);
        return;
      }
      
      const group = groups.get(data.groupId);
      const timestamp = Date.now();
      
      if (group) {
        group.members.forEach((memberId) => {
          if (memberId !== data.from) {
            const memberSocketId = connectedUsers.get(memberId);
            if (memberSocketId) {
              io.to(memberSocketId).emit("group:message", {
                id: messageId,
                groupId: data.groupId,
                from: data.from,
                encrypted: data.encrypted,
                content: data.content,
                timestamp,
              });
            } else {
              const pending = pendingMessages.get(memberId) || [];
              pending.push({
                id: messageId,
                from: data.from,
                to: memberId,
                encrypted: data.encrypted,
                timestamp,
                groupId: data.groupId,
                content: data.content,
              });
              pendingMessages.set(memberId, pending);
            }
          }
        });
        deliveredMessageIds.add(messageId);
        console.log(`[Relay] Group message: ${data.from} -> ${data.groupId}`);
      } else {
        io.to(data.groupId).emit("group:message", {
          id: messageId,
          groupId: data.groupId,
          from: data.from,
          encrypted: data.encrypted,
          content: data.content,
          timestamp,
        });
        deliveredMessageIds.add(messageId);
        console.log(`[Relay] Group message (room): ${data.from} -> ${data.groupId}`);
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`[Relay] User disconnected: ${userId}`);
          break;
        }
      }
    });
  });

  return httpServer;
}
