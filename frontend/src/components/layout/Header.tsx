import { Bot, Mail } from "lucide-react";

interface HeaderProps {
  isAuthenticated: boolean;
  onConnect: () => void;
}

export function Header({ isAuthenticated, onConnect }: HeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-gray-300 bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/60 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Smart Gmail Assistant</p>
            <h1 className="text-base font-semibold text-gray-900">Chat</h1>
          </div>
        </div>
        {!isAuthenticated ? (
          <button
            onClick={onConnect}
            className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-md text-md font-medium hover:bg-emerald-700 transition-colors cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            Connect Gmail
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1.5 rounded-md text-xs">
            <Mail className="w-4 h-4" />
            Gmail Connected
          </div>
        )}
      </div>
    </div>
  );
}
