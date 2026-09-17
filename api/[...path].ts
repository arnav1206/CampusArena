// Vercel maps api/index.ts to /api only. This catch-all function serves the
// nested endpoints used by the React client, such as /api/auth/password/login.
// It is intentionally self-contained: Vercel bundles each API entrypoint
// independently, so sibling-module imports would not be available at runtime.
import express from "express";
import { apiRouter } from "../server/routes";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/api", apiRouter);

export default app;
