import { useQuery } from '@tanstack/react-query';
import { Lightbulb, RefreshCw } from 'lucide-react';
import { fetchAiInsights } from '../api/ai.api';
import type { AiInsight } from '../api/ai.api';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  capacity: 'Capacity',
  profitability: 'Profitability',
  efficiency: 'Efficiency',
  growth: 'Growth',
};

interface AiInsightsSectionProps {
  seasonId: string;
}

export function AiInsightsSection({ seasonId }: AiInsightsSectionProps) {
  const { data: insights, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-insights', seasonId],
    queryFn: () => fetchAiInsights(seasonId),
    enabled: !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 min — don't re-fetch on every focus
    retry: 1,
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-cr-text">AI Insights</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-cr-text-muted hover:text-cr-text disabled:opacity-40"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="text-sm text-gray-500 py-4">Generating AI insights...</div>
      )}

      {error && !isLoading && (
        <div className="text-sm text-red-500 py-4">
          Could not load AI insights. Ensure ANTHROPIC_API_KEY is configured.
        </div>
      )}

      {insights && insights.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {insights.map((insight: AiInsight, i: number) => (
            <div
              key={i}
              className={`bg-white rounded-xl border border-cr-border border-l-4 ${PRIORITY_COLORS[insight.priority] ?? 'border-l-gray-300'} p-4`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase text-cr-text-muted">
                  {CATEGORY_LABELS[insight.category] ?? insight.category}
                </span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  insight.priority === 'high' ? 'bg-red-100 text-red-700' :
                  insight.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {insight.priority}
                </span>
              </div>
              <div className="text-sm font-medium text-cr-text mb-1">{insight.title}</div>
              <div className="text-xs text-cr-text-muted leading-relaxed">{insight.body}</div>
            </div>
          ))}
        </div>
      )}

      {insights && insights.length === 0 && !isLoading && (
        <div className="text-sm text-cr-text-muted py-4">No insights available.</div>
      )}
    </section>
  );
}
