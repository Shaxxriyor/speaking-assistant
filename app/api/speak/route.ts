import OpenAI from "openai";

export const runtime = "nodejs";

const MAX_CHARS = 1200;

// Delivery notes for gpt-4o-mini-tts: a calm, neutral IELTS examiner, not a chatty assistant.
const EXAMINER_STYLE =
  process.env.EXAMINER_VOICE_STYLE ||
  "You are a professional IELTS Speaking examiner. Speak in a clear, neutral British English accent, " +
    "at a calm, moderate pace, with a polite and warm but formal tone. Pause naturally between sentences. " +
    "Do not sound excited or salesy.";

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Voice is not configured: OPENAI_API_KEY is missing on the server." }, { status: 500 });
  }

  const { text } = (await req.json().catch(() => ({}))) as { text?: unknown };
  if (typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "Expected JSON body { text }." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return Response.json({ error: `Text is longer than ${MAX_CHARS} characters.` }, { status: 413 });
  }

  const openai = new OpenAI();
  try {
    const speech = await openai.audio.speech.create({
      model: process.env.TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.EXAMINER_VOICE || "coral",
      input: text.trim(),
      instructions: EXAMINER_STYLE,
      response_format: "mp3",
    });
    return new Response(await speech.arrayBuffer(), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch (err) {
    console.error("Speech synthesis failed:", err);
    return Response.json({ error: "The examiner's voice is unavailable right now." }, { status: 502 });
  }
}
