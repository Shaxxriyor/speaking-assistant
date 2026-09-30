export const dynamic = "force-dynamic";

/** Which optional server features are configured (the natural OpenAI voice needs OPENAI_API_KEY). */
export function GET() {
  return Response.json({ openaiVoice: Boolean(process.env.OPENAI_API_KEY) });
}
