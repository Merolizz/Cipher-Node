import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketIOServer } from "socket.io";

interface QueuedMessage {
  from: string;
  to: string;
  encrypted: string;
  timestamp: number;
}

const messageQueue = new Map<string, QueuedMessage[]>();
const connectedUsers = new Map<string, string>();

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  app.get("/api/stats", (_req, res) => {
    res.json({
      connectedUsers: connectedUsers.size,
      queuedMessages: Array.from(messageQueue.values()).reduce(
        (acc, msgs) => acc + msgs.length,
        0
      ),
    });
  });

  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on("register", (userId: string) => {
      connectedUsers.set(userId, socket.id);
      socket.data.userId = userId;
      console.log(`[Socket] User registered: ${userId}`);

      const queued = messageQueue.get(userId);
      if (queued && queued.length > 0) {
        queued.forEach((msg) => {
          socket.emit("message", msg);
        });
        messageQueue.delete(userId);
        console.log(`[Socket] Delivered ${queued.length} queued messages to ${userId}`);
      }
    });

    socket.on("message", (data: { to: string; encrypted: string }) => {
      const from = socket.data.userId;
      if (!from) {
        socket.emit("error", { message: "Not registered" });
        return;
      }

      const message: QueuedMessage = {
        from,
        to: data.to,
        encrypted: data.encrypted,
        timestamp: Date.now(),
      };

      const recipientSocketId = connectedUsers.get(data.to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit("message", message);
        console.log(`[Socket] Message relayed: ${from} -> ${data.to}`);
      } else {
        const queue = messageQueue.get(data.to) || [];
        queue.push(message);
        messageQueue.set(data.to, queue);
        console.log(`[Socket] Message queued for offline user: ${data.to}`);
      }

      socket.emit("message:sent", { to: data.to, timestamp: message.timestamp });
    });

    socket.on("disconnect", () => {
      const userId = socket.data.userId;
      if (userId) {
        connectedUsers.delete(userId);
        console.log(`[Socket] User disconnected: ${userId}`);
      }
    });
  });

  setInterval(() => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [userId, messages] of messageQueue.entries()) {
      const filtered = messages.filter((msg) => now - msg.timestamp < maxAge);
      if (filtered.length === 0) {
        messageQueue.delete(userId);
      } else if (filtered.length !== messages.length) {
        messageQueue.set(userId, filtered);
      }
    }
  }, 60 * 60 * 1000);

  return httpServer;
}
