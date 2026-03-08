import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendAiChat } from '../api/ai.api';
import type { ChatMessage } from '../api/ai.api';

interface AiChatPanelProps {
  seasonId: string;
  open: boolean;
  onClose: () => void;
}

export function AiChatPanel({ seasonId, open, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Send history (excluding the current message which is in the `message` param)
      const history = messages.slice(-18); // keep last 18 for context window
      const res = await sendAiChat(text, seasonId, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      const msg = err.response?.data?.error ?? 'Failed to get AI response.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, seasonId]);

  if (!open) return null;

  return (
    <div className="absolute top-2 right-2 bottom-2 w-96 bg-white rounded-xl shadow-2xl border border-cr-border flex flex-col z-30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cr-border">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-cr-navy" />
          <span className="text-sm font-semibold text-cr-text">Route Intelligence</span>
        </div>
        <button onClick={onClose} className="text-cr-text-muted hover:text-cr-text">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-sm text-cr-text-muted py-8">
            <Bot size={32} className="mx-auto mb-2 text-gray-300" />
            <p>Ask me about your routes, capacity, profitability, or optimization ideas.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cr-navy flex items-center justify-center mt-0.5">
                <Bot size={14} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-cr-navy text-white'
                  : 'bg-gray-100 text-cr-text'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center mt-0.5">
                <User size={14} className="text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cr-navy flex items-center justify-center mt-0.5">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <Loader2 size={16} className="animate-spin text-cr-text-muted" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-xs text-red-500 text-center">{error}</div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-cr-border px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Ask about routes, capacity, costs..."
            className="flex-1 text-sm border border-cr-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-cr-navy"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-cr-navy text-white hover:opacity-90 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
