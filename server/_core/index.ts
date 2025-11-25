import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

/**
 * Utility: check if a TCP port is available on this machine.
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

/**
 * Find an available port starting at startPort (tries a small range).
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();

  // When running behind a proxy (Render / Cloudflare), trust it so cookies/secure behave correctly.
  app.set("trust proxy", 1);

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  /**
   * CORS configuration
   * - credentials: true for cross-origin requests
   * - origin is validated and echoed back (cors package will send the specific origin).
   */
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) return callback(null, true);

        // Allow localhost for dev
        if (origin.includes("localhost")) return callback(null, true);

        // Allow Vercel preview/prod domains
        if (origin.includes(".vercel.app")) return callback(null, true);

        // Add any additional allowed hosts here
        const allowedOrigins = [
          "https://money-goal-app.vercel.app",
          "https://dynamic-brioche-f9291c.netlify.app",
        ];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // Default: block
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Register OAuth routes
  registerOAuthRoutes(app);

  // tRPC API with JWT Bearer token authentication
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve client: dev uses Vite, prod uses static files if present
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, createServer(app));
  } else {
    const clientDistPath = path.resolve(process.cwd(), "client", "dist");
    if (fs.existsSync(clientDistPath)) {
      console.log("[Server] Serving static client from", clientDistPath);
      serveStatic(app);
    } else {
      console.log("[Server] client/dist not found — static client will not be served.");
      app.get("/", (req, res) => {
        res.json({ ok: true, note: "Backend running — client not served from this host." });
      });
    }
  }

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const server = createServer(app);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
