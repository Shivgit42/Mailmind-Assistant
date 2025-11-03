import { Send } from "lucide-react";
import type { RefObject } from "react";

interface InputBarProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
}

export function InputBar({
  input,
  setInput,
  onSend,
  textAreaRef,
  disabled,
}: InputBarProps) {
  return (
    <div className="px-4 pb-6">
      <div className="w-full flex justify-center">
        <div className="w-[60vw] max-w-full rounded-xl border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-emerald-500">
          <textarea
            ref={textAreaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!disabled && input.trim()) onSend();
              }
            }}
            placeholder={
              disabled
                ? "Sign in with Gmail to start chatting"
                : "Ask about your Gmail (e.g., summarize unread emails)..."
            }
            rows={1}
            className="w-full resize-none px-4 py-3 outline-none rounded-xl placeholder:text-gray-400"
            disabled={disabled}
          />
          <div className="flex items-center justify-between px-2 py-2">
            <p className="px-2 text-xs text-gray-500">
              Press Enter to send • Shift+Enter for new line
            </p>
            <button
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-3 py-2 rounded-lg text-md font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
