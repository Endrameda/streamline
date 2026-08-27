"use client";

import { useRef, useState } from "react";
import type { Conversation, Message } from "@/db/schema";
import { parseSseChunk } from "@/lib/sse";

type ViewMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "dropped";
};

function toViewMessage(m: Message): ViewMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.completedAt ? "complete" : m.content ? "dropped" : "complete",
  };
}

interface ChatViewProps {
  conversation: Conversation;
  initialMessages: Message[];
}

export default function ChatView(props: ChatViewProps) {
  const { conversation, initialMessages } = props;
  const [messages, setMessages] = useState<ViewMessage[]>(
    initialMessages.map(toViewMessage),
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function submitHandler(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;

    setError(null);
    setInput("");
    setIsSending(true);

    const userMessage: ViewMessage = {
      id: `local-${crypto.randomUUID()}`,
      role: "user",
      content: text,
      status: "complete",
    };
    const assistantId = `local-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", status: "streaming" },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          message: text,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let sawDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSseChunk(buffer);
        buffer = rest;

        for (const event of events) {
          if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.value }
                  : m,
              ),
            );
          } else if (event.type === "done") {
            sawDone = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, status: "complete" } : m,
              ),
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!sawDone) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: "dropped" } : m,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, status: "dropped" } : m,
          ),
        );
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setIsSending(false);
      abortRef.current = null;
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  return (
    <div className="flex flex-1 flex-col min-w-0">
      <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <h1 className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {conversation.title}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Send a message to start the conversation.
          </div>
        ) : (
          <ul className="mx-auto flex max-w-2xl flex-col gap-4">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "bg-white text-zinc-900 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800"
                  }`}
                >
                  {m.content || (m.status === "streaming" ? "…" : "")}
                  {m.status === "streaming" && (
                    <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-current align-text-bottom" />
                  )}
                  {m.status === "dropped" && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                      Connection dropped before this reply finished.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="mx-6 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <form
        onSubmit={submitHandler}
        className="flex gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message..."
          disabled={isSending}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {isSending ? (
          <button
            type="button"
            onClick={stopStreaming}
            className="rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
