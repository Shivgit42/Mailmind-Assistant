import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import { google } from "googleapis";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import { Credentials } from "google-auth-library";
import { parseDesiredEmailCount } from "./src/utils/query.js";
import { redisClient } from "./src/config/clients.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

declare module "express-session" {
  interface SessionData {
    tokens?: Credentials;
    email?: string;
    chatHistory?: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
  }
}

// Email interface
interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  isUnread: boolean;
}

// Redis client is provided by Upstash via src/config/clients

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "keepitsecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
);

// Helper function to check if message is Gmail-related
function isGmailQuery(message: string): boolean {
  const gmailKeywords = [
    "email",
    "emails",
    "gmail",
    "inbox",
    "message",
    "messages",
    "unread",
    "latest",
    "recent",
    "mail",
    "sender",
    "from",
    "subject",
    "received",
    "yesterday",
    "today",
    "week",
  ];

  const lowerMessage = message.toLowerCase();
  return gmailKeywords.some((keyword) => lowerMessage.includes(keyword));
}

// Helper to detect requests for fresh emails
function wantsFreshEmails(message: string): boolean {
  const lower = message.toLowerCase();
  const refreshKeywords = [
    "refresh",
    "latest",
    "fetch again",
    "update",
    "check now",
    "get new",
    "most recent",
    "just now",
  ];
  return refreshKeywords.some((k) => lower.includes(k));
}

// Helper function to determine query type
function getQueryType(message: string): "summary" | "detail" | "search" {
  const lowerMessage = message.toLowerCase();

  // Summary keywords
  const summaryKeywords = [
    "summarize",
    "summary",
    "overview",
    "brief",
    "quick look",
    "what's new",
    "catch me up",
    "what did i miss",
  ];

  const searchKeywords = [
    "from",
    "about",
    "regarding",
    "find",
    "search",
    "show me emails from",
    "boss",
    "manager",
    "specific",
  ];

  if (summaryKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return "summary";
  }

  if (searchKeywords.some((keyword) => lowerMessage.includes(keyword))) {
    return "search";
  }

  return "detail";
}

// Helper function to fetch emails from Gmail
type FetchedEmails = { emails: Email[]; total: number };

async function fetchGmailEmails(
  accessToken: string,
  opts?: { q?: string; perPage?: number; totalLimit?: number }
): Promise<FetchedEmails> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  try {
    // Paginate across results
    const perPage = Math.min(Math.max(opts?.perPage ?? 50, 10), 100);
    const totalLimit = Math.min(Math.max(opts?.totalLimit ?? 300, 50), 1000);
    let pageToken: string | undefined = undefined;
    let collected: string[] = [];
    let totalSeen = 0;

    do {
      const gmailListResponse = (await gmail.users.messages.list({
        userId: "me",
        maxResults: perPage,
        q: opts?.q ?? "",
        pageToken,
      })) as any;

      const msgs = (gmailListResponse.data?.messages || []) as Array<{
        id?: string | null;
      }>;
      totalSeen += msgs.length;
      collected.push(...msgs.map((m) => m.id!).filter(Boolean));
      pageToken = gmailListResponse.data?.nextPageToken || undefined;
    } while (pageToken && collected.length < totalLimit);

    const limitedIds = collected.slice(0, totalLimit);
    const emailPromises = limitedIds.map(async (id) => {
      const email = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const headers = email.data.payload?.headers || [];
      const subject =
        headers.find((h) => h.name === "Subject")?.value || "No Subject";
      const from = headers.find((h) => h.name === "From")?.value || "Unknown";
      const date = headers.find((h) => h.name === "Date")?.value || "";

      let body = "";
      if (email.data.payload?.body?.data) {
        body = Buffer.from(email.data.payload.body.data, "base64").toString(
          "utf-8"
        );
      } else if (email.data.payload?.parts) {
        const textPart = email.data.payload.parts.find(
          (part) => part.mimeType === "text/plain"
        );
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        }
      }

      return {
        id,
        subject,
        from,
        date,
        snippet: email.data.snippet || "",
        body: body.substring(0, 500),
        isUnread: email.data.labelIds?.includes("UNREAD") || false,
      } as Email;
    });

    const emails = await Promise.all(emailPromises);
    return { emails, total: totalSeen };
  } catch (error) {
    console.error("Error fetching Gmail emails:", error);
    throw error;
  }
}

