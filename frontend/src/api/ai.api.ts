import { http } from './http';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PendingAction {
  toolName: string;
  toolInput: Record<string, any>;
  toolUseId: string;
}

export interface ChatResponse {
  type?: 'text' | 'pending_action';
  reply: string;
  pendingAction?: PendingAction;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AiInsight {
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
  category: 'capacity' | 'profitability' | 'efficiency' | 'growth';
}

export async function sendAiChat(
  message: string,
  seasonId: string,
  history: ChatMessage[],
  actionsEnabled = false
): Promise<ChatResponse> {
  const res = await http.post('/v1/ai/chat', { message, seasonId, history, actionsEnabled });
  return res.data.data;
}

export async function executeAiAction(
  toolName: string,
  toolInput: Record<string, any>
): Promise<{ success: boolean; summary: string; affected: number; details?: Record<string, any> }> {
  const res = await http.post(`/v1/ai-actions/${toolName.replace(/_/g, '-')}`, toolInput);
  return res.data.data;
}

export async function fetchAiInsights(seasonId: string): Promise<AiInsight[]> {
  const res = await http.get('/v1/ai/insights', { params: { season_id: seasonId } });
  return res.data.data.insights;
}
