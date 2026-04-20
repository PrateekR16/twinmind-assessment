"use client";

import { useEffect, useRef, useState, KeyboardEvent, ChangeEvent } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (content: string) => void;
}

export function ChatPanel({ messages, isStreaming, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (input === "" && textareaRef.current) {
      textareaRef.current.style.height = "24px";
    }
  }, [input]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "24px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Column header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-300/80">
            Chat
          </span>
          {isStreaming && <Loader2 className="w-3.5 h-3.5 text-blue-400/70 animate-spin" aria-hidden="true" strokeWidth={2} />}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4">
          {messages.length === 0 ? (
            <p className="text-white/40 text-[13px] leading-relaxed mt-6 text-center">
              Click a suggestion or ask anything about the conversation
            </p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                      msg.role === "user"
                        ? "bg-blue-500/[0.18] text-white/90 rounded-br-sm border border-blue-500/[0.18]"
                        : "bg-white/[0.05] text-white/80 rounded-bl-sm border border-white/[0.08]",
                    ].join(" ")}
                  >
                    {msg.role === "assistant" && msg.content === "" ? (
                      <span className="flex items-center gap-1 text-white/40 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:120ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:240ms]" />
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p className={`text-[10px] mt-1.5 tabular-nums ${msg.role === "user" ? "text-blue-300/50 text-right" : "text-white/30"}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="px-4 pb-4 pt-3 shrink-0 border-t border-white/[0.06]">
        <div className="flex items-end gap-2.5 bg-white/[0.05] border border-white/[0.10] rounded-xl px-3.5 py-2.5 focus-within:border-blue-500/40 focus-within:bg-blue-500/[0.04] transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            aria-label="Chat message input"
            style={{ height: "24px" }}
            className="flex-1 bg-transparent text-[13px] text-white/85 placeholder:text-white/35 resize-none outline-none leading-relaxed overflow-y-auto"
          />
          <button
            onClick={handleSend}
            type="button"
            disabled={!input.trim() || isStreaming}
            aria-label="Send message"
            className={[
              "w-6 h-6 flex items-center justify-center rounded-lg shrink-0 transition-colors mb-px",
              input.trim() && !isStreaming
                ? "bg-blue-500/40 text-blue-200 hover:bg-blue-500/60 hover:text-white"
                : "bg-white/[0.07] text-white/25",
            ].join(" ")}
          >
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
        <p className="text-[10px] text-white/30 mt-1.5 px-0.5">
          ↵ send · ⇧↵ newline
        </p>
      </div>
    </div>
  );
}