function buildGmailQueryFromMessage(message: string): {
  q: string | null;
  reason: string | null;
} {
  const m = message.toLowerCase();
  let parts: string[] = [];

  const yearMatch = m.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const nextYear = year + 1;
    parts.push(`after:${year}/01/01 before:${nextYear}/01/01`);
  }

  const fromMatch = m.match(
    /(?:emails?\s+)?from\s+([a-z0-9._%+-@]+(?:\.[a-z0-9-]+)*|[a-z]+(?:\s+[a-z]+){0,3})/
  );
  if (fromMatch) {
    const senderRaw = fromMatch[1].replace(/[^a-z0-9@._-\s]/g, "").trim();

    if (senderRaw.includes("@") || senderRaw.includes(".")) {
      const domain = senderRaw.split("@")[1] || senderRaw;
      parts.push(`from:${domain}`);
    } else {
      parts.push(`from:${senderRaw.replace(/\s+/g, "")}`);
    }
  }

  const aboutMatch = m.match(/(?:about|regarding)\s+([\w\s]{3,50})/);
  if (aboutMatch) {
    const kw = aboutMatch[1].trim().replace(/\s+/g, " ");
    parts.push(`{${kw}}`);
  }

  if (m.includes("unread")) parts.push("is:unread");

  if (/today|latest|recent|this week|yesterday|now/.test(m)) {
    if (m.includes("yesterday")) parts.push("newer_than:2d");
    else if (m.includes("week")) parts.push("newer_than:7d");
    else parts.push("newer_than:1d");
  }

  const q = parts.join(" ").trim();
  return {
    q: q.length ? q : null,
    reason: q.length ? "derived from user message" : null,
  };
}

// Routes

// Auth status check
app.get("/api/auth/status", (req: Request, res: Response) => {
  res.json({
    authenticated: !!req.session.tokens,
    email: req.session.email,
  });
});

// Gmail OAuth - Start
app.get("/api/auth/gmail", (req: Request, res: Response) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
  res.redirect(authUrl);
});

// Gmail OAuth - Callback
app.get("/api/auth/callback", async (req: Request, res: Response) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}?error=no_code`
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    req.session.email = userInfo.data.email || undefined;

    res.redirect(process.env.FRONTEND_URL || "http://localhost:5173");
  } catch (error) {
    console.error("Error during OAuth callback:", error);
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}?error=auth_failed`
    );
  }
});

// Logout
app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).json({ error: "Failed to logout" });
    }
    res.json({ success: true });
  });
});

