export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
};

export const API_ENDPOINTS = {
  AUTH_STATUS: "/auth/status",
  AUTH_GMAIL: "/auth/gmail",
  CHAT: "/chat",
} as const;
