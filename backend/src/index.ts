import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "./config/database";
import authRoutes from "./routes/auth";
import aiRoutes from "./routes/ai";
import studySessionRoutes from "./routes/studySessions";
import taskRoutes from "./routes/tasks";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/study-sessions", studySessionRoutes);

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

const apiErrorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  console.error("API request failed:", error);
  response.status(500).json({ error: "Something went wrong. Please try again." });
};

app.use(apiErrorHandler);

async function startServer() {
  try {
    await connectToDatabase();
    app.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Backend startup failed:", error);
    process.exitCode = 1;
  }
}

void startServer();
