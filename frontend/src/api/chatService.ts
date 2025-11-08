import { getApiBaseUrl, API_ENDPOINTS } from "../config/api.config";
import type { ChatResponse } from "../types";
import { ApiError } from "../utils/errorHandler";

class ChatService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  async sendMessage(message: string): Promise<ChatResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${API_ENDPOINTS.CHAT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || "Failed to get response",
          response.status
        );
      }

      return data as ChatResponse;
    } catch (error) {
      console.error("Chat error:", error);
      throw error;
    }
  }
}

export const chatService = new ChatService();
