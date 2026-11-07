import { Router } from "express";
import { isValidObjectId, Types } from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { StudySessionModel } from "../models/StudySession";
import { AVAILABLE_TIME_MULTIPLIERS, TaskModel } from "../models/Task";

const router = Router();
router.use(requireAuth);

function userId(request: Parameters<typeof requireAuth>[0]) {
  return (request as AuthenticatedRequest).userId;
}

function isMultiplier(value: unknown): value is (typeof AVAILABLE_TIME_MULTIPLIERS)[number] {
  return typeof value === "number" && AVAILABLE_TIME_MULTIPLIERS.some((allowed) => allowed === value);
}

function sessionIdIsValid(id: string) {
  return isValidObjectId(id);
}

function currentMultiplier(session: { segments: Array<{ multiplier: number }> }) {
  const multiplier = session.segments.at(-1)?.multiplier ?? 1;
  return multiplier === 20 ? 10 : multiplier;
}

type SessionForSettlement = {
  segments: Array<{
    startedAt: Date;
    endedAt?: Date | null;
    multiplier: number;
    realDurationMs: number;
    virtualDurationMs: number;
  }>;
  realDurationMs: number;
  virtualDurationMs: number;
};

async function settleOpenSegment(
  session: SessionForSettlement,
  endedAt: Date,
) {
  const openSegment = [...session.segments].reverse().find((segment) => !segment.endedAt);
  if (!openSegment) return;

  const realDurationMs = Math.max(0, endedAt.getTime() - openSegment.startedAt.getTime());
  const virtualDurationMs = realDurationMs * openSegment.multiplier;
  openSegment.endedAt = endedAt;
  openSegment.realDurationMs = realDurationMs;
  openSegment.virtualDurationMs = virtualDurationMs;
  session.realDurationMs += realDurationMs;
  session.virtualDurationMs += virtualDurationMs;
}

async function updateTaskTotals(session: { userId: Types.ObjectId; taskId: Types.ObjectId }) {
  const [totals] = await StudySessionModel.aggregate([
    { $match: { userId: session.userId, taskId: session.taskId, status: "completed" } },
    {
      $group: {
        _id: null,
        realDurationMs: { $sum: "$realDurationMs" },
        virtualDurationMs: { $sum: "$virtualDurationMs" },
      },
    },
  ]);
  await TaskModel.updateOne(
    { _id: session.taskId, userId: session.userId },
    { $set: { realDurationMs: totals?.realDurationMs ?? 0, virtualDurationMs: totals?.virtualDurationMs ?? 0 } },
  );
}

router.get("/active", async (request, response, next) => {
  const taskId = request.query.taskId;
  if (taskId !== undefined && (typeof taskId !== "string" || !sessionIdIsValid(taskId))) {
    response.status(400).json({ error: "Task ID is invalid." });
    return;
  }
  try {
    const query = {
      userId: userId(request),
      status: { $in: ["running", "paused"] as const },
      ...(typeof taskId === "string" ? { taskId: new Types.ObjectId(taskId) } : {}),
    };
    const session = await StudySessionModel.findOne(query).sort({ startedAt: -1 });
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  const { taskId, multiplier } = request.body ?? {};
  if (typeof taskId !== "string" || !sessionIdIsValid(taskId)) {
    response.status(400).json({ error: "A valid taskId is required." });
    return;
  }
  if (!isMultiplier(multiplier)) {
    response.status(400).json({ error: "Choose Gentle Focus, Deep Focus, or Super Focus." });
    return;
  }

  try {
    const ownerId = userId(request);
    const task = await TaskModel.findOne({ _id: taskId, userId: ownerId, deletedAt: null, status: { $ne: "expired" } });
    if (!task) {
      response.status(404).json({ error: "Task not found or expired." });
      return;
    }

    const runningSession = await StudySessionModel.findOne({ userId: ownerId, status: "running" });
    if (runningSession && runningSession.taskId.toString() !== taskId) {
      response.status(409).json({ error: "Pause or end the current work session first." });
      return;
    }

    const existing = await StudySessionModel.findOne({
      userId: ownerId,
      taskId,
      status: { $in: ["running", "paused"] },
    }).sort({ startedAt: -1 });
    if (existing) {
      response.json({ session: existing });
      return;
    }

    const startedAt = new Date();
    const session = await StudySessionModel.create({
      userId: ownerId,
      taskId,
      status: "running",
      startedAt,
      segments: [{ startedAt, multiplier }],
    });
    response.status(201).json({ session });
  } catch (error) {
    next(error);
  }
});

router.patch("/:sessionId/pause", async (request, response, next) => {
  const { sessionId } = request.params;
  if (!sessionIdIsValid(sessionId)) {
    response.status(400).json({ error: "Session ID is invalid." });
    return;
  }
  try {
    const session = await StudySessionModel.findOne({ _id: sessionId, userId: userId(request), status: "running" });
    if (!session) {
      response.status(404).json({ error: "Running session not found." });
      return;
    }
    await settleOpenSegment(session, new Date());
    session.status = "paused";
    await session.save();
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

router.patch("/:sessionId/resume", async (request, response, next) => {
  const { sessionId } = request.params;
  const requestedMultiplier = request.body?.multiplier;
  if (!sessionIdIsValid(sessionId)) {
    response.status(400).json({ error: "Session ID is invalid." });
    return;
  }
  if (requestedMultiplier !== undefined && !isMultiplier(requestedMultiplier)) {
    response.status(400).json({ error: "Choose Gentle Focus, Deep Focus, or Super Focus." });
    return;
  }
  try {
    const session = await StudySessionModel.findOne({ _id: sessionId, userId: userId(request), status: "paused" });
    if (!session) {
      response.status(404).json({ error: "Paused session not found." });
      return;
    }
    session.segments.push({ startedAt: new Date(), multiplier: requestedMultiplier ?? currentMultiplier(session) });
    session.status = "running";
    await session.save();
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

router.patch("/:sessionId/multiplier", async (request, response, next) => {
  const { sessionId } = request.params;
  const multiplier = request.body?.multiplier;
  if (!sessionIdIsValid(sessionId)) {
    response.status(400).json({ error: "Session ID is invalid." });
    return;
  }
  if (!isMultiplier(multiplier)) {
    response.status(400).json({ error: "Choose Gentle Focus, Deep Focus, or Super Focus." });
    return;
  }
  try {
    const session = await StudySessionModel.findOne({ _id: sessionId, userId: userId(request), status: "running" });
    if (!session) {
      response.status(404).json({ error: "Running session not found." });
      return;
    }
    const now = new Date();
    await settleOpenSegment(session, now);
    session.segments.push({ startedAt: now, multiplier });
    await session.save();
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

router.patch("/:sessionId/stop", async (request, response, next) => {
  const { sessionId } = request.params;
  if (!sessionIdIsValid(sessionId)) {
    response.status(400).json({ error: "Session ID is invalid." });
    return;
  }
  try {
    const session = await StudySessionModel.findOne({
      _id: sessionId,
      userId: userId(request),
      status: { $in: ["running", "paused"] },
    });
    if (!session) {
      response.status(404).json({ error: "Active session not found." });
      return;
    }
    const now = new Date();
    if (session.status === "running") await settleOpenSegment(session, now);
    session.status = "completed";
    session.endedAt = now;
    await session.save();
    await updateTaskTotals(session);
    response.json({ session });
  } catch (error) {
    next(error);
  }
});

export default router;
