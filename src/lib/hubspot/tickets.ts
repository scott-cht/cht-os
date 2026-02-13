import { config } from '@/config';
import type { RmaStatus } from '@/types';

const HUBSPOT_BASE_URL = 'https://api.hubapi.com/crm/v3/objects/tickets';

function getHubSpotAccessToken(): string {
  const token = process.env.HUBSPOT_ACCESS_TOKEN || '';
  if (!token) {
    throw new Error('HUBSPOT_ACCESS_TOKEN is not configured');
  }
  return token;
}

export function isHubSpotTicketConfigured(): boolean {
  const token = process.env.HUBSPOT_ACCESS_TOKEN || '';
  const pipelineId = config.hubspot.rmaPipelineId;
  const stageMap = config.hubspot.rmaStages;
  return Boolean(
    token &&
      pipelineId &&
      stageMap.received &&
      stageMap.testing &&
      stageMap.sent_to_manufacturer &&
      stageMap.repaired_replaced &&
      stageMap.back_to_customer
  );
}

function mapStatusToStage(status: RmaStatus): string {
  const stage = config.hubspot.rmaStages[status];
  if (!stage) {
    throw new Error(`No HubSpot stage configured for status: ${status}`);
  }
  return stage;
}

export async function createHubSpotTicket(input: {
  rmaCaseId: string;
  subject: string;
  content: string;
  serialNumber?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  status: RmaStatus;
}): Promise<{ ticketId: string; ticketUrl: string | null }> {
  if (!isHubSpotTicketConfigured()) {
    throw new Error('HubSpot ticket integration is not fully configured');
  }

  const token = getHubSpotAccessToken();
  const payload = {
    properties: {
      hs_pipeline: config.hubspot.rmaPipelineId,
      hs_pipeline_stage: mapStatusToStage(input.status),
      subject: input.subject,
      content: input.content,
      rma_case_id: input.rmaCaseId,
      serial_number: input.serialNumber || '',
      customer_email: input.customerEmail || '',
      customer_phone: input.customerPhone || '',
    },
  };

  const response = await fetch(HUBSPOT_BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HubSpot create ticket failed: ${response.status} ${errorBody}`);
  }

  const data = await response.json();
  const ticketId = data.id as string;
  const ticketUrl = config.hubspot.portalId
    ? `https://app.hubspot.com/contacts/${config.hubspot.portalId}/ticket/${ticketId}`
    : null;

  return { ticketId, ticketUrl };
}

export async function updateHubSpotTicketStatus(input: {
  ticketId: string;
  status: RmaStatus;
  summary?: string;
}) {
  if (!isHubSpotTicketConfigured()) {
    throw new Error('HubSpot ticket integration is not fully configured');
  }

  const token = getHubSpotAccessToken();
  const payload = {
    properties: {
      hs_pipeline_stage: mapStatusToStage(input.status),
      ...(input.summary ? { content: input.summary } : {}),
    },
  };

  const response = await fetch(`${HUBSPOT_BASE_URL}/${encodeURIComponent(input.ticketId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`HubSpot update ticket failed: ${response.status} ${errorBody}`);
  }
}

export async function syncRmaStatusToHubSpotTicket(input: {
  rmaCaseId: string;
  hubspotTicketId?: string | null;
  status: RmaStatus;
  summary?: string | null;
}): Promise<{ attempted: boolean; success: boolean; error: string | null }> {
  if (!input.hubspotTicketId) {
    return { attempted: false, success: false, error: null };
  }
  if (!isHubSpotTicketConfigured()) {
    return {
      attempted: true,
      success: false,
      error: 'HubSpot ticket integration not fully configured',
    };
  }

  try {
    await updateHubSpotTicketStatus({
      ticketId: input.hubspotTicketId,
      status: input.status,
      summary: input.summary || undefined,
    });
    return { attempted: true, success: true, error: null };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown HubSpot ticket sync error',
    };
  }
}
