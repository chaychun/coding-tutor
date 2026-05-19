import express from "express";
import cors from "cors";
import { initDatabase, closeDatabase } from "./database";
import { router } from "./routes";
import { handleChatStart, handleChatEvents, handleChatAbort } from "./chatRoute";
import { handleVerify } from "./verifyRoute";

// Read configuration from environment (injected by Rust shell)
const PREFERRED_PORT = parseInt(process.env.PORT || "3001", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const DATABASE_PATH = process.env.DATABASE_PATH || "./data.db";

// Initialize database
console.log(`[sidecar] Initializing database at ${DATABASE_PATH}`);
initDatabase(DATABASE_PATH);

// Create Express app
const app = express();

// CORS — allow requests from the Tauri webview
app.use(
  cors({
    origin: true, // Allow all origins (localhost with varying ports)
    credentials: true,
  })
);

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));

// Auth middleware — verify bearer token on every request
if (AUTH_TOKEN) {
  app.use((req, res, next) => {
    // Skip auth for health check
    if (req.path === "/health") {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${AUTH_TOKEN}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  });
}

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use(router);

// Chat endpoints — backend owns the agent loop; clients subscribe to events.
app.post("/api/chat", handleChatStart);
app.get("/api/projects/:projectId/sessions/:sessionId/chat/events", handleChatEvents);
app.post("/api/projects/:projectId/sessions/:sessionId/chat/abort", handleChatAbort);

// Credential verification — runs a tiny Agent SDK call to confirm auth works
app.post("/api/verify-credential", handleVerify);

// Start server — try preferred port, then auto-increment if taken
function startServer(port: number, maxAttempts = 10): void {
  const server = app.listen(port, "127.0.0.1", () => {
    console.log(`[sidecar] Server listening on http://127.0.0.1:${port}`);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && port - PREFERRED_PORT < maxAttempts) {
      console.warn(`[sidecar] Port ${port} in use, trying ${port + 1}...`);
      startServer(port + 1, maxAttempts);
    } else {
      console.error(`[sidecar] Failed to start server:`, err.message);
      process.exit(1);
    }
  });

  // Graceful shutdown
  function shutdown() {
    console.log("[sidecar] Shutting down...");
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startServer(PREFERRED_PORT);
