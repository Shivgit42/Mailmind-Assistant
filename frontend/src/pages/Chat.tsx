import { useState, useRef, useEffect } from "react";
import { Mail, Bot, User, Loader2 } from "lucide-react";
import { Header } from "../components/Header";
import { EmptyState } from "../components/EmptyState";
import { InputBar } from "../components/InputBar";
import ReactMarkdown from "react-markdown";

interface Message {
  role: string;
  content: string;
  isError?: boolean;
  usedGmail?: boolean | undefined;
}

function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const suggestions = [
    "Show my recent emails",
    "Summarize my unread emails this week",
    "Find emails from Google",
    "What did I receive today?",
    "Top senders in the last 30 days",
  ];

  const API_BASE =
    import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!textAreaRef.current) return;
    const el = textAreaRef.current;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/status`, {
        credentials: "include",
      });
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
    } catch (error) {
      console.error("Auth check failed:", error);
    }
  };

  const handleGmailAuth = () => {
    window.location.href = `${API_BASE}/auth/gmail`;
  };

  const handleSendMessage = async (overrideText?: string) => {
    if (!isAuthenticated) {
      handleGmailAuth();
      return;
    }
    const textToSend = (overrideText ?? input).trim();
    if (!textToSend || isLoading) return;

    if (!overrideText) setInput("");

    setMessages((prev) => [...prev, { role: "user", content: textToSend }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          usedGmail: data.usedGmail,
        },
      ]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Chat error:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${error.message}. Please try again.`,
            isError: true,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateClick = (template: string) => {
    if (isLoading) return;
    handleSendMessage(template);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="w-full h-screen flex flex-col">
        <Header isAuthenticated={isAuthenticated} onConnect={handleGmailAuth} />

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <EmptyState
              isAuthenticated={isAuthenticated}
              suggestions={suggestions}
              onPick={handleTemplateClick}
              onConnect={handleGmailAuth}
            />
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-emerald-600 to-teal-600 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 border ${
                      message.role === "user"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : message.isError
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
                    {message.role === "assistant" && !message.isError ? (
                      <div
                        className="prose prose-sm max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-3 prose-code:text-gray-900
                        prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mb-3 prose-headings:mt-4
                        prose-p:text-gray-800 prose-p:leading-relaxed prose-p:mb-4
                        prose-strong:text-gray-900 prose-strong:font-semibold
                        prose-hr:my-4 prose-hr:border-gray-300
                        [&_p:has(strong)]:mb-1
                        [&_p+p]:mt-3"
                      >
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-gray-600 to-gray-800 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
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
          )}
        </div>

        <InputBar
          input={input}
          setInput={setInput}
          onSend={() => handleSendMessage()}
          textAreaRef={textAreaRef}
          disabled={!isAuthenticated || isLoading}
        />
      </div>
    </div>
  );
}

export default Chat;
