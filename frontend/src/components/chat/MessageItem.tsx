import { Mail, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Message } from "../../types";

interface MessageItemProps {
  message: Message;
}

export const MessageItem = ({ message }: MessageItemProps) => {
  const isUser = message.role === "user";
  const isError = message.isError;

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 border ${
          isUser
            ? "bg-emerald-600 text-white border-emerald-600"
            : isError
            ? "bg-red-50 text-red-800 border-red-100"
            : "bg-white text-gray-800 border-gray-200"
        }`}
      >
        {message.usedGmail && (
          <div className="flex items-center gap-1 text-xs mb-2 opacity-75">
            <Mail className="w-3 h-3" />
            <span>Gmail context used</span>
          </div>
        )}
        {!isUser && !isError ? (
          <div className="prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-3 prose-code:text-gray-900 prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mb-3 prose-headings:mt-4 prose-p:text-gray-800 prose-p:leading-relaxed prose-p:mb-4 prose-strong:text-gray-900 prose-strong:font-semibold prose-hr:my-4 prose-hr:border-gray-300 [&_p:has(strong)]:mb-1 [&_p+p]:mt-3">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-linear-to-br from-gray-600 to-gray-800 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
};
