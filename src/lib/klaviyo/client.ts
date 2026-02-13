/**
 * Klaviyo API client
 * Phase 2: Email Studio - templates and campaigns
 * @see https://developers.klaviyo.com/en/reference/api_overview
 */

import { config } from '@/config';

const BASE_URL = 'https://a.klaviyo.com/api';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getApiKey(): string {
  const key = config.klaviyo.apiKey || process.env.KLAVIYO_PRIVATE_API_KEY;
  if (!key) {
    throw new Error('KLAVIYO_PRIVATE_API_KEY is not configured');
  }
  return key;
}

function getHeaders(useRevision: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Klaviyo-API-Key ${getApiKey()}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
  if (useRevision && config.klaviyo.revision) {
    headers['revision'] = config.klaviyo.revision;
  }
  return headers;
}

/**
 * Templates API (may not require revision header for some endpoints)
 */
export async function listTemplates(): Promise<{ id: string; name: string; created?: string; updated?: string }[]> {
  const res = await fetch(`${BASE_URL}/templates`, {
    headers: getHeaders(false), // Templates API is often legacy
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo listTemplates failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  // v1.2 returns { data: [...] } or direct array; newer may use JSON:API
  const items = Array.isArray(data) ? data : data?.data ?? [];
  return items.map((t: { id?: string; template_id?: string; name?: string; created?: string; updated?: string }) => ({
    id: t.id ?? t.template_id ?? '',
    name: t.name ?? 'Untitled',
    created: t.created,
    updated: t.updated,
  }));
}

export async function getTemplate(id: string): Promise<{ id: string; name: string; html?: string; plain_text?: string }> {
  const res = await fetch(`${BASE_URL}/templates/${encodeURIComponent(id)}`, {
    headers: getHeaders(false),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo getTemplate failed: ${res.status} ${err}`);
  }
  const t = await res.json();
  const raw = t?.data ?? t;
  return {
    id: raw.id ?? raw.template_id ?? id,
    name: raw.name ?? 'Untitled',
    html: raw.html ?? raw.body_html,
    plain_text: raw.plain_text ?? raw.body_plain,
  };
}

export async function createTemplate(params: { name: string; html: string; editorType?: 'CODE' | 'USER_DRAGGABLE'; plainText?: string }): Promise<{ id: string }> {
  const body = {
    data: {
      type: 'template',
      attributes: {
        name: params.name,
        editor_type: params.editorType ?? 'CODE',
        html: params.html,
        ...(params.plainText != null && { text: params.plainText }),
      },
    },
  };
  const res = await fetch(`${BASE_URL}/templates`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo createTemplate failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const raw = data?.data ?? data;
  const templateId = raw?.id ?? raw?.template_id;
  if (!templateId) {
    throw new Error('Klaviyo createTemplate did not return template id');
  }
  return { id: templateId };
}

/**
 * Campaigns API (revisioned)
 */
export async function listCampaigns(filterChannel: 'email' | 'sms' | 'mobile_push' = 'email'): Promise<{ id: string; name: string; created_at?: string; updated_at?: string; status?: string }[]> {
  const filter = filterChannel ? `?filter=equals(messages.channel,"${filterChannel}")` : '';
  const res = await fetch(`${BASE_URL}/campaigns${filter}`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo listCampaigns failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const items = data?.data ?? [];
  return items.map((c: { id: string; attributes?: { name?: string; created_at?: string; updated_at?: string; status?: string } }) => ({
    id: c.id,
    name: c.attributes?.name ?? 'Untitled',
    created_at: c.attributes?.created_at,
    updated_at: c.attributes?.updated_at,
    status: c.attributes?.status,
  }));
}

export async function getCampaignMessage(campaignId: string, messageId: string): Promise<{
  id: string;
  subject?: string;
  preview_text?: string;
  templateId?: string;
  from_email?: string;
  from_label?: string;
}> {
  const res = await fetch(`${BASE_URL}/campaign-messages/${encodeURIComponent(messageId)}`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo getCampaignMessage failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const raw = data?.data ?? data;
  const attrs = raw?.attributes ?? raw;
  const content = attrs?.content ?? attrs?.definition?.content ?? {};
  const relationships = raw?.relationships;
  let templateId: string | undefined;
  if (relationships?.['template']?.data?.id) {
    templateId = relationships['template'].data.id;
  }
  return {
    id: raw?.id ?? messageId,
    subject: content.subject ?? attrs?.subject,
    preview_text: content.preview_text ?? content.preview_text,
    templateId,
    from_email: content.from_email,
    from_label: content.from_label,
  };
}

/**
 * Get the template (with HTML) for a campaign message.
 * Use this instead of getTemplate(id) for campaign messages, as the message uses a copy of the template.
 */
export async function getTemplateForCampaignMessage(messageId: string): Promise<{ id: string; name: string; html?: string; plain_text?: string }> {
  const res = await fetch(`${BASE_URL}/campaign-messages/${encodeURIComponent(messageId)}/template`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo getTemplateForCampaignMessage failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const raw = data?.data ?? data;
  return {
    id: raw?.id ?? messageId,
    name: raw?.attributes?.name ?? raw?.name ?? 'Untitled',
    html: raw?.attributes?.html ?? raw?.html ?? raw?.body_html,
    plain_text: raw?.attributes?.plain_text ?? raw?.plain_text ?? raw?.body_plain,
  };
}

/**
 * Get campaign messages for a campaign (to list message IDs)
 */
export async function getCampaignMessages(campaignId: string): Promise<{ id: string; label?: string }[]> {
  const res = await fetch(`${BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/campaign-messages`, {
    headers: getHeaders(true),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo getCampaignMessages failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const items = data?.data ?? [];
  return items.map((m: { id: string; attributes?: { label?: string } }) => ({
    id: m.id,
    label: m.attributes?.label,
  }));
}

/**
 * Create campaign (draft) with one email message
 */
export async function createCampaign(params: {
  name: string;
  subject: string;
  previewText?: string;
  fromEmail?: string;
  fromLabel?: string;
  replyToEmail?: string;
}): Promise<{ campaignId: string; messageId: string }> {
  const senderDefaults = getKlaviyoSenderDefaults();
  const fromEmail = params.fromEmail ?? senderDefaults.fromEmail;
  const fromLabel = params.fromLabel ?? senderDefaults.fromLabel;
  const replyToEmail = params.replyToEmail ?? senderDefaults.replyToEmail ?? fromEmail;

  if (!fromEmail || !fromLabel || !replyToEmail) {
    throw new Error(
      'Klaviyo sender config missing. Set KLAVIYO_DEFAULT_FROM_EMAIL, KLAVIYO_DEFAULT_FROM_LABEL, and KLAVIYO_DEFAULT_REPLY_TO_EMAIL.'
    );
  }
  if (!EMAIL_REGEX.test(fromEmail) || !EMAIL_REGEX.test(replyToEmail)) {
    throw new Error('Klaviyo sender email config is invalid');
  }

  const res = await fetch(`${BASE_URL}/campaigns`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({
      data: {
        type: 'campaign',
        attributes: {
          name: params.name,
          audiences: { included: [], excluded: [] },
          send_strategy: { method: 'immediate' },
          'campaign-messages': {
            data: [
              {
                type: 'campaign-message',
                attributes: {
                  channel: 'email',
                  label: params.subject?.slice(0, 255) ?? params.name,
                  content: {
                    subject: params.subject,
                    preview_text: params.previewText ?? '',
                    from_email: fromEmail,
                    from_label: fromLabel,
                    reply_to_email: replyToEmail,
                  },
                },
              },
            ],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo createCampaign failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  const campaign = data?.data;
  const campaignId = campaign?.id;
  const messageRef = campaign?.relationships?.['campaign-messages']?.data?.[0];
  const messageId = messageRef?.id;
  if (!campaignId) {
    throw new Error('Klaviyo createCampaign did not return campaign id');
  }
  return { campaignId, messageId: messageId ?? '' };
}

/**
 * Assign a template to a campaign message
 */
export async function assignTemplateToCampaignMessage(messageId: string, templateId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/campaign-message-assign-template`, {
    method: 'POST',
    headers: getHeaders(true),
    body: JSON.stringify({
      data: {
        type: 'campaign-message-assign-template',
        attributes: {},
        relationships: {
          'campaign-message': { data: { type: 'campaign-message', id: messageId } },
          template: { data: { type: 'template', id: templateId } },
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo assignTemplateToCampaignMessage failed: ${res.status} ${err}`);
  }
}

/**
 * Update campaign message content (subject, preview text, etc.)
 */
export async function updateCampaignMessage(
  messageId: string,
  updates: { subject?: string; preview_text?: string; from_email?: string; from_label?: string }
): Promise<void> {
  const res = await fetch(`${BASE_URL}/campaign-messages/${encodeURIComponent(messageId)}`, {
    method: 'PATCH',
    headers: getHeaders(true),
    body: JSON.stringify({
      data: {
        type: 'campaign-message',
        id: messageId,
        attributes: {
          ...(updates.subject !== undefined && { subject: updates.subject }),
          ...(updates.preview_text !== undefined && { preview_text: updates.preview_text }),
          ...(updates.from_email !== undefined && { from_email: updates.from_email }),
          ...(updates.from_label !== undefined && { from_label: updates.from_label }),
        },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Klaviyo updateCampaignMessage failed: ${res.status} ${err}`);
  }
}

export function isKlaviyoConfigured(): boolean {
  return Boolean(config.klaviyo.apiKey || process.env.KLAVIYO_PRIVATE_API_KEY);
}

export function getKlaviyoSenderDefaults(): {
  fromEmail: string;
  fromLabel: string;
  replyToEmail: string;
} {
  return {
    fromEmail: config.klaviyo.defaultFromEmail.trim(),
    fromLabel: config.klaviyo.defaultFromLabel.trim(),
    replyToEmail: config.klaviyo.defaultReplyToEmail.trim(),
  };
}

export function getMissingKlaviyoSenderConfig(): string[] {
  const sender = getKlaviyoSenderDefaults();
  const missing: string[] = [];
  if (!sender.fromEmail) {
    missing.push('KLAVIYO_DEFAULT_FROM_EMAIL');
  } else if (!EMAIL_REGEX.test(sender.fromEmail)) {
    missing.push('KLAVIYO_DEFAULT_FROM_EMAIL (invalid email format)');
  }
  if (!sender.fromLabel) {
    missing.push('KLAVIYO_DEFAULT_FROM_LABEL');
  }
  if (!sender.replyToEmail) {
    missing.push('KLAVIYO_DEFAULT_REPLY_TO_EMAIL');
  } else if (!EMAIL_REGEX.test(sender.replyToEmail)) {
    missing.push('KLAVIYO_DEFAULT_REPLY_TO_EMAIL (invalid email format)');
  }
  return missing;
}
