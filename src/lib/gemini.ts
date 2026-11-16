import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RetrievedSource } from "./google";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function geminiSetupMessage(): string {
  return (
    "AI chat is not configured on this server yet: no Gemini API key is set. " +
    "Ask the administrator to add GEMINI_API_KEY (free key at https://aistudio.google.com/apikey) " +
    "and restart the app. NOAH will not pretend to answer without a real AI behind it."
  );
}

export type ChatContext = {
  history: { role: "user" | "assistant"; content: string }[];
  memory: string[];
  sources: RetrievedSource[];
};

const SYSTEM_PROMPT = `You are NOAH, an AI virtual assistant. You help the user with their email, calendar, files, questions, summaries, comparisons and decisions.

Rules:
- Answer in the same language the user writes in: English, Urdu, or Roman Urdu (Urdu written in Latin letters). Match their language.
- If you are unsure what the user means, ask a short clarifying question instead of guessing.
- When the answer uses information from the "Connected data" below, add a citation line at the end for each source you used, exactly in this form: [Source: <label>]. Only cite sources that were actually provided below; never invent a source.
- If no connected data was provided, say so only if the user asked about their email, calendar or files — otherwise just answer from general knowledge.
- Be concise and useful. For summaries, use short bullet points. For decisions, list the options with one trade-off each and a recommendation.
- Never claim to have done something (sent an email, created an event, changed a file) unless you are told in the conversation that it was done. You only answer; actions happen through tasks with the user's approval.`;

/** Sends a real request to Google Gemini. Throws an honest error when no API key is configured. Never returns canned text. */
export async function generateChatReply(
  userMessage: string,
  ctx: ChatContext,
): Promise<{ text: string; sources: RetrievedSource[] }> {
  if (!geminiConfigured()) {
    throw new Error(geminiSetupMessage());
  }
  const modelName = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = ai.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_PROMPT });

  const memoryBlock =
    ctx.memory.length > 0
      ? `Things to remember about this user:\n${ctx.memory.map((m) => `- ${m}`).join("\n")}`
      : "No saved memories about this user.";
  const sourcesBlock =
    ctx.sources.length > 0
      ? `Connected data (real, retrieved just now from the user's own accounts):\n${ctx.sources
          .map((s) => `- ${s.label} — ${s.detail}`)
          .join("\n")}`
      : "Connected data: none retrieved for this message.";
  const historyBlock = ctx.history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "NOAH"}: ${m.content}`)
    .join("\n");

  const prompt = `${memoryBlock}\n\n${sourcesBlock}\n\nConversation so far:\n${historyBlock}\n\nUser: ${userMessage}\nNOAH:`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) throw new Error("Gemini returned an empty reply. Please try again.");
  return { text, sources: ctx.sources };
}

/** One-shot real summary (used by the "summary" task type). */
export async function generateSummary(prompt: string): Promise<string> {
  if (!geminiConfigured()) throw new Error(geminiSetupMessage());
  const modelName = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
  const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  const model = ai.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  if (!text) throw new Error("Gemini returned an empty summary. Please try again.");
  return text;
}
