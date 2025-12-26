import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";

interface PendingMessage {
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
}

const pendingMessages = new Map<string, PendingMessage[]>();
const connectedUsers = new Map<string, string>();

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
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
      const { to, from, encrypted } = data;
      const recipientSocketId = connectedUsers.get(to);

      const message: PendingMessage = {
        from,
        to,
        encrypted,
        timestamp: Date.now(),
      };

      if (recipientSocketId) {
        io.to(recipientSocketId).emit("message", message);
        console.log(`[Relay] Message delivered: ${from} -> ${to}`);
      } else {
        const pending = pendingMessages.get(to) || [];
        pending.push(message);
        pendingMessages.set(to, pending);
        console.log(`[Relay] Message queued: ${from} -> ${to}`);

        setTimeout(() => {
          const current = pendingMessages.get(to);
          if (current) {
            const filtered = current.filter((m) => m.timestamp !== message.timestamp);
            if (filtered.length > 0) {
              pendingMessages.set(to, filtered);
            } else {
              pendingMessages.delete(to);
            }
          }
        }, 60000);
      }

      socket.emit("message_ack", { timestamp: message.timestamp, status: "sent" });
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

  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      relay: "active",
      connectedUsers: connectedUsers.size,
      policy: "no-log"
    });
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      connectedUsers: connectedUsers.size,
      pendingMessages: pendingMessages.size,
    });
  });

  return httpServer;
}
