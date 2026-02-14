import { useCallback, useMemo, useState } from 'react';
import type { EmailPreviewData } from '@/components/klaviyo/types';
import { replaceKeyText, type EmailKeyText } from '@/lib/utils/email-html';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';

export function useEmailPreviewEditor() {
  const [preview, setPreview] = useState<EmailPreviewData | null>(null);
  const [editableKeyText, setEditableKeyText] = useState<EmailKeyText>({ headline: '', body: '', cta: '' });
  const [previewTab, setPreviewTab] = useState<'preview' | 'keytext' | 'html'>('preview');

  const safePreviewHtml = useMemo(
    () => sanitizeHtml(preview?.htmlBody ?? ''),
    [preview?.htmlBody]
  );

  const handlePreviewSubjectChange = useCallback((value: string) => {
    setPreview((p) => (p ? { ...p, subject: value } : null));
  }, []);

  const handlePreviewPreheaderChange = useCallback((value: string) => {
    setPreview((p) => (p ? { ...p, preheader: value || null } : null));
  }, []);

  const handlePreviewTabChange = useCallback((tab: 'preview' | 'keytext' | 'html') => {
    setPreviewTab(tab);
  }, []);

  const handleHeadlineChange = useCallback((value: string) => {
    const next = { ...editableKeyText, headline: value };
    setEditableKeyText(next);
    setPreview((p) => (p ? { ...p, htmlBody: replaceKeyText(p.htmlBody, next) } : null));
  }, [editableKeyText]);

  const handleBodyChange = useCallback((value: string) => {
    const next = { ...editableKeyText, body: value };
    setEditableKeyText(next);
    setPreview((p) => (p ? { ...p, htmlBody: replaceKeyText(p.htmlBody, next) } : null));
  }, [editableKeyText]);

  const handleCtaChange = useCallback((value: string) => {
    const next = { ...editableKeyText, cta: value };
    setEditableKeyText(next);
    setPreview((p) => (p ? { ...p, htmlBody: replaceKeyText(p.htmlBody, next) } : null));
  }, [editableKeyText]);

  const handlePreviewHtmlChange = useCallback((value: string) => {
    setPreview((p) => (p ? { ...p, htmlBody: value } : null));
  }, []);

  return {
    preview,
    setPreview,
    editableKeyText,
    setEditableKeyText,
    previewTab,
    setPreviewTab,
    safePreviewHtml,
    handlePreviewSubjectChange,
    handlePreviewPreheaderChange,
    handlePreviewTabChange,
    handleHeadlineChange,
    handleBodyChange,
    handleCtaChange,
    handlePreviewHtmlChange,
  };
}
