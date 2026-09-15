import express from "express";
import { apiRouter } from "../server/routes";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", apiRouter);

export default app;
