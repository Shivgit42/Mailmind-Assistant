import { getApiBaseUrl, API_ENDPOINTS } from "../config/api.config";
import type { AuthStatusResponse } from "../types";
import { ApiError } from "../utils/errorHandler";

class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  async checkAuthStatus(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}${API_ENDPOINTS.AUTH_STATUS}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new ApiError(
          "Failed to check authentication status",
          response.status
        );
      }

      const data: AuthStatusResponse = await response.json();
      return data.authenticated;
    } catch (error) {
      console.error("Auth check failed:", error);
      throw error;
    }
  }

  getGmailAuthUrl(): string {
    return `${this.baseUrl}${API_ENDPOINTS.AUTH_GMAIL}`;
  }

  redirectToGmailAuth(): void {
    window.location.href = this.getGmailAuthUrl();
  }
}

export const authService = new AuthService();
