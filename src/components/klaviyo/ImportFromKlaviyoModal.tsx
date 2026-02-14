'use client';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import type {
  CampaignItem,
  CampaignMessage,
  SelectedCampaignMessage,
  TemplateItem,
} from '@/components/klaviyo/types';

interface ImportFromKlaviyoModalProps {
  open: boolean;
  templates: TemplateItem[];
  campaigns: CampaignItem[];
  campaignMessagesCache: Record<string, CampaignMessage[]>;
  selectedTemplateIds: Set<string>;
  selectedCampaignMessages: SelectedCampaignMessage[];
  loadingMessages: boolean;
  exporting: boolean;
  onClose: () => void;
  onToggleTemplate: (id: string) => void;
  onToggleCampaignMessage: (campaignId: string, messageId: string) => void;
  onSelectAllTemplates: () => void;
  onClearTemplates: () => void;
  onSelectAllMessages: () => void;
  onClearMessages: () => void;
  onSelectCampaignMessages: (campaignId: string) => void;
  onDeselectCampaignMessages: (campaignId: string) => void;
  onExportSelected: () => void;
}

export function ImportFromKlaviyoModal({
  open,
  templates,
  campaigns,
  campaignMessagesCache,
  selectedTemplateIds,
  selectedCampaignMessages,
  loadingMessages,
  exporting,
  onClose,
  onToggleTemplate,
  onToggleCampaignMessage,
  onSelectAllTemplates,
  onClearTemplates,
  onSelectAllMessages,
  onClearMessages,
  onSelectCampaignMessages,
  onDeselectCampaignMessages,
  onExportSelected,
}: ImportFromKlaviyoModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Import from Klaviyo</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">Select templates or campaign messages to save as style guides. Use checkboxes to select multiple.</p>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Templates</h4>
              {templates.length > 0 && (
                <div className="flex gap-3 text-xs">
                  <button type="button" onClick={onSelectAllTemplates} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                    Select all
                  </button>
                  <button type="button" onClick={onClearTemplates} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline">
                    Clear
                  </button>
                </div>
              )}
            </div>
            <ul className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-700">
              {templates.length === 0 ? (
                <li className="px-4 py-3 text-sm text-zinc-500">No templates found.</li>
              ) : (
                templates.map((t) => (
                  <li key={t.id}>
                    <label
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                        selectedTemplateIds.has(t.id)
                          ? 'bg-emerald-50 dark:bg-emerald-950/30'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.has(t.id)}
                        onChange={() => onToggleTemplate(t.id)}
                        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">{t.name}</span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-zinc-800 dark:text-zinc-200">Campaign messages (email)</h4>
              {loadingMessages ? (
                <span className="text-xs text-zinc-500">Loading messages…</span>
              ) : (
                Object.keys(campaignMessagesCache).length > 0 && (
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={onSelectAllMessages} className="text-emerald-600 dark:text-emerald-400 hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={onClearMessages} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:underline">
                      Clear
                    </button>
                  </div>
                )
              )}
            </div>
            {campaigns.length === 0 ? (
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-500">
                No email campaigns found.
              </div>
            ) : loadingMessages ? (
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg px-4 py-6 text-sm text-zinc-500 text-center">
                Loading campaign messages…
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-700 max-h-[280px] overflow-y-auto">
                {campaigns.map((c) => {
                  const messages = campaignMessagesCache[c.id] ?? [];
                  const selectedCount = selectedCampaignMessages.filter((x) => x.campaignId === c.id).length;
                  const allSelected = messages.length > 0 && selectedCount === messages.length;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                        <button
                          type="button"
                          onClick={() => (allSelected ? onDeselectCampaignMessages(c.id) : onSelectCampaignMessages(c.id))}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {allSelected ? 'Deselect all' : 'Select all'} in campaign
                        </button>
                        <span className="text-xs text-zinc-500 truncate flex-1" title={c.name}>
                          {c.name}
                        </span>
                      </div>
                      {messages.length === 0 ? (
                        <div className="px-4 py-2 text-xs text-zinc-500">No messages</div>
                      ) : (
                        messages.map((m) => (
                          <label
                            key={m.id}
                            className={cn(
                              'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors pl-6',
                              selectedCampaignMessages.some((x) => x.campaignId === c.id && x.messageId === m.id)
                                ? 'bg-emerald-50 dark:bg-emerald-950/30'
                                : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCampaignMessages.some((x) => x.campaignId === c.id && x.messageId === m.id)}
                              onChange={() => onToggleCampaignMessage(c.id, m.id)}
                              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm text-zinc-900 dark:text-white truncate flex-1">{m.label || m.id}</span>
                          </label>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-4">
          <span className="text-sm text-zinc-500">
            {selectedTemplateIds.size + selectedCampaignMessages.length > 0
              ? `${selectedTemplateIds.size} template(s), ${selectedCampaignMessages.length} message(s) selected`
              : 'Select one or more items to export'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onExportSelected}
              disabled={exporting || (selectedTemplateIds.size === 0 && selectedCampaignMessages.length === 0)}
            >
              {exporting ? 'Exporting…' : 'Export selected'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
