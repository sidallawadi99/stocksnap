"use client";

import { useEffect, useRef, useState } from "react";

const GREETING = {
  role: "assistant",
  content: "Namaste! 🙏 Ask me anything about your stock — what's low, what's expiring today, or how much of an item you have.",
};

const SUGGESTIONS = ["What's expiring today?", "Which items are low?", "How much Toned Milk is left?"];

export default function ChatPanel() {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  // Set up speech recognition once, if the browser supports it.
  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    setMicSupported(true);
    const rec = new SR();
    rec.lang = "en-IN"; // handles Indian English + much Hinglish
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput("");
      send(transcript); // auto-send what was spoken
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function toggleMic() {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch {
        /* already started */
      }
    }
  }

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const answer = res.ok ? data.answer : `⚠️ ${data.error || "Something went wrong."}`;
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Couldn't reach the assistant." }]);
    } finally {
      setLoading(false);
    }
  }

  // Collapsed: a slim strip (vertical bar on desktop) that reopens the panel.
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Open assistant"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 lg:w-12 lg:flex-col lg:py-5"
      >
        <span className="text-lg">💬</span>
        <span className="lg:[writing-mode:vertical-rl]">Assistant</span>
      </button>
    );
  }

  return (
    <div className="flex h-[32rem] w-full flex-col rounded-xl border border-zinc-200 bg-white lg:w-80">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">💬</span>
          <div>
            <div className="text-sm font-semibold leading-tight">Inventory Assistant</div>
            <div className="text-xs text-zinc-400">Ask in English, Hindi or Hinglish</div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse"
          className="rounded p-1 text-lg leading-none text-zinc-400 hover:bg-zinc-100"
        >
          »
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-400">typing…</div>
          </div>
        )}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="flex items-center gap-2 border-t border-zinc-100 p-3">
        {micSupported && (
          <button
            onClick={toggleMic}
            title={listening ? "Stop listening" : "Ask by voice"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg ${
              listening ? "animate-pulse border-red-300 bg-red-50" : "border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            🎤
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={listening ? "Listening…" : "Ask about your stock…"}
          className="min-w-0 flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        />
        <button
          onClick={() => send()}
          disabled={loading}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
