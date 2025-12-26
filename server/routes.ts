import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";

interface PendingMessage {
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
}

const connectedUsers = new Map<string, string>();
const pendingMessages = new Map<string, PendingMessage[]>();
const MESSAGE_TTL = 24 * 60 * 60 * 1000;

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

    socket.on("register", (userId: string) => {
      connectedUsers.set(userId, socket.id);
      console.log(`[Relay] User registered: ${userId}`);

      const pending = pendingMessages.get(userId);
      if (pending && pending.length > 0) {
        pending.forEach((msg) => {
          socket.emit("message", msg);
        });
        pendingMessages.delete(userId);
        console.log(`[Relay] Delivered ${pending.length} pending messages to ${userId}`);
      }
    });

    socket.on("message", (data: { to: string; from: string; encrypted: string }) => {
      const targetSocketId = connectedUsers.get(data.to);

      if (targetSocketId) {
        io.to(targetSocketId).emit("message", {
          from: data.from,
          encrypted: data.encrypted,
          timestamp: Date.now(),
        });
        console.log(`[Relay] Message delivered: ${data.from} -> ${data.to}`);
      } else {
        const pending = pendingMessages.get(data.to) || [];
        pending.push({
          from: data.from,
          to: data.to,
          encrypted: data.encrypted,
          timestamp: Date.now(),
        });
        pendingMessages.set(data.to, pending);
        console.log(`[Relay] Message queued for offline user: ${data.to}`);
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
