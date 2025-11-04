import { google } from "googleapis";
import { oauth2Client } from "../config/clients.js";

export interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string;
  isUnread: boolean;
}

export type FetchedEmails = { emails: Email[]; total: number };

export async function fetchGmailEmails(
  accessToken: string,
  opts?: { q?: string; perPage?: number; totalLimit?: number }
): Promise<FetchedEmails> {
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

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
}
