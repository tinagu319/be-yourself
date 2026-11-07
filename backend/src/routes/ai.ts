import { Router } from "express";
import { requireAuth } from "../auth/requireAuth";
import { generateGeminiText, GeminiError } from "../services/gemini";

const router = Router();
router.use(requireAuth);

router.post("/generate", async (request, response, next) => {
  const prompt = typeof request.body?.prompt === "string" ? request.body.prompt.trim() : "";
  if (!prompt || prompt.length > 10_000) {
    response.status(400).json({ error: "Enter a prompt between 1 and 10,000 characters." });
    return;
  }

  try {
    const text = await generateGeminiText(prompt);
    response.json({ text });
  } catch (error) {
    if (error instanceof GeminiError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;
