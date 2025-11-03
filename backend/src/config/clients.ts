import { google } from "googleapis";
import redis from "redis";
import Groq from "groq-sdk";

export const redisClient = redis.createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/callback"
);


