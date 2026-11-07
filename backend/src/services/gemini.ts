import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

export class GeminiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

let client: GoogleGenAI | undefined;
// Use one free-tier eligible model; never fall back to another model.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

export async function generateGeminiText(prompt: string, responseJsonSchema?: Record<string, unknown>): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new GeminiError(503, "AI generation is not configured yet.");

  client ??= new GoogleGenAI({ apiKey });
  try {
    const result = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        maxOutputTokens: 2048,
        httpOptions: { timeout: 30_000 },
        ...(responseJsonSchema ? { responseMimeType: "application/json", responseJsonSchema } : {}),
      },
    });
    const text = result.text?.trim();
    if (!text) throw new GeminiError(502, "AI did not return any text. Please try again.");
    return text;
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    // SDK errors may contain request details. Never forward or log them with credentials.
    throw new GeminiError(502, "AI generation is currently unavailable. Please try again later.");
  }
}
