"use client";

import { useEffect, useRef, useState } from "react";

const GREETING = {
  role: "assistant",
  content: "Namaste! 🙏 Ask me anything about your stock — what's low, what's expiring today, or how much of an item you have.",
};

const SUGGESTIONS = ["What's expiring today?", "Which items are low?", "How much Toned Milk is left?"];

export default function ChatPanel() {
  const [tab, setTab] = useState("chat"); // "chat" | "insights"
  const [collapsed, setCollapsed] = useState(false);

  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);

  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const [insightsError, setInsightsError] = useState("");

  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return;
    setMicSupported(true);
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput("");
      send(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Lazy-load insights the first time the tab is opened.
  useEffect(() => {
    if (tab === "insights" && !insightsLoaded && !insightsLoading) loadInsights();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadInsights() {
    setInsightsLoading(true);
    setInsightsError("");
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights.");
      setInsights(Array.isArray(data.insights) ? data.insights : []);
      setInsightsLoaded(true);
    } catch (err) {
      setInsightsError(err.message);
    } finally {
      setInsightsLoading(false);
    }
  }

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

  // Collapsed: a slim gradient strip that reopens the panel.
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Open assistant"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-600 to-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:opacity-95 lg:w-12 lg:flex-col lg:py-5"
      >
        <span className="text-lg">✨</span>
        <span className="lg:[writing-mode:vertical-rl]">Assistant</span>
      </button>
    );
  }

  return (
    <div className="flex h-[32rem] w-full flex-col overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm lg:h-[calc(100dvh-7rem)] lg:w-80">
      {/* Gradient AI header */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <div>
            <div className="text-sm font-semibold leading-tight">Inventory Assistant</div>
            <div className="text-xs text-white/70">AI · English · हिंदी · Hinglish</div>
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse"
          className="rounded p-1 text-lg leading-none text-white/80 hover:bg-white/15"
        >
          »
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-100 text-sm">
        <TabButton active={tab === "chat"} onClick={() => setTab("chat")}>💬 Chat</TabButton>
        <TabButton active={tab === "insights"} onClick={() => setTab("insights")}>✨ Insights</TabButton>
      </div>

      {/* Body */}
      {tab === "chat" ? (
        <>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                      : "border border-violet-100 bg-violet-50 text-zinc-800"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm text-violet-400">typing…</div>
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-violet-200 px-3 py-1 text-xs text-violet-700 hover:bg-violet-50"
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
                  listening ? "animate-pulse border-red-300 bg-red-50" : "border-violet-200 hover:bg-violet-50"
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
              className="min-w-0 flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm focus:border-violet-400 focus:outline-none"
            />
            <button
              onClick={() => send()}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:opacity-95 disabled:opacity-50"
              title="Send"
            >
              ➤
            </button>
          </div>
        </>
      ) : (
        /* Insights tab */
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">AI insights</span>
            <button onClick={loadInsights} disabled={insightsLoading} className="text-xs text-violet-600 hover:underline disabled:opacity-50">
              ↻ Refresh
            </button>
          </div>

          {insightsLoading && <div className="py-6 text-center text-sm text-violet-400">✨ Generating insights…</div>}
          {insightsError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">⚠️ {insightsError}</div>}

          {!insightsLoading && !insightsError && (
            <div className="space-y-2">
              {insights.length === 0 ? (
                <div className="py-6 text-center text-sm text-zinc-400">No insights right now.</div>
              ) : (
                insights.map((it, i) => (
                  <div key={i} className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-50 to-indigo-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                      <span>{it.emoji || "•"}</span>
                      <span>{it.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">{it.text}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-center ${
        active ? "border-b-2 border-violet-600 font-medium text-violet-700" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      {children}
    </button>
  );
}
