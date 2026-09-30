export const dynamic = "force-dynamic";

/** Tells the page whether OpenAI (examiner voice + Whisper) is configured, so it can run in demo mode without it. */
export function GET() {
  return Response.json({ openai: Boolean(process.env.OPENAI_API_KEY) });
}
