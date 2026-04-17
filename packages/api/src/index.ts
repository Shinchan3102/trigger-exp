import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chatRoutes } from "./routes/chat.js";

// Ensure DB is initialized on startup
import "./db/index.js";

const app = new Hono();

// Enable CORS for the web frontend
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "trigger-exp-api" }));

// Chat routes
app.route("/api/chat", chatRoutes);

const port = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 API server running on http://localhost:${port}`);
});
