export const SUGGESTIONS = [
  "Show my recent emails",
  "Summarize my unread emails this week",
  "Find emails from Google",
  "What did I receive today?",
  "Top senders in the last 30 days",
] as const;

export const UI_CONFIG = {
  MAX_MESSAGE_WIDTH: "75%",
  TEXTAREA_MAX_HEIGHT: 200,
  CHAT_CONTAINER_WIDTH: "60vw",
} as const;

export const MESSAGES = {
  AUTH_REQUIRED: "Sign in with Gmail to start chatting",
  INPUT_PLACEHOLDER: "Ask about your Gmail (e.g., summarize unread emails)...",
  ERROR_PREFIX: "Error:",
  ERROR_SUFFIX: "Please try again.",
} as const;
