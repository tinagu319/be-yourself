import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { recordUserActivity } from "../services/userActivity";

const router = Router();
router.use(requireAuth);

router.post("/", async (request, response, next) => {
  const { date, timeZone } = request.body ?? {};
  if (typeof date !== "string" || typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 100) {
    response.status(400).json({ error: "Provide your local date and time zone." });
    return;
  }
  try {
    const activity = await recordUserActivity((request as AuthenticatedRequest).userId, date, timeZone);
    response.set("Cache-Control", "no-store").json({
      date: activity.localDate,
      journeyDay: activity.journeyDay,
      currentStreak: activity.currentStreak,
      totalActiveDays: activity.totalActiveDays,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      response.status(400).json({ error: "Provide today's local date and a valid time zone." });
      return;
    }
    next(error);
  }
});

export default router;