app.post("/api/chat", async (req: Request, res: Response) => {
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

    // Detect Gmail-related queries
    if (isGmailQuery(message)) {
      if (!req.session.tokens) {
        return res.status(401).json({
          error: "Please connect your Gmail account first",
          needsAuth: true,
        });
      }

      const cacheKey = `emails:${userEmail}`;
      const { count: desiredCount, wantsMore } = parseDesiredEmailCount(
        message,
        { fallback: 20, min: 5, max: 200 }
      );
      const shouldForce =
        Boolean(forceRefreshEmails) || wantsFreshEmails(message) || wantsMore;

      const { q } = buildGmailQueryFromMessage(message);
      if (q) {
        const qHash = encodeURIComponent(q);
        const queryCacheKey = `${cacheKey}:q:${qHash}`;
        const cachedQueryEmails = shouldForce
          ? null
          : await redisClient.get(queryCacheKey);
        if (cachedQueryEmails) {
          console.log("Using cached query emails from Redis", q);
          emailContext = JSON.parse(cachedQueryEmails) as Email[];
        } else {
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
        // Fallback to recent emails
        const countScopedKey = `${cacheKey}:n:${desiredCount}`;
        const cachedEmails = shouldForce
          ? null
          : await redisClient.get(countScopedKey);
        if (cachedEmails) {
          const parsed = JSON.parse(cachedEmails) as Email[];
          if (parsed.length >= desiredCount) {
            console.log("Using cached emails from Redis");
            emailContext = parsed;
          } else {
            console.log(
              "Cached emails less than desired count, refetching recent",
              desiredCount
            );
            const { emails, total } = await fetchGmailEmails(
              req.session.tokens.access_token!,
              { perPage: desiredCount, totalLimit: desiredCount }
            );
            await redisClient.setEx(
              countScopedKey,
              900,
              JSON.stringify(emails)
            );
            emailContext = emails as Email[];
            systemMetaNotes.push(
              `Loaded recent emails (showing ${emails.length} of ~${total}).`
            );
          }
        } else {
          console.log("Fetching fresh emails from Gmail API (recent)");
          const { emails, total } = await fetchGmailEmails(
            req.session.tokens.access_token!,
            { perPage: desiredCount, totalLimit: desiredCount }
          );
          await redisClient.setEx(countScopedKey, 900, JSON.stringify(emails));
          emailContext = emails as Email[];
          systemMetaNotes.push(
            `Loaded recent emails (showing ${emails.length} of ~${total}).`
          );
        }
      }

      usedGmail = true;
    }

    let systemPrompt =
      `
You are a helpful Gmail-savvy assistant. When email context is provided, answer using it exactly (do not invent emails). If no email context is relevant, answer normally.

Core behavior (choose based on the user's intent):
- Summary: Provide a brief overview first (total emails, unread count, top senders, key subjects, time range). Keep it concise and scannable.
- Specific/search: Show only matching emails. Prefer a compact list with From, Subject, Date, and an unread badge.
- Status (unread/read/recent): List those emails only.
- Trends/analysis: Highlight patterns (frequent senders, common topics, busy days) and provide short, actionable takeaways.

Formatting rules:
- Start with a short title line that describes what you did (e.g., "Inbox summary" or "Emails from Alice").
- Use clear sections and bullet points. Keep paragraphs short. Use emojis sparingly for clarity (e.g., 📬 for inbox, 🔎 for search, 📈 for trends).
- For email lists, use a compact markdown list like: ` +
      "`" +
      `- [Unread 📩] From — Subject (Date)` +
      "`" +
      `
- Show at most 20 items by default. For requests like "recent/latest emails", list up to 20 items. If there are more than 20, say how many are hidden and how to request them.
- If the request is ambiguous, ask a brief clarifying question before proceeding.

Constraints:
- Only use the provided email context. Never fabricate senders, subjects, or dates.
- If no relevant emails are found, say so clearly and suggest a next step (e.g., adjust date/sender/keywords).
- Keep responses focused and avoid dumping raw data unless explicitly requested.
    `;

    if (systemMetaNotes.length) {
      systemPrompt += `\n\n${systemMetaNotes.join("\n")}`;
    }

    let userPrompt = message;

    if (emailContext) {
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

      userPrompt = `
User request: "${message}"

Here are the user's recent emails for context:
${formattedEmails}

Follow the adaptive behavior described above to answer the user's request appropriately.
When listing emails, include up to 20 items from the provided context unless the user specifies a different number. Format responses cleanly and intuitively.
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
          { role: "system", content: (systemPrompt || "").trim() },
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
        { role: "system", content: (systemPrompt || "").trim() },
        {
          role: "user",
          content:
            `Combine the following partial email summaries into a single answer to the user's request.\n- Do not repeat items verbatim; deduplicate.\n- Follow the formatting rules previously provided.\n- Limit lists to 10 items unless asked.\n\nUser request: "${userMessage}"\n\nPartial summaries:\n${partialSummaries
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

    let assistantMessage: string;
    const LARGE_EMAIL_THRESHOLD = 120;
    if (emailContext && emailContext.length > LARGE_EMAIL_THRESHOLD) {
      assistantMessage = await summarizeInChunks(emailContext, message);
    } else {
      const chatCompletion = await groq.chat.completions.create({
        messages: messagesForModel,
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 1024,
      });
      assistantMessage = chatCompletion.choices[0]?.message?.content || "";
    }

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
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
