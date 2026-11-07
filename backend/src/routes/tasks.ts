import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { ensureDailyHealthChallengeTasks } from "../models/healthChallenges";
import { StudySessionModel } from "../models/StudySession";
import { TaskModel } from "../models/Task";
import taskBreakdownRoutes from "./taskBreakdown";

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

// Apply expiration before task reads and writes, including direct detail links.
router.use(async (request, _response, next) => {
  const now = new Date();
  try {
    await TaskModel.updateMany(
      { userId: getUserId(request), taskType: "personal", status: "active", deletedAt: null, deadline: { $lte: now, $ne: null } },
      { $set: { status: "expired", expiredAt: now } },
    );
    next();
  } catch (error) {
    next(error);
  }
});

router.use(taskBreakdownRoutes);

router.get("/", async (request, response, next) => {
  const date = parseDateKey(request.query.date);
  if (!date) {
    response.status(400).json({ error: "Provide the user's local date as YYYY-MM-DD in the date query parameter." });
    return;
  }

  const userId = getUserId(request);
  const { start, end } = dayBounds(date);
  const now = new Date();
  try {
    await ensureDailyHealthChallengeTasks(userId, date);
    const tasks = await TaskModel.find({
      userId,
      parentTaskId: null,
      deletedAt: null,
      $or: [
        { taskType: "health-challenge", activityDate: date },
        { taskType: "personal", status: "active", $or: [{ deadline: null }, { deadline: { $gt: now } }] },
        { taskType: "personal", status: "completed", completedAt: { $gte: start, $lt: end } },
      ],
    }).sort({ taskType: 1, createdAt: -1 });
    response.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.get("/:taskId", async (request, response, next) => {
  const { taskId } = request.params;
  if (!isValidObjectId(taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }
  try {
    const ownerId = getUserId(request);
    const task = await TaskModel.findOne({ _id: taskId, userId: ownerId, deletedAt: null });
    if (!task) {
      response.status(404).json({ error: "Task not found." });
      return;
    }
    const sessions = await StudySessionModel.find({ userId: ownerId, taskId: task._id })
      .select("startedAt endedAt status")
      .sort({ startedAt: 1 })
      .lean();
    const finishedSessions = sessions.filter(session => session.endedAt);
    response.json({
      task,
      firstStudyStartedAt: sessions[0]?.startedAt ?? null,
      lastSessionEndedAt: finishedSessions.at(-1)?.endedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  const title = typeof request.body?.title === "string" ? request.body.title.trim() : "";
  const description = typeof request.body?.description === "string" ? request.body.description.trim() : "";
  const plannedStartValue = request.body?.plannedStartAt;
  const deadlineValue = request.body?.deadline;
  if (!title || title.length > 200) {
    response.status(400).json({ error: "Task title is required and must be 200 characters or fewer." });
    return;
  }
  if (description.length > 10000) {
    response.status(400).json({ error: "Task description must be 10,000 characters or fewer." });
    return;
  }

  const parseOptionalDate = (value: unknown, label: string) => {
    if (value === undefined || value === null || value === "") return { value: null as Date | null };
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { error: `${label} must be a valid ISO 8601 date or timestamp.` };
    return { value: new Date(value) };
  };
  const plannedStart = parseOptionalDate(plannedStartValue, "Planned start");
  const deadline = parseOptionalDate(deadlineValue, "Deadline");
  if (plannedStart.error || deadline.error) {
    response.status(400).json({ error: plannedStart.error || deadline.error });
    return;
  }
  if (plannedStart.value && deadline.value && deadline.value <= plannedStart.value) {
    response.status(400).json({ error: "Planned finish must be after planned start." });
    return;
  }

  try {
    const now = new Date();
    const expired = deadline.value && deadline.value <= now;
    const task = await TaskModel.create({
      userId: getUserId(request),
      title,
      description,
      plannedStartAt: plannedStart.value,
      deadline: deadline.value,
      taskType: "personal",
      status: expired ? "expired" : "active",
      expiredAt: expired ? now : null,
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
    const now = new Date();
    const task = await TaskModel.findOneAndUpdate(
      {
        _id: taskId, userId: getUserId(request), deletedAt: null, status: { $ne: "expired" },
        $or: [{ taskType: "health-challenge" }, { deadline: null }, { deadline: { $gt: now } }, { status: "completed" }],
      },
      {
        $set: {
          status: completed ? "completed" : "active",
          completedAt: completed ? now : null,
        },
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!task) {
      response.status(404).json({ error: "Task not found or expired." });
      return;
    }
    if (!completed && task.taskType === "personal" && task.deadline && task.deadline <= now) {
      task.status = "expired";
      task.expiredAt = now;
      await task.save();
    }
    response.json({ task });
  } catch (error) {
    next(error);
  }
});

router.patch("/:taskId", async (request, response, next) => {
  const { taskId } = request.params;
  if (!isValidObjectId(taskId)) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }

  const updates: { title?: string; description?: string; plannedStartAt?: Date | null; deadline?: Date | null } = {};
  if (request.body?.title !== undefined) {
    const title = typeof request.body.title === "string" ? request.body.title.trim() : "";
    if (!title || title.length > 200) {
      response.status(400).json({ error: "Task title is required and must be 200 characters or fewer." });
      return;
    }
    updates.title = title;
  }
  if (request.body?.description !== undefined) {
    if (typeof request.body.description !== "string" || request.body.description.length > 10000) {
      response.status(400).json({ error: "Task description must be 10,000 characters or fewer." });
      return;
    }
    updates.description = request.body.description.trim();
  }
  for (const [field, label] of [["plannedStartAt", "Planned start"], ["deadline", "Planned finish"]] as const) {
    if (request.body?.[field] === undefined) continue;
    const value = request.body[field];
    if (value === null || value === "") updates[field] = null;
    else if (typeof value === "string" && !Number.isNaN(Date.parse(value))) updates[field] = new Date(value);
    else {
      response.status(400).json({ error: `${label} must be a valid ISO 8601 date or timestamp.` });
      return;
    }
  }
  if (Object.keys(updates).length === 0) {
    response.status(400).json({ error: "Provide at least one task field to update." });
    return;
  }

  try {
    const current = await TaskModel.findOne({ _id: taskId, userId: getUserId(request), deletedAt: null }).select("plannedStartAt deadline status taskType");
    if (!current || current.status === "expired") {
      response.status(404).json({ error: "Task not found or expired." });
      return;
    }
    const nextStart = updates.plannedStartAt !== undefined ? updates.plannedStartAt : current.plannedStartAt;
    const nextDeadline = updates.deadline !== undefined ? updates.deadline : current.deadline;
    if (nextStart && nextDeadline && nextDeadline <= nextStart) {
      response.status(400).json({ error: "Planned finish must be after planned start." });
      return;
    }
    const now = new Date();
    const expired = current.taskType === "personal" && current.status === "active" && nextDeadline && nextDeadline <= now;
    const task = await TaskModel.findOneAndUpdate(
      { _id: taskId, userId: getUserId(request), deletedAt: null, status: { $ne: "expired" } },
      { $set: { ...updates, ...(expired ? { status: "expired", expiredAt: now } : {}) } },
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
    await TaskModel.updateMany(
      { userId: getUserId(request), parentTaskId: task._id, deletedAt: null },
      { $set: { deletedAt: task.deletedAt } },
    );
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
