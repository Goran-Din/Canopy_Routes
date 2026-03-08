import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSeasons } from '../api/auth.api';
import { sendAiChat, executeAiAction } from '../api/ai.api';
import type { ChatMessage, PendingAction } from '../api/ai.api';
import { NavBar } from '../components/NavBar';
import { ActionConfirmCard } from '../components/ActionConfirmCard';

const SUGGESTED_PROMPTS = [
  'Give me an executive summary of my 2026 season plan',
  'Which routes are losing money and what should I do about them?',
  'I want to add 10 new clients in the Naperville area — which routes have capacity?',
  'How can I consolidate my Thursday and Friday routes to save on labor costs?',
  'Route B is my most profitable — what makes it successful compared to others?',
  'Move the 3 lowest-revenue clients from Route A to Route C',
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionsEnabled, setActionsEnabled] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [executing, setExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons'],
    queryFn: fetchSeasons,
  });

  const activeSeason =
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'draft') ??
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'pending_approval') ??
    seasons.find((s) => s.tab === 'maintenance' && s.status === 'published') ??
    seasons[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingAction]);

  async function send(text: string) {
    if (!text.trim() || loading || !activeSeason) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setPendingAction(null);
    try {
      const history = messages.slice(-18);
      const res = await sendAiChat(text, activeSeason.id, history, actionsEnabled);
      setMessages([...next, { role: 'assistant', content: res.reply }]);
      if (res.type === 'pending_action' && res.pendingAction) {
        setPendingAction(res.pendingAction);
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, I could not process that request. Please try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleConfirmAction() {
    if (!pendingAction) return;
    setExecuting(true);
    try {
      const result = await executeAiAction(pendingAction.toolName, pendingAction.toolInput);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Action completed: ${result.summary}` },
      ]);
      setPendingAction(null);
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || 'Action failed';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Action failed: ${errMsg}` },
      ]);
      setPendingAction(null);
    } finally {
      setExecuting(false);
    }
  }

  function handleCancelAction() {
    setPendingAction(null);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: 'Action cancelled. Let me know if you want to try something else.' },
    ]);
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-cr-surface">
      <NavBar />
      <div className="flex flex-col flex-1 max-w-4xl mx-auto w-full px-4 min-h-0">
        {/* Header */}
        <div className="py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Route Assistant</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {actionsEnabled
                ? 'Actions enabled — I can modify routes with your confirmation.'
                : 'Describe what you want to achieve — I know your routes, clients, and profitability data.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-500">Actions</span>
              <button
                onClick={() => setActionsEnabled(!actionsEnabled)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  actionsEnabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    actionsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setPendingAction(null); }}
                className="text-xs text-gray-400 hover:text-gray-600 border rounded px-3 py-1.5"
              >
                Clear chat
              </button>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
          {messages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-gray-400 font-medium">Try asking:</p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="text-left text-sm px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 transition-all"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold mr-2 mt-1 flex-shrink-0">
                    AI
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))
          )}

          {/* Pending action card */}
          {pendingAction && (
            <ActionConfirmCard
              action={pendingAction}
              onConfirm={handleConfirmAction}
              onCancel={handleCancelAction}
              executing={executing}
            />
          )}

          {loading && (
            <div className="flex justify-start items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                AI
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 py-4 border-t">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              placeholder={actionsEnabled
                ? 'Ask me to analyze OR make changes (e.g. "move client X to Route B")...'
                : 'Ask about your routes, clients, profitability, or what changes to make...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              disabled={loading || !!pendingAction}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim() || !!pendingAction}
              className="px-5 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {actionsEnabled
              ? 'Actions require your confirmation before executing. Toggle off to use advisory-only mode.'
              : 'AI has full access to your route data, client counts, and profitability figures.'}
          </p>
        </div>
      </div>
    </div>
  );
}
