import { useRef } from "react";
import { Bot, Loader2 } from "lucide-react";
import type { Message } from "../../types";
import { MessageItem } from "./MessageItem";
import { useScrollToBottom } from "../../hooks/useScrollToBottom";

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useScrollToBottom(messagesEndRef, [messages]);

  return (
    <>
      {messages.map((message, index) => (
        <MessageItem key={index} message={message} />
      ))}
      {isLoading && (
        <div className="flex gap-3 justify-start">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl px-4 py-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );
};
