import OpenAI from "openai";

export const runtime = "nodejs";

// Whisper's upload limit is 25 MB. A 2-minute Part 2 answer is roughly 1–2 MB.
const MAX_BYTES = 25 * 1024 * 1024;

// Whisper tends to "clean up" speech. This prompt nudges it to keep fillers
// (um, uh, like) and self-corrections, which matter for Fluency & Coherence scoring.
const KEEP_FILLERS_PROMPT =
  "Umm, let me think, like, hmm... Okay, so, uh, I mean — well, I'd say it's, you know, quite important.";

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Transcription is not configured: OPENAI_API_KEY is missing on the server." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data with an 'audio' file." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return Response.json({ error: "No audio received. Please try recording again." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "Recording is too long (over 25 MB)." }, { status: 413 });
  }

  const openai = new OpenAI();
  try {
    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: process.env.TRANSCRIBE_MODEL || "whisper-1",
      language: "en",
      prompt: KEEP_FILLERS_PROMPT,
    });
    return Response.json({ text: result.text.trim() });
  } catch (err) {
    console.error("Transcription failed:", err);
    const status = err instanceof OpenAI.APIError && err.status ? err.status : 502;
    return Response.json(
      { error: "We couldn't transcribe your answer. Please try again." },
      { status: status >= 500 ? 502 : status },
    );
  }
}
