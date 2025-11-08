import { useRef } from "react";
import { Send } from "lucide-react";
import { MESSAGES } from "../../config/constants";
import { useAutoResize } from "../../hooks/useAutoResize";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export const ChatInput = ({
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  useAutoResize(textAreaRef, value);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="px-4 pb-6">
      <div className="w-full flex justify-center">
        <div className="w-[60vw] max-w-full rounded-xl border border-gray-300 bg-white shadow-sm focus-within:ring-1 focus-within:ring-emerald-500">
          <textarea
            ref={textAreaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled ? MESSAGES.AUTH_REQUIRED : MESSAGES.INPUT_PLACEHOLDER
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
              disabled={disabled || !value.trim()}
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
};
