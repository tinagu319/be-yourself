import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../auth/requireAuth";
import { generateDailyRecap, RecapInputError } from "../services/dailyRecap";
import { GeminiError } from "../services/gemini";

const router = Router();
router.use(requireAuth);

// Mount at /api/daily-recap. Call only from the user's Share action.
router.post("/", async (request, response, next) => {
  const { date, timeZone } = request.body ?? {};
  if (typeof date !== "string" || typeof timeZone !== "string" || !timeZone.trim() || timeZone.length > 100) {
    response.status(400).json({ error: "Provide today's date and your time zone." });
    return;
  }
  try {
    const recap = await generateDailyRecap((request as AuthenticatedRequest).userId, date, timeZone);
    response.set("Cache-Control", "no-store").json(recap);
  } catch (error) {
    if (error instanceof RecapInputError) {
      response.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof GeminiError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
