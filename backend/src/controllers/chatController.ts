import { Request, Response } from "express";
import { openai, redisClient } from "../config/clients.js";
import { Email, fetchGmailEmails } from "../services/gmail.js";
import {
  isGmailQuery,
  wantsFreshEmails,
  parseDesiredEmailCount,
  buildGmailQueryFromMessage,
} from "../utils/query.js";
import { buildSystemPrompt } from "../utils/prompt.js";
import { generateLLMResponse, summarizeInChunks } from "../services/llm.js";

const LARGE_EMAIL_THRESHOLD = 120;
const MAX_HISTORY_MESSAGES = 10;
const CHAT_HISTORY_LIMIT = 50;

export async function chatHandler(req: Request, res: Response) {
  const { message, forceRefreshEmails } = req.body as {
    message?: string;
    forceRefreshEmails?: boolean;
  };

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    let emailContext: Email[] | null = null;
    let usedGmail = false;
    const userEmail = req.session.email;
    const systemMetaNotes: string[] = [];

    // Check if this is a Gmail-related query
    if (isGmailQuery(message)) {
      if (!req.session.tokens) {
        return res.status(401).json({
          error: "Please connect your Gmail account first",
          needsAuth: true,
        });
      }

      // Fetch or retrieve cached emails
      emailContext = await getEmailContext(
        req,
        message,
        userEmail!,
        forceRefreshEmails,
        systemMetaNotes
      );

      usedGmail = true;
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(systemMetaNotes);

    // Build user prompt with email context
    const userPrompt = buildUserPrompt(message, emailContext);

    // Initialize chat history
    if (!req.session.chatHistory) {
      req.session.chatHistory = [];
    }

    // Prepare messages for LLM
    const messagesForModel = prepareMessagesForLLM(
      req.session.chatHistory,
      systemPrompt,
      userPrompt
    );

    // Generate response (with chunking for large email sets)
    const assistantMessage =
      emailContext && emailContext.length > LARGE_EMAIL_THRESHOLD
        ? await summarizeInChunks(emailContext, message, systemPrompt)
        : await generateLLMResponse(messagesForModel);

    // Update chat history
    updateChatHistory(req, userPrompt, assistantMessage);

    res.json({ response: assistantMessage, usedGmail });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process message";
    res.status(500).json({ error: errorMessage });
  }
}

// Helper: Get email context with caching
async function getEmailContext(
  req: Request,
  message: string,
  userEmail: string,
  forceRefresh: boolean = false,
  systemMetaNotes: string[]
): Promise<Email[]> {
  const cacheKey = `emails:${userEmail}`;
  const { count: desiredCount, wantsMore } = parseDesiredEmailCount(message, {
    fallback: 20,
    min: 5,
    max: 200,
  });

  const shouldForce = forceRefresh || wantsFreshEmails(message) || wantsMore;

  // Check if user wants to search with specific query
  const { q } = buildGmailQueryFromMessage(message);

  if (q) {
    // Handle Gmail query-based search
    return await getQueryBasedEmails(
      req,
      q,
      cacheKey,
      shouldForce,
      systemMetaNotes
    );
  } else {
    // Handle recent emails
    return await getRecentEmails(
      req,
      desiredCount,
      cacheKey,
      shouldForce,
      systemMetaNotes
    );
  }
}

// Helper: Get emails based on Gmail query
async function getQueryBasedEmails(
  req: Request,
  query: string,
  cacheKey: string,
  shouldForce: boolean,
  systemMetaNotes: string[]
): Promise<Email[]> {
  const qHash = encodeURIComponent(query);
  const queryCacheKey = `${cacheKey}:q:${qHash}`;

  // Check cache
  if (!shouldForce) {
    const cachedQueryEmails = await redisClient.get(queryCacheKey);
    if (cachedQueryEmails) {
      const parsed =
        typeof cachedQueryEmails === "string"
          ? (JSON.parse(cachedQueryEmails) as Email[])
          : (cachedQueryEmails as unknown as Email[]);
      return parsed;
    }
  }

  // Fetch fresh data
  const { emails, total } = await fetchGmailEmails(
    req.session.tokens!.access_token!,
    { q: query, perPage: 100, totalLimit: 500 }
  );

  // Cache results
  await redisClient.setEx(queryCacheKey, 900, JSON.stringify(emails));

  systemMetaNotes.push(
    `Search matched ~${total} messages (showing up to ${emails.length}).`
  );

  return emails as Email[];
}

// Helper: Get recent emails
async function getRecentEmails(
  req: Request,
  desiredCount: number,
  cacheKey: string,
  shouldForce: boolean,
  systemMetaNotes: string[]
): Promise<Email[]> {
  const countScopedKey = `${cacheKey}:n:${desiredCount}`;

  // Check cache
  if (!shouldForce) {
    const cachedEmails = await redisClient.get(countScopedKey);
    if (cachedEmails) {
      const parsed =
        typeof cachedEmails === "string"
          ? (JSON.parse(cachedEmails) as Email[])
          : (cachedEmails as unknown as Email[]);

      if (parsed.length >= desiredCount) {
        return parsed;
      }
    }
  }

  // Fetch fresh data
  const { emails, total } = await fetchGmailEmails(
    req.session.tokens!.access_token!,
    { perPage: desiredCount, totalLimit: desiredCount }
  );

  // Cache results
  await redisClient.setEx(countScopedKey, 900, JSON.stringify(emails));

  systemMetaNotes.push(
    `Loaded recent emails (showing ${emails.length} of ~${total}).`
  );

  return emails as Email[];
}

// Helper: Build user prompt with email context
function buildUserPrompt(
  message: string,
  emailContext: Email[] | null
): string {
  if (!emailContext) {
    return message;
  }

  const formattedEmails = emailContext
    .map(
      (email, idx) =>
        `Email ${idx + 1}:
          From: ${email.from}
          Subject: ${email.subject}
          Date: ${new Date(email.date).toLocaleString()}
          Status: ${email.isUnread ? "Unread 📩" : "Read 📧"}
          Preview: ${email.snippet}`
    )
    .join("\n\n");

  return `
          User request: "${message}"

          Here are the user's recent emails for context:
          ${formattedEmails}

          Follow the adaptive behavior described above to answer the user's request appropriately.
          When listing emails, include up to 20 items from the provided context unless the user specifies a different number. Format responses cleanly and intuitively.
            `.trim();
}

// Helper: Prepare messages for LLM
function prepareMessagesForLLM(
  chatHistory: Array<{ role: string; content: string }>,
  systemPrompt: string,
  userPrompt: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const recentHistory = chatHistory.slice(-MAX_HISTORY_MESSAGES);

  return [
    { role: "system" as const, content: systemPrompt.trim() },
    ...recentHistory.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
    { role: "user" as const, content: userPrompt.trim() },
  ];
}

// Helper: Update chat history
function updateChatHistory(
  req: Request,
  userPrompt: string,
  assistantMessage: string
): void {
  req.session.chatHistory!.push(
    { role: "user", content: userPrompt.trim() },
    { role: "assistant", content: assistantMessage }
  );

  // Limit history size
  if (req.session.chatHistory!.length > CHAT_HISTORY_LIMIT) {
    req.session.chatHistory = req.session.chatHistory!.slice(
      -CHAT_HISTORY_LIMIT
    );
  }
}
