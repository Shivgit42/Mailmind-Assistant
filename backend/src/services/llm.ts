import { openai } from "../config/clients.js";
import { Email } from "./gmail.js";

const CHUNK_SIZE = 30;
const CHUNK_DELAY_MS = 300;

export async function generateLLMResponse(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string> {
  try {
    const chatCompletion = await openai.chat.completions.create({
      messages: messages as any,
      model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1024,
    });

    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error("LLM API error:", error);
    throw new Error("Failed to generate response from LLM");
  }
}

export async function summarizeInChunks(
  emails: Email[],
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  // Split emails into chunks
  const chunks: Email[][] = [];
  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    chunks.push(emails.slice(i, i + CHUNK_SIZE));
  }

  // Process each chunk
  const partialSummaries: string[] = [];
  for (const chunk of chunks) {
    const chunkSummary = await processChunk(chunk, userMessage, systemPrompt);
    partialSummaries.push(chunkSummary);

    // Rate limiting delay
    await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
  }

  // Merge partial summaries
  const finalSummary = await mergeSummaries(
    partialSummaries,
    userMessage,
    systemPrompt
  );

  return finalSummary;
}

async function processChunk(
  chunk: Email[],
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  const chunkFormatted = chunk
    .map(
      (email, idx) =>
        `Email ${idx + 1}:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Status: ${email.isUnread ? "Unread 📩" : "Read 📧"}
Preview: ${email.snippet}`
    )
    .join("\n\n");

  const chunkMessages = [
    { role: "system" as const, content: systemPrompt.trim() },
    {
      role: "user" as const,
      content:
        `You will receive a portion of the user's emails. Create a concise intermediate summary optimized for later merging.
- Keep it under 8 bullet points.
- Include counts (unread/read) and notable senders/subjects.
- Output only the summary, no preface.

User request: "${userMessage}"

Emails:
${chunkFormatted}`.trim(),
    },
  ];

  const chunkResponse = await openai.chat.completions.create({
    messages: chunkMessages as any,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 400,
  });

  return chunkResponse.choices[0]?.message?.content?.trim() || "";
}

async function mergeSummaries(
  partialSummaries: string[],
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  const mergeMessages = [
    { role: "system" as const, content: systemPrompt.trim() },
    {
      role: "user" as const,
      content:
        `Combine the following partial email summaries into a single answer to the user's request.
- Do not repeat items; deduplicate.
- Follow the formatting rules previously provided.
- Limit lists to 10 items unless asked.

User request: "${userMessage}"

Partial summaries:
${partialSummaries
  .map((s, i) => `Summary ${i + 1}:\n${s}`)
  .join("\n\n")}`.trim(),
    },
  ];

  const merged = await openai.chat.completions.create({
    messages: mergeMessages as any,
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    temperature: 0.5,
    max_tokens: 800,
  });

  return merged.choices[0]?.message?.content || "";
}
