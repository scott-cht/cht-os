'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils/cn';
import type { EmailKeyText } from '@/lib/utils/email-html';
import type { EmailPreviewData } from '@/components/klaviyo/types';

interface EmailPreviewCardProps {
  preview: EmailPreviewData | null;
  safePreviewHtml: string;
  previewTab: 'preview' | 'keytext' | 'html';
  editableKeyText: EmailKeyText;
  pushing: boolean;
  createCampaign: boolean;
  onPreviewTabChange: (tab: 'preview' | 'keytext' | 'html') => void;
  onSubjectChange: (value: string) => void;
  onPreheaderChange: (value: string) => void;
  onHeadlineChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onCtaChange: (value: string) => void;
  onHtmlChange: (value: string) => void;
  onCopy: () => void;
  onPush: () => void;
  onCreateCampaignChange: (value: boolean) => void;
}

export function EmailPreviewCard({
  preview,
  safePreviewHtml,
  previewTab,
  editableKeyText,
  pushing,
  createCampaign,
  onPreviewTabChange,
  onSubjectChange,
  onPreheaderChange,
  onHeadlineChange,
  onBodyChange,
  onCtaChange,
  onHtmlChange,
  onCopy,
  onPush,
  onCreateCampaignChange,
}: EmailPreviewCardProps) {
  if (!preview) return null;

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Preview</h2>
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Subject</label>
          <Input
            value={preview.subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full"
            placeholder="Email subject"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Preheader (preview text)</label>
          <Input
            value={preview.preheader ?? ''}
            onChange={(e) => onPreheaderChange(e.target.value)}
            className="w-full"
            placeholder="Optional preview text"
          />
        </div>
      </div>

      <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-700 mb-3">
        <button
          type="button"
          onClick={() => onPreviewTabChange('preview')}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors',
            previewTab === 'preview'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          )}
        >
          Preview
        </button>
        <button
          type="button"
          onClick={() => onPreviewTabChange('keytext')}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors',
            previewTab === 'keytext'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          )}
        >
          Edit key text
        </button>
        <button
          type="button"
          onClick={() => onPreviewTabChange('html')}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors',
            previewTab === 'html'
              ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          )}
        >
          Edit HTML
        </button>
      </div>

      {previewTab === 'preview' && (
        <div
          className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900 max-h-[400px] overflow-auto text-sm prose prose-zinc dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: safePreviewHtml }}
        />
      )}
      {previewTab === 'keytext' && (
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Headline</label>
            <Input
              value={editableKeyText.headline}
              onChange={(e) => onHeadlineChange(e.target.value)}
              className="w-full"
              placeholder="Main heading"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Body (first paragraph)</label>
            <textarea
              value={editableKeyText.body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white min-h-[80px]"
              placeholder="Opening paragraph"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">CTA button text</label>
            <Input
              value={editableKeyText.cta}
              onChange={(e) => onCtaChange(e.target.value)}
              className="w-full"
              placeholder="e.g. Shop now"
            />
          </div>
          <div
            className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900 max-h-[200px] overflow-auto text-sm prose prose-zinc dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: safePreviewHtml }}
          />
        </div>
      )}
      {previewTab === 'html' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">HTML body</label>
            <textarea
              value={preview.htmlBody}
              onChange={(e) => onHtmlChange(e.target.value)}
              className="w-full h-[400px] px-3 py-2 text-xs font-mono border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">Live preview</label>
            <div
              className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 bg-white dark:bg-zinc-900 h-[400px] overflow-auto text-sm prose prose-zinc dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: safePreviewHtml }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="secondary" onClick={onCopy}>
          Copy to clipboard
        </Button>
        <Button onClick={onPush} disabled={pushing}>
          {pushing ? 'Pushing…' : 'Push to Klaviyo'}
        </Button>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={createCampaign}
            onChange={(e) => onCreateCampaignChange(e.target.checked)}
          />
          Also create draft campaign
        </label>
      </div>
    </Card>
  );
}
