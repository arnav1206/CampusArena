import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Body parsers
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Request logger
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (req.url.startsWith("/api")) {
        console.log(`[API] ${req.method} ${req.url} ${res.statusCode} in ${Date.now() - start}ms`);
      }
    });
    next();
  });

  // Mount API router
  app.use("/api", apiRouter);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all non-api routes
  app.get("*", (req, res, next) => {
    if (req.url.startsWith("/api")) return next();
    res.sendFile(path.join(staticPath, "index.html"), (err) => {
      if (err) {
        // In dev when dist/public might not be built yet, respond with API health
        res.status(200).send("Campus Arena API Server Running. Start Vite client dev server to view UI.");
      }
    });
  });

  const port = process.env.PORT || 5000;

  server.listen(port, () => {
    console.log(`[SERVER] Campus Arena Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
