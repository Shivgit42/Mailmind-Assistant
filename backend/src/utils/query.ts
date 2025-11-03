export function isGmailQuery(message: string): boolean {
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

export function wantsFreshEmails(message: string): boolean {
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

export function buildGmailQueryFromMessage(message: string): { q: string | null; reason: string | null } {
  const m = message.toLowerCase();
  let parts: string[] = [];

  const yearMatch = m.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    const nextYear = year + 1;
    parts.push(`after:${year}/01/01 before:${nextYear}/01/01`);
  }

  const fromMatch = m.match(/(?:emails?\s+)?from\s+([a-z0-9._%+-@]+(?:\.[a-z0-9-]+)*|[a-z]+(?:\s+[a-z]+){0,3})/);
  if (fromMatch) {
    const senderRaw = fromMatch[1].replace(/[^a-z0-9@._-\s]/g, "").trim();
    if (senderRaw.includes("@") || senderRaw.includes(".")) {
      const domain = senderRaw.split('@')[1] || senderRaw;
      parts.push(`from:${domain}`);
    } else {
      parts.push(`from:${senderRaw.replace(/\s+/g, '')}`);
    }
  }

  const aboutMatch = m.match(/(?:about|regarding)\s+([\w\s]{3,50})/);
  if (aboutMatch) {
    const kw = aboutMatch[1].trim().replace(/\s+/g, ' ');
    parts.push(`{${kw}}`);
  }

  if (m.includes("unread")) parts.push("is:unread");

  if (/today|latest|recent|this week|yesterday|now/.test(m)) {
    if (m.includes("yesterday")) parts.push("newer_than:2d");
    else if (m.includes("week")) parts.push("newer_than:7d");
    else parts.push("newer_than:1d");
  }

  const q = parts.join(' ').trim();
  return { q: q.length ? q : null, reason: q.length ? 'derived from user message' : null };
}

// Extract desired email count and whether the user asked for "more"
export function parseDesiredEmailCount(message: string, defaults: { fallback: number; min?: number; max?: number } = { fallback: 20 }): { count: number; wantsMore: boolean } {
  const min = Math.max(1, defaults.min ?? 5);
  const max = Math.min(500, defaults.max ?? 200);
  const m = message.toLowerCase();

  // Common patterns: "show 25", "25 emails", "top 20", "list 100"
  const numMatch = m.match(/\b(\d{1,3})\b\s*(?:emails?|msgs?|messages?)?/);
  let count = defaults.fallback;
  if (numMatch) {
    count = Math.min(Math.max(parseInt(numMatch[1], 10), min), max);
  }

  const wantsMore = /(more|show more|next|load more)/.test(m);
  return { count, wantsMore };
}
