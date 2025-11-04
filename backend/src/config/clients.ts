import { google } from "googleapis";
import { Redis } from "@upstash/redis";
import Groq from "groq-sdk";

// Upstash Redis client with a tiny adapter to match our current API (get, setEx)
const upstashRedis = new Redis({
  url:
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_URL ||
    "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_TOKEN || "",
});

export const redisClient = {
  get: (key: string) => upstashRedis.get<string | null>(key),
  setEx: (key: string, ttlSeconds: number, value: string) =>
    upstashRedis.set(key, value, { ex: ttlSeconds }) as Promise<"OK" | null>,
};

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
);


