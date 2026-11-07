import { Router } from "express";
import { isValidObjectId } from "mongoose";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { DailyRecordModel } from "../models/DailyRecord";
import { parseLocalDate, recordUserActivity } from "../services/userActivity";

const router = Router();
router.use(requireAuth);

function getUserId(request: Parameters<typeof requireAuth>[0]) {
  return (request as AuthenticatedRequest).userId;
}

function todayContext(date: unknown, timeZone: unknown) {
  parseLocalDate(date);
  if (typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 100) throw new RangeError();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  if (date !== `${value("year")}-${value("month")}-${value("day")}`) throw new RangeError();
  return { date: date as string, timeZone };
}

router.get("/", async (request, response, next) => {
  try {
    const { date } = todayContext(request.query.date, request.query.timeZone);
    const record = await DailyRecordModel.findOne({ userId: getUserId(request), date })
      .select("activities").lean();
    response.set("Cache-Control", "no-store").json({ date, activities: record?.activities ?? [] });
  } catch (error) {
    if (error instanceof RangeError) {
      response.status(400).json({ error: "Provide today's local date and a valid time zone." });
      return;
    }
    next(error);
  }
});

router.post("/", async (request, response, next) => {
  const text = typeof request.body?.text === "string" ? request.body.text.trim() : "";
  if (!text || text.length > 2000) {
    response.status(400).json({ error: "Enter an activity between 1 and 2,000 characters." });
    return;
  }
  try {
    const { date, timeZone } = todayContext(request.body?.date, request.body?.timeZone);
    const userId = getUserId(request);
    await recordUserActivity(userId, date, timeZone);
    const record = await DailyRecordModel.findOneAndUpdate(
      { userId, date },
      { $push: { activities: { text, recordedAt: new Date() } } },
      { returnDocument: "after", runValidators: true },
    ).select("activities");
    response.status(201).set("Cache-Control", "no-store").json({ date, activities: record?.activities ?? [] });
  } catch (error) {
    if (error instanceof RangeError) {
      response.status(400).json({ error: "Provide today's local date and a valid time zone." });
      return;
    }
    next(error);
  }
});

router.delete("/:activityId", async (request, response, next) => {
  if (!isValidObjectId(request.params.activityId)) {
    response.status(400).json({ error: "Activity ID is invalid." });
    return;
  }
  try {
    const { date } = todayContext(request.body?.date, request.body?.timeZone);
    const record = await DailyRecordModel.findOneAndUpdate(
      { userId: getUserId(request), date, "activities._id": request.params.activityId },
      { $pull: { activities: { _id: request.params.activityId } } },
      { returnDocument: "after" },
    ).select("activities");
    if (!record) {
      response.status(404).json({ error: "Activity not found." });
      return;
    }
    response.set("Cache-Control", "no-store").json({ date, activities: record.activities });
  } catch (error) {
    if (error instanceof RangeError) {
      response.status(400).json({ error: "Provide today's local date and a valid time zone." });
      return;
    }
    next(error);
  }
});

export default router;
