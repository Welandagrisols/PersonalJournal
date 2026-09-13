import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import {
  ComposeWithGeminiBody,
  ComposeWithGeminiResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const NATURAL_WRITING_RULES = [
  "Write in plain, natural English.",
  "Preserve the writer's meaning, personality, and level of vulnerability.",
  "Avoid generic AI language, motivational clichés, inflated wording, and repeated sentence patterns.",
  "Do not begin with phrases like 'In today's world', 'It's important to note', or 'As we navigate'.",
  "Prefer specific verbs, varied sentence lengths, and concrete details.",
].join(" ");

interface GeminiCandidateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

function getBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function requireSupabaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req);
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!token) {
    res.status(401).json({ message: "A signed-in Pages account is required." });
    return;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ message: "Account verification is not configured." });
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      res.status(401).json({ message: "Your session is no longer valid." });
      return;
    }

    if (!response.ok) {
      res.status(503).json({ message: "Could not verify your Pages account." });
      return;
    }

    const user = (await response.json()) as { id?: string };
    if (!user.id) {
      res.status(401).json({ message: "Your session is no longer valid." });
      return;
    }

    next();
  } catch {
    res.status(503).json({ message: "Could not verify your Pages account." });
  }
}

function buildPrompt(input: {
  operation: "polish" | "story" | "metadata" | "reflect";
  text: string;
  title?: string;
  instruction?: string;
  context?: string;
}): string {
  const title = input.title?.trim() || "(untitled)";
  const instruction = input.instruction?.trim() || "Make the smallest useful improvement.";
  const context = input.context?.trim() || "(none)";

  const task =
    input.operation === "polish"
      ? "Polish the journal entry without making it sound formal or unlike the writer."
      : input.operation === "story"
        ? "Continue or develop the writing as a story. Keep the established point of view and tone; do not invent a neat moral unless the writing asks for one."
        : input.operation === "metadata"
          ? "Suggest a concise title and up to five useful, lowercase tags. Keep the original text unchanged in the result."
          : "Offer gentle reflection prompts based on the writing. Do not diagnose the writer or give unsolicited life advice.";

  return [
    "You are the writing companion inside Pages, a private journaling app.",
    task,
    NATURAL_WRITING_RULES,
    "Return only valid JSON with this shape:",
    '{"result":"string","title":"optional string","tags":["optional","lowercase","tags"],"questions":["optional question"]}',
    "For polish and story, put the finished writing in result and omit questions.",
    "For metadata, use the original text in result, include title and tags, and omit questions.",
    "For reflect, put a short supportive lead-in in result and include three to five open-ended questions.",
    "Do not mention being an AI. Do not use markdown fences.",
    `Requested instruction: ${instruction}`,
    `Current title: ${title}`,
    `Related context: ${context}`,
    "Journal text:",
    input.text.trim(),
  ].join("\n\n");
}

function parseGeminiJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

router.post("/gemini/compose", requireSupabaseAuth, async (req, res) => {
  const parsed = ComposeWithGeminiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Please provide a valid writing request." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ message: "The writing companion is not configured yet." });
    return;
  }

  const prompt = buildPrompt(parsed.data);

  try {
    const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: parsed.data.operation === "metadata" ? 0.35 : 0.72,
          topP: 0.9,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    const data = (await response.json().catch(() => ({}))) as GeminiCandidateResponse;
    if (!response.ok) {
      res.status(502).json({
        message: data.error?.message
          ? "Gemini could not complete that request."
          : "Gemini could not complete that request.",
      });
      return;
    }

    const generatedText = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? "")
      .join("")
      .trim();

    if (!generatedText) {
      res.status(502).json({ message: "Gemini returned an empty response." });
      return;
    }

    let result: unknown;
    try {
      result = parseGeminiJson(generatedText);
    } catch {
      result = { result: generatedText };
    }

    const validated = ComposeWithGeminiResponse.safeParse(result);
    if (!validated.success) {
      res.status(502).json({ message: "Gemini returned an unusable response." });
      return;
    }

    res.json(validated.data);
  } catch {
    res.status(502).json({ message: "The writing companion is temporarily unavailable." });
  }
});

export default router;