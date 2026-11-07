import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { type AuthenticatedRequest, requireAuth } from "../auth/requireAuth";
import { TaskModel } from "../models/Task";
import { GeminiError } from "../services/gemini";
import { suggestSubtasks } from "../services/taskBreakdown";

// Mounted inside the authenticated task router, after its expiration middleware.
const router = Router();
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
    const parent = await TaskModel.exists({ _id: request.params.taskId, userId, parentTaskId: null, deletedAt: null });
    if (!parent) {
      response.status(404).json({ error: "Task not found." });
      return;
    }
    const subtasks = await TaskModel.find({ userId, parentTaskId: request.params.taskId, deletedAt: null }).sort({ createdAt: 1, _id: 1 });
    response.set("Cache-Control", "no-store").json({ subtasks });
  } catch (error) { next(error); }
});

router.post("/:taskId/breakdown", async (request, response, next) => {
  try {
    const task = await TaskModel.findOne({ _id: request.params.taskId, userId: owner(request), parentTaskId: null, deletedAt: null, status: "active" });
    if (!task) {
      response.status(404).json({ error: "Active task not found." });
      return;
    }
    if (await TaskModel.exists({ userId: owner(request), parentTaskId: task._id, deletedAt: null })) {
      response.status(409).json({ error: "This task already has steps. Reopen its details to view them." });
      return;
    }
    const suggestions = await suggestSubtasks(task);
    response.set("Cache-Control", "no-store").json({ suggestions });
  } catch (error) {
    if (error instanceof GeminiError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post("/:taskId/subtasks", async (request, response, next) => {
  const input: unknown = request.body?.titles;
  if (!Array.isArray(input) || !input.length || input.length > 20 || input.some(title => typeof title !== "string" || !title.trim() || title.trim().length > 200)) {
    response.status(400).json({ error: "Provide between 1 and 20 step titles, each no more than 200 characters." });
    return;
  }
  const titles = (input as string[]).map(title => title.trim());
  if (new Set(titles.map(title => title.toLowerCase())).size !== titles.length) {
    response.status(400).json({ error: "Each step needs a different title." });
    return;
  }
  try {
    const userId = owner(request);
    const parent = await TaskModel.findOne({ _id: request.params.taskId, userId, parentTaskId: null, deletedAt: null, status: "active" });
    if (!parent) {
      response.status(404).json({ error: "Active task not found." });
      return;
    }
    if (await TaskModel.exists({ userId, parentTaskId: parent._id, deletedAt: null })) {
      response.status(409).json({ error: "This task already has steps. Reopen its details to view them." });
      return;
    }
    await TaskModel.init();
    const subtasks = await TaskModel.insertMany(titles.map(title => ({
      userId, parentTaskId: parent._id, title, taskType: "personal",
    })));
    response.status(201).json({ subtasks });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      response.status(409).json({ error: "These steps have already been saved. Reopen the task to view them." });
      return;
    }
    next(error);
  }
});

router.patch("/:taskId/subtasks/:subtaskId", async (request, response, next) => {
  if (!isValidObjectId(request.params.subtaskId) || typeof request.body?.completed !== "boolean") {
    response.status(400).json({ error: "Provide a valid step ID and completion state." });
    return;
  }
  try {
    const userId = owner(request);
    const parent = await TaskModel.exists({ _id: request.params.taskId, userId, parentTaskId: null, deletedAt: null, status: "active" });
    if (!parent) {
      response.status(404).json({ error: "Active task not found." });
      return;
    }
    const subtask = await TaskModel.findOneAndUpdate(
      { _id: request.params.subtaskId, userId, parentTaskId: request.params.taskId, deletedAt: null, status: { $ne: "expired" } },
      { $set: { status: request.body.completed ? "completed" : "active", completedAt: request.body.completed ? new Date() : null } },
      { returnDocument: "after", runValidators: true },
    );
    if (!subtask) {
      response.status(404).json({ error: "Step not found or expired." });
      return;
    }
    response.json({ subtask });
  } catch (error) { next(error); }
});

export default router;
