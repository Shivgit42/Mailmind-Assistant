import { useState, useEffect } from "react";
import { authService } from "../api";

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const authenticated = await authService.checkAuthStatus();
      setIsAuthenticated(authenticated);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const handleGmailAuth = () => {
    authService.redirectToGmailAuth();
  };

  return {
    isAuthenticated,
    isLoading,
    handleGmailAuth,
    checkAuthStatus,
  };
};
