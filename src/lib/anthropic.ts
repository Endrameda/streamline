import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CHAT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export const SYSTEM_PROMPT =
  "You are a concise, helpful assistant in a demo chat app. Keep replies focused.";
