import { Request, Response } from "express";
import { groq, oauth2Client, redisClient } from "../config/clients";
import { Email, fetchGmailEmails } from "../services/gmail";
import {
  buildGmailQueryFromMessage,
  isGmailQuery,
  wantsFreshEmails,
} from "../utils/query";
import { buildSystemPrompt } from "../utils/prompt";

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

    if (isGmailQuery(message)) {
      if (!req.session.tokens) {
        return res.status(401).json({
          error: "Please connect your Gmail account first",
          needsAuth: true,
        });
      }

      const cacheKey = `emails:${userEmail}`;
      const shouldForce =
        Boolean(forceRefreshEmails) || wantsFreshEmails(message);

      const { q } = buildGmailQueryFromMessage(message);
      if (q) {
        const qHash = encodeURIComponent(q);
        const queryCacheKey = `${cacheKey}:q:${qHash}`;
        const cachedQueryEmails = shouldForce
          ? null
          : await redisClient.get(queryCacheKey);
        if (cachedQueryEmails) {
          if (process.env.NODE_ENV !== "production")
            console.log("Using cached query emails from Redis", q);
          emailContext = JSON.parse(cachedQueryEmails) as Email[];
        } else {
          if (process.env.NODE_ENV !== "production")
            console.log("Fetching query-filtered emails from Gmail API", q);
          const { emails, total } = await fetchGmailEmails(
            req.session.tokens.access_token!,
            { q, perPage: 100, totalLimit: 500 }
          );
          await redisClient.setEx(queryCacheKey, 900, JSON.stringify(emails));
          emailContext = emails as Email[];
          systemMetaNotes.push(
            `Search matched ~${total} messages (showing up to ${emails.length}).`
          );
        }
      } else {
        const cachedEmails = shouldForce
          ? null
          : await redisClient.get(cacheKey);
        if (cachedEmails) {
          if (process.env.NODE_ENV !== "production")
            console.log("Using cached emails from Redis");
          emailContext = JSON.parse(cachedEmails) as Email[];
        } else {
          if (process.env.NODE_ENV !== "production")
            console.log("Fetching fresh emails from Gmail API (recent)");
          const { emails, total } = await fetchGmailEmails(
            req.session.tokens.access_token!,
            { perPage: 50, totalLimit: 100 }
          );
          await redisClient.setEx(cacheKey, 900, JSON.stringify(emails));
          emailContext = emails as Email[];
          systemMetaNotes.push(
            `Loaded recent emails (showing ${emails.length} of ~${total}).`
          );
        }
      }

      usedGmail = true;
    }

    let systemPrompt = buildSystemPrompt(systemMetaNotes);

    let userPrompt = message;
    if (emailContext) {
      const formattedEmails = emailContext
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

      userPrompt = `
User request: "${message}"

Here are the user's recent emails for context:
${formattedEmails}

Follow the adaptive behavior described above to answer the user's request appropriately.
If not relevant, summarize or ignore unnecessary data. Format responses cleanly and intuitively.
      `;
    }

    if (!req.session.chatHistory) {
      req.session.chatHistory = [];
    }
    const MAX_HISTORY_MESSAGES = 10;
    const recentHistory = req.session.chatHistory.slice(-MAX_HISTORY_MESSAGES);
    const messagesForModel: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt.trim() },
      ...recentHistory,
      { role: "user", content: userPrompt.trim() },
    ];

    async function summarizeInChunks(
      emails: Email[],
      userMessage: string
    ): Promise<string> {
      const CHUNK_SIZE = 30;
      const chunks: Email[][] = [];
      for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
        chunks.push(emails.slice(i, i + CHUNK_SIZE));
      }

      const partialSummaries: string[] = [];
      for (const chunk of chunks) {
        const chunkFormatted = chunk
          .map(
            (email, idx) =>
              `Email ${idx + 1}:\nFrom: ${email.from}\nSubject: ${
                email.subject
              }\nDate: ${email.date}\nStatus: ${
                email.isUnread ? "Unread 📩" : "Read 📧"
              }\nPreview: ${email.snippet}`
          )
          .join("\n\n");

        const chunkMessages = [
          { role: "system", content: systemPrompt.trim() },
          {
            role: "user",
            content:
              `You will receive a portion of the user's emails. Create a concise intermediate summary optimized for later merging.\n- Keep it under 8 bullet points.\n- Include counts (unread/read) and notable senders/subjects.\n- Output only the summary, no preface.\n\nUser request: "${userMessage}"\n\nEmails:\n${chunkFormatted}`.trim(),
          },
        ];

        const chunkResp = await groq.chat.completions.create({
          messages: chunkMessages as any,
          model: "llama-3.3-70b-versatile",
          temperature: 0.4,
          max_tokens: 400,
        });
        partialSummaries.push(
          chunkResp.choices[0]?.message?.content?.trim() || ""
        );
        await new Promise((r) => setTimeout(r, 300));
      }

      const mergeMessages = [
        { role: "system", content: systemPrompt.trim() },
        {
          role: "user",
          content:
            `Combine the following partial email summaries into a single answer to the user's request.\n- Do not repeat items; deduplicate.\n- Follow the formatting rules previously provided.\n- Limit lists to 10 items unless asked.\n\nUser request: "${userMessage}"\n\nPartial summaries:\n${partialSummaries
              .map((s, i) => `Summary ${i + 1}:\n${s}`)
              .join("\n\n")}`.trim(),
        },
      ];

      const merged = await groq.chat.completions.create({
        messages: mergeMessages as any,
        model: "llama-3.3-70b-versatile",
        temperature: 0.5,
        max_tokens: 800,
      });
      return merged.choices[0]?.message?.content || "";
    }

    const LARGE_EMAIL_THRESHOLD = 120;
    const assistantMessage =
      emailContext && emailContext.length > LARGE_EMAIL_THRESHOLD
        ? await summarizeInChunks(emailContext, message)
        : (
            await groq.chat.completions.create({
              messages: messagesForModel,
              model: "llama-3.3-70b-versatile",
              temperature: 0.7,
              max_tokens: 1024,
            })
          ).choices[0]?.message?.content || "";

    req.session.chatHistory.push(
      { role: "user", content: userPrompt.trim() },
      { role: "assistant", content: assistantMessage }
    );
    if (req.session.chatHistory.length > 50) {
      req.session.chatHistory = req.session.chatHistory.slice(-50);
    }

    res.json({ response: assistantMessage, usedGmail });
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process message";
    res.status(500).json({ error: errorMessage });
  }
}
