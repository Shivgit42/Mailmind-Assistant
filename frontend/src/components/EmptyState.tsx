import { Bot, Mail } from "lucide-react";
import { SuggestionChips } from "./SuggestionChips";

interface EmptyStateProps {
  isAuthenticated: boolean;
  suggestions: string[];
  onPick: (s: string) => void;
  onConnect: () => void;
}

export function EmptyState({
  isAuthenticated,
  suggestions,
  onPick,
  onConnect,
}: EmptyStateProps) {
  return (
    <div className="h-full flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <Bot className="w-14 h-14 mx-auto text-gray-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {isAuthenticated ? "Start a conversation" : "Sign in to continue"}
        </h2>
        {isAuthenticated ? (
          <>
            <p className="text-gray-500">
              Ask me anything about your Gmail and I’ll summarize, search, or
              analyze for you.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-600 font-medium">Try asking:</p>
              <SuggestionChips suggestions={suggestions} onPick={onPick} />
            </div>
          </>
        ) : (
          <>
            <p className="text-gray-600">
              You must sign in with Gmail to use the assistant.
            </p>
            <div className="mt-4">
              <button
                onClick={onConnect}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Sign in with Gmail
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
