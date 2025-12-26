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

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`[Relay] New connection: ${socket.id}`);

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
      const timestamp = Date.now();

      const recipientSocketId = connectedUsers.get(to);

      if (recipientSocketId) {
        io.to(recipientSocketId).emit("message", {
          from,
          to,
          encrypted,
          timestamp,
        });
        console.log(`[Relay] Message relayed: ${from} -> ${to}`);

        socket.emit("delivered", { to, timestamp });
      } else {
        let pending = pendingMessages.get(to);
        if (!pending) {
          pending = [];
          pendingMessages.set(to, pending);
        }
        pending.push({ from, to, encrypted, timestamp });

        setTimeout(() => {
          const msgs = pendingMessages.get(to);
          if (msgs) {
            const filtered = msgs.filter((m) => m.timestamp !== timestamp);
            if (filtered.length === 0) {
              pendingMessages.delete(to);
            } else {
              pendingMessages.set(to, filtered);
            }
          }
        }, 5 * 60 * 1000);

        console.log(`[Relay] User ${to} offline, message queued (5min TTL)`);
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

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      relay: "active",
      users: connectedUsers.size,
      policy: "no-log",
    });
  });

  app.get("/api/status", (_req, res) => {
    res.json({
      version: "1.0.0",
      protocol: "ciphernode-relay-v1",
      features: ["e2ee", "relay", "no-log"],
      connectedUsers: connectedUsers.size,
    });
  });

  return httpServer;
}
