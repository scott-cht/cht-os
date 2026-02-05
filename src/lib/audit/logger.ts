/**
 * Audit Logger
 * 
 * Records actions to the audit_log table for compliance and debugging.
 */

import { createServerClient } from '@/lib/supabase/server';

export type EntityType = 'inventory_item' | 'product_onboarding' | 'oauth_token' | 'sync';
export type AuditAction = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'archive' 
  | 'unarchive'
  | 'sync_started'
  | 'sync_completed'
  | 'sync_failed'
  | 'price_update'
  | 'bulk_operation';

interface AuditLogEntry {
  entityType: EntityType;
  entityId: string;
  action: AuditAction;
  changes?: Record<string, { old: unknown; new: unknown }>;
  metadata?: Record<string, unknown>;
  summary?: string;
  userId?: string;
  userEmail?: string;
}

/**
 * Log an action to the audit log
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createServerClient();

    await supabase.from('audit_log').insert({
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      action: entry.action,
      changes: entry.changes || null,
      metadata: entry.metadata || null,
      summary: entry.summary || generateSummary(entry),
      user_id: entry.userId || null,
      user_email: entry.userEmail || null,
    });
  } catch (error) {
    // Don't throw - audit logging should not break main operations
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Generate a human-readable summary of the action
 */
function generateSummary(entry: AuditLogEntry): string {
  const actionDescriptions: Record<AuditAction, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    archive: 'Archived',
    unarchive: 'Unarchived',
    sync_started: 'Sync started',
    sync_completed: 'Sync completed',
    sync_failed: 'Sync failed',
    price_update: 'Price updated',
    bulk_operation: 'Bulk operation performed',
  };

  const base = actionDescriptions[entry.action] || entry.action;
  
  if (entry.changes) {
    const changedFields = Object.keys(entry.changes);
    if (changedFields.length > 0) {
      return `${base}: ${changedFields.join(', ')}`;
    }
  }

  return base;
}

/**
 * Log inventory item creation
 */
export async function logInventoryCreate(
  itemId: string,
  itemData: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    entityType: 'inventory_item',
    entityId: itemId,
    action: 'create',
    metadata: { ...metadata, initialData: itemData },
    summary: `Created ${itemData.brand} ${itemData.model}`,
  });
}

/**
 * Log inventory item update with field changes
 */
export async function logInventoryUpdate(
  itemId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  
  for (const key of Object.keys(newData)) {
    if (oldData[key] !== newData[key]) {
      changes[key] = { old: oldData[key], new: newData[key] };
    }
  }

  if (Object.keys(changes).length > 0) {
    await logAuditEvent({
      entityType: 'inventory_item',
      entityId: itemId,
      action: 'update',
      changes,
      metadata,
    });
  }
}

/**
 * Log sync operation
 */
export async function logSync(
  itemId: string,
  success: boolean,
  platforms: {
    shopify?: { success: boolean; productId?: string; error?: string };
    hubspot?: { success: boolean; dealId?: string; error?: string };
    notion?: { success: boolean; pageId?: string; error?: string };
  },
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    entityType: 'inventory_item',
    entityId: itemId,
    action: success ? 'sync_completed' : 'sync_failed',
    metadata: { ...metadata, platforms },
    summary: success 
      ? `Synced to ${Object.keys(platforms).filter(p => platforms[p as keyof typeof platforms]?.success).join(', ')}`
      : `Sync failed: ${Object.entries(platforms).filter(([, v]) => !v?.success).map(([k]) => k).join(', ')}`,
  });
}

/**
 * Log bulk operation
 */
export async function logBulkOperation(
  action: string,
  itemIds: string[],
  results: { success: number; failed: number },
  metadata?: Record<string, unknown>
): Promise<void> {
  // Log as a single entry with all item IDs in metadata
  await logAuditEvent({
    entityType: 'inventory_item',
    entityId: itemIds[0], // Primary reference
    action: 'bulk_operation',
    metadata: {
      ...metadata,
      bulkAction: action,
      itemIds,
      results,
    },
    summary: `Bulk ${action}: ${results.success} succeeded, ${results.failed} failed`,
  });
}
