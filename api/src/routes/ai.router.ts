// api/src/routes/ai.router.ts
// AI chat endpoint powered by Claude (with agentic tool_use support)

import { Router, Response } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { AuthenticatedRequest } from '../types/auth.types';
import { buildAiContext } from '../services/ai-context.service';

const router = Router();

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  seasonId: z.string().uuid(),
  actionsEnabled: z.boolean().optional().default(false),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(20).optional().default([]),
});

// Tool definitions for agentic actions
const AI_TOOLS: Anthropic.Tool[] = [
  {
    name: 'move_client',
    description: 'Move a single client from their current route to a different route. Use when the user asks to reassign a client.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientId: { type: 'string', description: 'UUID of the client to move' },
        toRouteId: { type: 'string', description: 'UUID of the destination route' },
      },
      required: ['clientId', 'toRouteId'],
    },
  },
  {
    name: 'move_multiple_clients',
    description: 'Move multiple clients to a different route at once. Use when the user asks to move several clients together.',
    input_schema: {
      type: 'object' as const,
      properties: {
        clientIds: { type: 'array', items: { type: 'string' }, description: 'Array of client UUIDs to move' },
        toRouteId: { type: 'string', description: 'UUID of the destination route' },
      },
      required: ['clientIds', 'toRouteId'],
    },
  },
  {
    name: 'reorder_stops',
    description: 'Reorder the stops on a route for optimal sequencing. Provide the full ordered list of client IDs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeId: { type: 'string', description: 'UUID of the route to reorder' },
        orderedClientIds: { type: 'array', items: { type: 'string' }, description: 'Client IDs in desired order' },
      },
      required: ['routeId', 'orderedClientIds'],
    },
  },
  {
    name: 'create_route',
    description: 'Create a new empty route in a season. Use when the user wants to add a route for expansion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Label for the new route (e.g. "Route F")' },
        seasonId: { type: 'string', description: 'UUID of the season to add the route to' },
      },
      required: ['name', 'seasonId'],
    },
  },
  {
    name: 'deactivate_route',
    description: 'Deactivate a route and optionally redistribute its clients to another route.',
    input_schema: {
      type: 'object' as const,
      properties: {
        routeId: { type: 'string', description: 'UUID of the route to deactivate' },
        redistributeToRouteId: { type: 'string', description: 'UUID of route to receive the clients (required if route has stops)' },
      },
      required: ['routeId'],
    },
  },
  {
    name: 'update_cost_config',
    description: 'Update cost configuration values like labor rate, crew size, fuel cost, equipment cost, or overhead rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        laborRate: { type: 'number', description: 'Hourly labor rate in dollars' },
        crewSize: { type: 'number', description: 'Number of crew members' },
        fuelCostPerMile: { type: 'number', description: 'Fuel cost per mile in dollars' },
        equipmentCostPerHour: { type: 'number', description: 'Equipment cost per hour in dollars' },
        overheadRatePercent: { type: 'number', description: 'Overhead rate as a percentage (0-100)' },
      },
      required: [],
    },
  },
];

// ── POST /v1/ai/chat ──

router.post('/v1/ai/chat', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  if (!anthropic) {
    res.status(503).json({ success: false, error: 'AI service not configured. Set ANTHROPIC_API_KEY.' });
    return;
  }

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues });
    return;
  }

  const { message, seasonId, actionsEnabled, history } = parsed.data;
  const tenantId = req.user!.tenantId;

  try {
    const ctx = await buildAiContext(tenantId, seasonId);

    const actionInstructions = actionsEnabled
      ? `\n\nYou have access to action tools that can modify routes. When the user asks you to make changes (move clients, reorder stops, create/deactivate routes, update costs), use the appropriate tool. ALWAYS explain what you plan to do BEFORE calling a tool, so the user can confirm. Include specific names and details in your explanation.`
      : '';

    const systemContent = [
      ctx.systemPrompt,
      actionInstructions,
      '',
      '=== CURRENT SEASON DATA ===',
      ctx.seasonSummary,
      '',
      '=== ROUTE DETAILS ===',
      ctx.routeDetails,
    ].join('\n');

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...history,
      { role: 'user', content: message },
    ];

    const requestParams: any = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemContent,
      messages,
    };

    if (actionsEnabled) {
      requestParams.tools = AI_TOOLS;
    }

    const response = await anthropic.messages.create(requestParams);

    // Check for tool_use blocks (agentic actions)
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlock) {
      // Extract any text that came before the tool call
      const preText = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      res.json({
        success: true,
        data: {
          type: 'pending_action',
          reply: preText || `I'd like to perform the action: ${toolUseBlock.name}`,
          pendingAction: {
            toolName: toolUseBlock.name,
            toolInput: toolUseBlock.input,
            toolUseId: toolUseBlock.id,
          },
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          },
        },
      });
      return;
    }

    // Normal text response
    const assistantText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    res.json({
      success: true,
      data: {
        type: 'text',
        reply: assistantText,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      },
    });
  } catch (err: any) {
    console.error('[AI] Chat error:', err.message);
    res.status(500).json({ success: false, error: 'AI request failed. Please try again.' });
  }
}) as any);

// ── GET /v1/ai/insights?season_id= ──

router.get('/v1/ai/insights', authenticateToken, requireRole('owner', 'coordinator'), (async (req: AuthenticatedRequest, res: Response) => {
  if (!anthropic) {
    res.status(503).json({ success: false, error: 'AI service not configured. Set ANTHROPIC_API_KEY.' });
    return;
  }

  const seasonId = req.query.season_id as string;
  if (!seasonId) {
    res.status(400).json({ success: false, error: 'season_id query parameter is required.' });
    return;
  }

  const tenantId = req.user!.tenantId;

  try {
    const ctx = await buildAiContext(tenantId, seasonId);

    const insightPrompt = `Based on the season data below, generate exactly 3 actionable insight cards. Each insight should identify a specific optimization opportunity.

Return ONLY valid JSON — no markdown fences, no explanation. Use this exact format:
[
  {
    "title": "Short title (under 60 chars)",
    "body": "1-2 sentence explanation with specific numbers",
    "priority": "high" | "medium" | "low",
    "category": "capacity" | "profitability" | "efficiency" | "growth"
  }
]

=== SEASON DATA ===
${ctx.seasonSummary}

=== ROUTE DETAILS ===
${ctx.routeDetails}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: ctx.systemPrompt,
      messages: [{ role: 'user', content: insightPrompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let insights;
    try {
      insights = JSON.parse(text);
    } catch {
      // Try extracting JSON from the response if wrapped in markdown
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    }

    res.json({ success: true, data: { insights } });
  } catch (err: any) {
    console.error('[AI] Insights error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to generate insights.' });
  }
}) as any);

export { router as aiRouter };
