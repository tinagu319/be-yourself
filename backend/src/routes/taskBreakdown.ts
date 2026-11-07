import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth";
import { TaskModel } from "../models/Task";
import { GeminiError } from "../services/gemini";
import { suggestSubtasks } from "../services/taskBreakdown";

// Authentication and expiration are handled by the parent task router.
const router = Router();
const splitting = new Set<string>();
const owner = (request: Parameters<typeof requireAuth>[0]) => (request as AuthenticatedRequest).userId;

router.use("/:taskId", (request, response, next) => {
  if (!isValidObjectId(request.params.taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }
  next();
});

router.get("/:taskId/subtasks", async (request, response, next) => {
  try {
    const userId = owner(request);
    const task = await TaskModel.exists({ _id: request.params.taskId, userId, deletedAt: null });
    if (!task) {
      response.status(404).json({ error: "Task not found." });
      return;
    }
    const subtasks = await TaskModel.find({ userId, parentTaskId: request.params.taskId, deletedAt: null }).sort({ createdAt: 1, _id: 1 });
    response.set("Cache-Control", "no-store").json({ subtasks });
  } catch (error) { next(error); }
});

router.post("/:taskId/breakdown", async (request, response, next) => {
  const userId = owner(request);
  const key = `${userId}/${request.params.taskId}`;
  if (splitting.has(key)) {
    response.status(409).json({ error: "This task is already being split. Please wait." });
    return;
  }
  splitting.add(key);
  try {
    const filter = { _id: request.params.taskId, userId, deletedAt: null, status: { $in: ["active", "completed"] as const } };
    const task = await TaskModel.findOne(filter);
    if (!task) {
      response.status(404).json({ error: "Task not found or expired." });
      return;
    }
    const titles = await suggestSubtasks(task);
    const current = await TaskModel.findOne(filter);
    const now = new Date();
    if (!current || (current.status === "active" && current.taskType === "personal" && current.deadline && current.deadline <= now)) {
      response.status(409).json({ error: "This task changed or expired. Refresh your tasks and try again." });
      return;
    }
    const completed = current.status === "completed";
    const tasks = await TaskModel.insertMany(titles.map(title => ({
      userId,
      parentTaskId: current._id,
      title,
      taskType: "personal",
      plannedStartAt: current.plannedStartAt,
      deadline: current.deadline,
      status: completed ? "completed" : "active",
      completedAt: completed ? now : null,
      createdAt: now,
    })));
    response.status(201).set("Cache-Control", "no-store").json({ tasks });
  } catch (error) {
    if (error instanceof GeminiError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  } finally {
    splitting.delete(key);
  }
});

export default router;
