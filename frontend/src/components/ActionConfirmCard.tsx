import { useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PendingAction {
  toolName: string;
  toolInput: Record<string, any>;
  toolUseId: string;
}

interface ActionConfirmCardProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  executing: boolean;
}

const TOOL_LABELS: Record<string, string> = {
  move_client: 'Move Client',
  move_multiple_clients: 'Move Multiple Clients',
  reorder_stops: 'Reorder Stops',
  create_route: 'Create Route',
  deactivate_route: 'Deactivate Route',
  update_cost_config: 'Update Cost Config',
};

function formatInput(input: Record<string, any>): string[] {
  return Object.entries(input).map(([key, value]) => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    if (Array.isArray(value)) return `${label}: ${value.length} items`;
    return `${label}: ${value}`;
  });
}

export function ActionConfirmCard({ action, onConfirm, onCancel, executing }: ActionConfirmCardProps) {
  return (
    <div className="mx-4 my-2 border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-b border-amber-200">
        <ShieldCheck size={16} className="text-amber-700" />
        <span className="text-sm font-semibold text-amber-800">Action Requires Confirmation</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-medium text-gray-800">
          {TOOL_LABELS[action.toolName] || action.toolName}
        </div>
        <div className="space-y-0.5">
          {formatInput(action.toolInput).map((line, i) => (
            <div key={i} className="text-xs text-gray-600">{line}</div>
          ))}
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onConfirm}
            disabled={executing}
            className="px-4 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Confirm'}
          </button>
          <button
            onClick={onCancel}
            disabled={executing}
            className="px-4 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
