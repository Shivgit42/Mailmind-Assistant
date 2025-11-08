import { useState } from "react";
import { Header } from "../components/layout/Header";
import { EmptyState } from "../components/layout/EmptyState";
import { MessageList } from "../components/chat/MessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { useAuth } from "../hooks/useAuth";
import { useChat } from "../hooks/useChat";
import { SUGGESTIONS } from "../config/constants";

export const ChatPage = () => {
  const [input, setInput] = useState("");
  const { isAuthenticated, handleGmailAuth } = useAuth();
  const { messages, isLoading, sendMessage } = useChat();

  const handleSendMessage = (messageText?: string) => {
    if (!isAuthenticated) {
      handleGmailAuth();
      return;
    }

    const textToSend = messageText ?? input;
    if (!textToSend.trim()) return;

    sendMessage(textToSend);
    if (!messageText) {
      setInput("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (isLoading) return;
    handleSendMessage(suggestion);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="w-full h-screen flex flex-col">
        <Header isAuthenticated={isAuthenticated} onConnect={handleGmailAuth} />

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <EmptyState
              isAuthenticated={isAuthenticated}
              suggestions={[...SUGGESTIONS]}
              onPick={handleSuggestionClick}
              onConnect={handleGmailAuth}
            />
          ) : (
            <MessageList messages={messages} isLoading={isLoading} />
          )}
        </div>

        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => handleSendMessage()}
          disabled={!isAuthenticated || isLoading}
        />
      </div>
    </div>
  );
};
