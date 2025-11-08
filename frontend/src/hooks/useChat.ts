import { useState, useCallback } from "react";
import { chatService } from "../api";
import type { Message } from "../types";
import { createErrorMessage } from "../utils/errorHandler";

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmedContent = content.trim();
      if (!trimmedContent || isLoading) return;

      // Add user message
      const userMessage: Message = { role: "user", content: trimmedContent };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await chatService.sendMessage(trimmedContent);

        // Add assistant message
        const assistantMessage: Message = {
          role: "assistant",
          content: response.response,
          usedGmail: response.usedGmail,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        // Add error message
        const errorMessage: Message = {
          role: "assistant",
          content: createErrorMessage(error),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  return {
    messages,
    isLoading,
    sendMessage,
  };
};
