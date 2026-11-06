import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import { connectToDatabase } from "./config/database";
import authRoutes from "./routes/auth";
import studySessionRoutes from "./routes/studySessions";
import taskRoutes from "./routes/tasks";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/study-sessions", studySessionRoutes);

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

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
