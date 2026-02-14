import { useCallback, useState } from 'react';
import { notify } from '@/lib/store/app-store';
import { extractKeyText } from '@/lib/utils/email-html';
import { postJsonWithIdempotency } from '@/lib/utils/idempotency-client';
import type { EmailPreviewData } from '@/components/klaviyo/types';

interface UseKlaviyoComposerInput {
  selectedInventoryIds: string[];
  filterListingTypes: string[];
  filterLimit: number;
  setPreview: (preview: EmailPreviewData | null) => void;
  setEditableKeyText: (keyText: { headline: string; body: string; cta: string }) => void;
  setPreviewTab: (tab: 'preview' | 'keytext' | 'html') => void;
}

export function useKlaviyoComposer({
  selectedInventoryIds,
  filterListingTypes,
  filterLimit,
  setPreview,
  setEditableKeyText,
  setPreviewTab,
}: UseKlaviyoComposerInput) {
  const [selectedGuideIds, setSelectedGuideIds] = useState<Set<string>>(new Set());
  const [intent, setIntent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [createCampaign, setCreateCampaign] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (selectedGuideIds.size === 0) {
      notify.warning('Style guide required', 'Select at least one style guide');
      return;
    }
    if (!intent.trim()) {
      notify.warning('Intent required', 'Enter an email intent (e.g. New arrivals)');
      return;
    }
    setGenerating(true);
    setPreview(null);
    try {
      const body: {
        inventoryIds?: string[];
        filter?: { listingTypes: string[]; limit: number };
        styleGuideIds: string[];
        intent: string;
      } = {
        styleGuideIds: Array.from(selectedGuideIds),
        intent: intent.trim(),
      };
      if (selectedInventoryIds.length > 0) {
        body.inventoryIds = selectedInventoryIds;
      } else {
        body.filter = { listingTypes: filterListingTypes, limit: filterLimit };
      }
      const { response: res } = await postJsonWithIdempotency(
        '/api/klaviyo/generate',
        body,
        'klaviyo-generate'
      );
      const data = await res.json();
      if (data.error || !res.ok) {
        notify.error('Generation failed', data.error?.message ?? data.error ?? 'Generation failed');
        return;
      }
      setPreview({
        subject: data.subject,
        preheader: data.preheader,
        htmlBody: data.htmlBody,
      });
      setEditableKeyText(extractKeyText(data.htmlBody));
      setPreviewTab('preview');
      notify.success('Generated', 'Email copy ready');
    } catch {
      notify.error('Generation failed', 'Please try again');
    } finally {
      setGenerating(false);
    }
  }, [
    selectedGuideIds,
    intent,
    selectedInventoryIds,
    filterListingTypes,
    filterLimit,
    setPreview,
    setEditableKeyText,
    setPreviewTab,
  ]);

  const handleCopy = useCallback((preview: EmailPreviewData | null) => {
    if (!preview) return;
    const text = `Subject: ${preview.subject}\n${preview.preheader ? `Preview: ${preview.preheader}\n` : ''}\n${preview.htmlBody}`;
    navigator.clipboard.writeText(text).then(
      () => notify.success('Copied', 'Email copy copied to clipboard'),
      () => notify.error('Copy failed', 'Could not copy to clipboard')
    );
  }, []);

  const handlePush = useCallback(async (preview: EmailPreviewData | null) => {
    if (!preview) return;
    setPushing(true);
    try {
      const { response: res } = await postJsonWithIdempotency(
        '/api/klaviyo/push',
        {
          subject: preview.subject,
          preheader: preview.preheader,
          htmlBody: preview.htmlBody,
          createCampaign,
        },
        'klaviyo-push'
      );
      const data = await res.json();
      if (data.error || !res.ok) {
        notify.error('Push failed', data.error?.message ?? data.error ?? 'Push failed');
        return;
      }
      notify.success('Pushed to Klaviyo', data.message ?? 'Template created');
    } catch {
      notify.error('Push failed', 'Please try again');
    } finally {
      setPushing(false);
    }
  }, [createCampaign]);

  const handleSelectedGuideChange = useCallback((guideId: string) => {
    setSelectedGuideIds(guideId ? new Set([guideId]) : new Set());
  }, []);

  return {
    selectedGuideIds,
    setSelectedGuideIds,
    intent,
    setIntent,
    generating,
    pushing,
    createCampaign,
    setCreateCampaign,
    handleGenerate,
    handleCopy,
    handlePush,
    handleSelectedGuideChange,
  };
}
