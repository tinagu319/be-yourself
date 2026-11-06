import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { ensureDailyHealthChallengeTasks } from "../models/healthChallenges";
import { TaskModel } from "../models/Task";

const router = Router();
router.use(requireAuth);

function getUserId(request: Parameters<typeof requireAuth>[0]) {
  return (request as AuthenticatedRequest).userId;
}

function parseDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function dayBounds(dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

router.get("/", async (request, response, next) => {
  const date = parseDateKey(request.query.date);
  if (!date) {
    response.status(400).json({ error: "Provide the user's local date as YYYY-MM-DD in the date query parameter." });
    return;
  }

  const userId = getUserId(request);
  const { start, end } = dayBounds(date);
  try {
    await ensureDailyHealthChallengeTasks(userId, date);
    await TaskModel.updateMany(
      { userId, taskType: "personal", status: "active", deletedAt: null, deadline: { $lt: start, $ne: null } },
      { $set: { status: "expired", expiredAt: new Date() } },
    );

    const tasks = await TaskModel.find({
      userId,
      deletedAt: null,
      $or: [
        { taskType: "health-challenge", activityDate: date },
        { taskType: "personal", status: "active", $or: [{ deadline: null }, { deadline: { $gte: start } }] },
        { taskType: "personal", status: "completed", completedAt: { $gte: start, $lt: end } },
      ],
    }).sort({ taskType: 1, createdAt: -1 });
    response.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
  const deadlineValue = request.body?.deadline;
  if (!title || title.length > 200) {
    response.status(400).json({ error: "Task title is required and must be 200 characters or fewer." });
    return;
  }
  if (description.length > 10000) {
    response.status(400).json({ error: "Task description must be 10,000 characters or fewer." });
    return;
  }

  let deadline: Date | null = null;
  if (deadlineValue !== undefined && deadlineValue !== null && deadlineValue !== "") {
    if (typeof deadlineValue !== "string" || Number.isNaN(Date.parse(deadlineValue))) {
      response.status(400).json({ error: "Deadline must be a valid ISO 8601 date or timestamp." });
      return;
    }
    deadline = new Date(deadlineValue);
  }

  try {
    const task = await TaskModel.create({
      userId: getUserId(request),
      title,
      description,
      deadline,
      taskType: "personal",
    });
    response.status(201).json({ task });
  } catch (error) {
    next(error);
  }
});

router.patch("/:taskId/completion", async (request, response, next) => {
  const { taskId } = request.params;
  const completed = request.body?.completed;
  if (!isValidObjectId(taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }
  if (typeof completed !== "boolean") {
    response.status(400).json({ error: "completed must be true or false." });
    return;
  }

  try {
    const task = await TaskModel.findOneAndUpdate(
      { _id: taskId, userId: getUserId(request), deletedAt: null, status: { $ne: "expired" } },
      {
        $set: {
          status: completed ? "completed" : "active",
          completedAt: completed ? new Date() : null,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!task) {
      response.status(404).json({ error: "Task not found or expired." });
      return;
    }
    response.json({ task });
  } catch (error) {
    next(error);
  }
});

router.patch("/:taskId", async (request, response, next) => {
  const { taskId } = request.params;
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  if (!isValidObjectId(taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }
  if (!title || title.length > 200) {
    response.status(400).json({ error: "Task title is required and must be 200 characters or fewer." });
    return;
  }

  try {
    const task = await TaskModel.findOneAndUpdate(
      { _id: taskId, userId: getUserId(request), deletedAt: null },
      { $set: { title } },
      { returnDocument: "after", runValidators: true },
    );
    if (!task) {
      response.status(404).json({ error: "Task not found." });
      return;
    }
    response.json({ task });
  } catch (error) {
    next(error);
  }
});

router.delete("/:taskId", async (request, response, next) => {
  const { taskId } = request.params;
  if (!isValidObjectId(taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }

  try {
    const task = await TaskModel.findOneAndUpdate(
      { _id: taskId, userId: getUserId(request), deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!task) {
      response.status(404).json({ error: "Task not found." });
      return;
    }
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
