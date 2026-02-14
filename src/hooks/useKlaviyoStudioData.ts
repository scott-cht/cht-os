import { useCallback, useEffect, useMemo, useState } from 'react';
import { notify } from '@/lib/store/app-store';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import type {
  CampaignItem,
  CampaignMessage,
  IntegrationStatus,
  SectionTag,
  SelectedCampaignMessage,
  StyleGuide,
  TemplateItem,
} from '@/components/klaviyo/types';

export function useKlaviyoStudioData() {
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null);
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedCampaignMessages, setSelectedCampaignMessages] = useState<SelectedCampaignMessage[]>([]);
  const [campaignMessagesCache, setCampaignMessagesCache] = useState<Record<string, CampaignMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [previewGuide, setPreviewGuide] = useState<StyleGuide | null>(null);
  const [editGuide, setEditGuide] = useState<StyleGuide | null>(null);
  const [editLayoutNotes, setEditLayoutNotes] = useState('');
  const [editSectionTags, setEditSectionTags] = useState<SectionTag[]>([]);
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchIntegrationStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/status');
      const data = await res.json();
      setIntegrationStatus(data);
    } catch {
      setIntegrationStatus({});
    }
  }, []);

  const fetchStyleGuides = useCallback(async () => {
    setLoadingGuides(true);
    try {
      const res = await fetch('/api/klaviyo/style-guides');
      const data = await res.json();
      if (data.styleGuides) setStyleGuides(data.styleGuides);
      else setStyleGuides([]);
    } catch {
      setStyleGuides([]);
    } finally {
      setLoadingGuides(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrationStatus();
    fetchStyleGuides();
  }, [fetchIntegrationStatus, fetchStyleGuides]);

  const openImportModal = useCallback(async () => {
    setImportModalOpen(true);
    setSelectedTemplateIds(new Set());
    setSelectedCampaignMessages([]);
    setCampaignMessagesCache({});
    try {
      const [tRes, cRes] = await Promise.all([
        fetch('/api/klaviyo/templates'),
        fetch('/api/klaviyo/campaigns?channel=email'),
      ]);
      const tData = await tRes.json();
      const cData = await cRes.json();
      if (tData.templates) setTemplates(tData.templates);
      else setTemplates([]);
      const campaignList = cData.campaigns ?? [];
      if (campaignList.length) setCampaigns(campaignList);
      else setCampaigns([]);

      if (campaignList.length > 0) {
        setLoadingMessages(true);
        const next: Record<string, CampaignMessage[]> = {};
        await Promise.all(
          campaignList.map(async (c: CampaignItem) => {
            try {
              const mRes = await fetch(`/api/klaviyo/campaigns/${c.id}/messages`);
              const mData = await mRes.json();
              if (mData.messages?.length) next[c.id] = mData.messages;
            } catch {
              // ignore per-campaign failure
            }
          })
        );
        setCampaignMessagesCache(next);
        setLoadingMessages(false);
      }
    } catch {
      notify.error('Load failed', 'Could not load templates or campaigns');
      setLoadingMessages(false);
    }
  }, []);

  const selectAllTemplates = useCallback(() => {
    setSelectedTemplateIds(new Set(templates.map((t) => t.id)));
  }, [templates]);

  const clearTemplates = useCallback(() => {
    setSelectedTemplateIds(new Set());
  }, []);

  const selectAllMessages = useCallback(() => {
    const all: SelectedCampaignMessage[] = [];
    Object.entries(campaignMessagesCache).forEach(([campaignId, messages]) => {
      messages.forEach((m) => all.push({ campaignId, messageId: m.id }));
    });
    setSelectedCampaignMessages(all);
  }, [campaignMessagesCache]);

  const clearMessages = useCallback(() => {
    setSelectedCampaignMessages([]);
  }, []);

  const selectCampaignMessages = useCallback((campaignId: string) => {
    const messages = campaignMessagesCache[campaignId] ?? [];
    setSelectedCampaignMessages((prev) => {
      const existing = new Set(prev.map((p) => `${p.campaignId}:${p.messageId}`));
      messages.forEach((m) => existing.add(`${campaignId}:${m.id}`));
      return Array.from(existing).map((key) => {
        const i = key.indexOf(':');
        return { campaignId: key.slice(0, i), messageId: key.slice(i + 1) };
      });
    });
  }, [campaignMessagesCache]);

  const deselectCampaignMessages = useCallback((campaignId: string) => {
    setSelectedCampaignMessages((prev) => prev.filter((x) => x.campaignId !== campaignId));
  }, []);

  const openPreview = useCallback((g: StyleGuide) => setPreviewGuide(g), []);
  const openEditSections = useCallback((g: StyleGuide) => {
    setEditGuide(g);
    setEditLayoutNotes(g.layoutNotes ?? '');
    setEditSectionTags(g.sectionTags ?? []);
  }, []);

  const saveLayoutNotes = useCallback(async () => {
    if (!editGuide) return;
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/klaviyo/style-guides/${editGuide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutNotes: editLayoutNotes, sectionTags: editSectionTags }),
      });
      const data = await res.json();
      if (data.error || !res.ok) {
        notify.error('Save failed', data.error?.message ?? 'Could not save');
        return;
      }
      notify.success('Saved', 'Layout notes and section tags updated');
      setEditGuide(null);
      fetchStyleGuides();
    } catch {
      notify.error('Save failed', 'Please try again');
    } finally {
      setSavingNotes(false);
    }
  }, [editGuide, editLayoutNotes, editSectionTags, fetchStyleGuides]);

  const addSectionTag = useCallback(() => {
    setEditSectionTags((prev) => [...prev, { type: 'products', description: '' }]);
  }, []);

  const updateSectionTag = useCallback((index: number, field: 'type' | 'description', value: string) => {
    setEditSectionTags((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const removeSectionTag = useCallback((index: number) => {
    setEditSectionTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleCampaignMessage = useCallback((campaignId: string, messageId: string) => {
    setSelectedCampaignMessages((prev) => {
      const exists = prev.some((m) => m.campaignId === campaignId && m.messageId === messageId);
      if (exists) return prev.filter((m) => !(m.campaignId === campaignId && m.messageId === messageId));
      return [...prev, { campaignId, messageId }];
    });
  }, []);

  const handleExportSelected = useCallback(async () => {
    if (selectedTemplateIds.size === 0 && selectedCampaignMessages.length === 0) {
      notify.warning('Nothing selected', 'Select at least one template or campaign message');
      return;
    }
    setExporting(true);
    try {
      const res = await fetch('/api/klaviyo/export-style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateIds: Array.from(selectedTemplateIds),
          campaignMessageIds: selectedCampaignMessages,
          saveToDb: true,
        }),
      });
      const data = await res.json();
      if (data.error || !res.ok) {
        notify.error('Export failed', data.error?.message ?? data.error ?? 'Export failed');
        return;
      }
      notify.success('Exported', `Saved ${data.samples?.length ?? 0} style guide(s)`);
      setImportModalOpen(false);
      fetchStyleGuides();
    } catch {
      notify.error('Export failed', 'Please try again');
    } finally {
      setExporting(false);
    }
  }, [selectedTemplateIds, selectedCampaignMessages, fetchStyleGuides]);

  const deleteStyleGuide = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/klaviyo/style-guides/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        notify.error('Delete failed', data.error?.message ?? 'Could not delete');
        return false;
      }
      notify.success('Removed', 'Style guide removed');
      setStyleGuides((prev) => prev.filter((g) => g.id !== id));
      return true;
    } catch {
      notify.error('Delete failed', 'Please try again');
      return false;
    }
  }, []);

  const safeGuideHtml = useMemo(
    () => sanitizeHtml(previewGuide?.html ?? ''),
    [previewGuide?.html]
  );

  const klaviyoReady = integrationStatus?.klaviyo?.configured ?? false;

  return {
    integrationStatus,
    klaviyoReady,
    styleGuides,
    loadingGuides,
    importModalOpen,
    setImportModalOpen,
    templates,
    campaigns,
    selectedTemplateIds,
    selectedCampaignMessages,
    campaignMessagesCache,
    loadingMessages,
    exporting,
    previewGuide,
    setPreviewGuide,
    editGuide,
    setEditGuide,
    editLayoutNotes,
    setEditLayoutNotes,
    editSectionTags,
    savingNotes,
    fetchStyleGuides,
    openImportModal,
    selectAllTemplates,
    clearTemplates,
    selectAllMessages,
    clearMessages,
    selectCampaignMessages,
    deselectCampaignMessages,
    openPreview,
    openEditSections,
    saveLayoutNotes,
    addSectionTag,
    updateSectionTag,
    removeSectionTag,
    toggleTemplate,
    toggleCampaignMessage,
    handleExportSelected,
    deleteStyleGuide,
    safeGuideHtml,
  };
}
