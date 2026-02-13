/**
 * CHT Operating System - Sync Service
 * 
 * Publishes inventory items to:
 * - Shopify (as DRAFT, with pre-owned tags if applicable)
 * - HubSpot (Create Deal for trade-ins)
 * - Notion (Global Inventory database)
 */

import type { InventoryItem, SyncResult } from '@/types';
import { withRetry, isNetworkError } from '@/lib/utils/retry';
import { config } from '@/config';

/**
 * Progress callbacks for real-time updates
 */
interface SyncProgressCallbacks {
  onPlatformStart?: (platform: 'shopify' | 'hubspot' | 'notion') => Promise<void>;
  onPlatformComplete?: (
    platform: 'shopify' | 'hubspot' | 'notion',
    result: { success: boolean; productId?: string; dealId?: string; pageId?: string; error?: string }
  ) => Promise<void>;
}

/**
 * Main publish function - orchestrates sync to all platforms
 */
export async function publishProduct(
  item: InventoryItem,
  callbacks?: SyncProgressCallbacks
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    errors: [],
  };

  // 1. Sync to Shopify
  try {
    await callbacks?.onPlatformStart?.('shopify');
    const shopifyResult = await syncToShopify(item);
    result.shopify = shopifyResult;
    await callbacks?.onPlatformComplete?.('shopify', { 
      success: true, 
      productId: shopifyResult.product_id 
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors?.push(`Shopify: ${errorMsg}`);
    await callbacks?.onPlatformComplete?.('shopify', { success: false, error: errorMsg });
  }

  // 2. Sync to HubSpot (only for trade-ins/ex-demo)
  if (item.listing_type !== 'new') {
    try {
      await callbacks?.onPlatformStart?.('hubspot');
      const hubspotResult = await syncToHubSpot(item);
      result.hubspot = hubspotResult;
      await callbacks?.onPlatformComplete?.('hubspot', { 
        success: true, 
        dealId: hubspotResult.deal_id 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors?.push(`HubSpot: ${errorMsg}`);
      await callbacks?.onPlatformComplete?.('hubspot', { success: false, error: errorMsg });
    }
  }

  // 3. Sync to Notion
  try {
    await callbacks?.onPlatformStart?.('notion');
    const notionResult = await syncToNotion(item);
    result.notion = notionResult;
    await callbacks?.onPlatformComplete?.('notion', { 
      success: true, 
      pageId: notionResult.page_id 
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors?.push(`Notion: ${errorMsg}`);
    await callbacks?.onPlatformComplete?.('notion', { success: false, error: errorMsg });
  }

  // Set overall success based on errors
  result.success = (result.errors?.length || 0) === 0;

  return result;
}

/**
 * Sync to Shopify - Create product as DRAFT
 */
async function syncToShopify(item: InventoryItem): Promise<{
  product_id: string;
  variant_id: string;
  admin_url: string;
}> {
  const { storeDomain, accessToken } = await getShopifyCredentials();
  const tags = buildShopifyTags(item);
  const metafields = buildShopifyMetafields(item);
  const title = item.title || `${item.brand} ${item.model}`;
  const descriptionHtml = item.description_html || buildDescription(item);
  const productType = item.listing_type === 'new' ? 'New' : 'Pre-Owned';

  // Update path: item already linked to Shopify.
  if (item.shopify_product_id) {
    const updateMutation = `
      mutation productUpdate($input: ProductUpdateInput!) {
        productUpdate(input: $input) {
          product {
            id
            legacyResourceId
            variants(first: 1) {
              edges {
                node {
                  id
                  legacyResourceId
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateResult = await requestShopifyGraphQL<{
      data?: {
        productUpdate?: {
          product?: {
            legacyResourceId?: string;
            variants?: { edges?: Array<{ node?: { legacyResourceId?: string } }> };
          };
          userErrors?: Array<{ message: string }>;
        };
      };
      errors?: Array<{ message: string }>;
    }>(storeDomain, accessToken, updateMutation, {
      input: {
        id: `gid://shopify/Product/${item.shopify_product_id}`,
        title,
        descriptionHtml,
        vendor: item.brand,
        productType,
        tags,
        metafields,
      },
    });

    if (updateResult.errors?.length) {
      throw new Error(updateResult.errors.map((e) => e.message).join(', '));
    }
    if (updateResult.data?.productUpdate?.userErrors?.length) {
      throw new Error(updateResult.data.productUpdate.userErrors.map((e) => e.message).join(', '));
    }

    const product = updateResult.data?.productUpdate?.product;
    if (!product?.legacyResourceId) {
      throw new Error('Failed to update Shopify product');
    }

    const variantId =
      item.shopify_variant_id ||
      product.variants?.edges?.[0]?.node?.legacyResourceId ||
      '';

    if (variantId) {
      const variantUpdateMutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              legacyResourceId
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variantUpdateResult = await requestShopifyGraphQL<{
        data?: {
          productVariantsBulkUpdate?: {
            userErrors?: Array<{ message: string }>;
          };
        };
        errors?: Array<{ message: string }>;
      }>(storeDomain, accessToken, variantUpdateMutation, {
        productId: `gid://shopify/Product/${product.legacyResourceId}`,
        variants: [
          {
            id: `gid://shopify/ProductVariant/${variantId}`,
            price: item.sale_price.toString(),
            sku: item.sku || `${item.brand}-${item.model}`.toUpperCase().replace(/\s+/g, '-'),
            ...(item.rrp_aud ? { compareAtPrice: item.rrp_aud.toString() } : { compareAtPrice: null }),
          },
        ],
      });

      if (variantUpdateResult.errors?.length) {
        throw new Error(variantUpdateResult.errors.map((e) => e.message).join(', '));
      }
      if (variantUpdateResult.data?.productVariantsBulkUpdate?.userErrors?.length) {
        throw new Error(
          variantUpdateResult.data.productVariantsBulkUpdate.userErrors
            .map((e) => e.message)
            .join(', ')
        );
      }
    }

    return {
      product_id: product.legacyResourceId,
      variant_id: variantId || item.shopify_variant_id || '',
      admin_url: `https://${storeDomain}/admin/products/${product.legacyResourceId}`,
    };
  }

  // Create path: no existing linkage, always create as DRAFT.
  const createMutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          legacyResourceId
          variants(first: 1) {
            edges {
              node {
                id
                legacyResourceId
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const createResult = await requestShopifyGraphQL<{
    data?: {
      productCreate?: {
        product?: {
          legacyResourceId?: string;
          variants?: { edges?: Array<{ node?: { legacyResourceId?: string } }> };
        };
        userErrors?: Array<{ message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  }>(storeDomain, accessToken, createMutation, {
    input: {
      title,
      descriptionHtml,
      vendor: item.brand,
      productType,
      status: 'DRAFT',
      tags,
      metafields,
      variants: [
        {
          price: item.sale_price.toString(),
          sku: item.sku || `${item.brand}-${item.model}`.toUpperCase().replace(/\s+/g, '-'),
          inventoryManagement: 'SHOPIFY',
          inventoryPolicy: 'DENY',
          ...(item.rrp_aud ? { compareAtPrice: item.rrp_aud.toString() } : {}),
        },
      ],
    },
  });

  if (createResult.errors?.length) {
    throw new Error(createResult.errors.map((e) => e.message).join(', '));
  }
  if (createResult.data?.productCreate?.userErrors?.length) {
    throw new Error(createResult.data.productCreate.userErrors.map((e) => e.message).join(', '));
  }

  const product = createResult.data?.productCreate?.product;
  if (!product?.legacyResourceId) {
    throw new Error('Failed to create Shopify product');
  }

  return {
    product_id: product.legacyResourceId,
    variant_id: product.variants?.edges?.[0]?.node?.legacyResourceId || '',
    admin_url: `https://${storeDomain}/admin/products/${product.legacyResourceId}`,
  };
}

async function getShopifyCredentials(): Promise<{ storeDomain: string; accessToken: string }> {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  let accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!accessToken) {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('provider', 'shopify')
      .eq('shop', storeDomain)
      .single();

    accessToken = data?.access_token;
  }

  if (!storeDomain || !accessToken) {
    throw new Error('Shopify credentials not configured. Please connect Shopify from the dashboard.');
  }

  return { storeDomain, accessToken };
}

function buildShopifyTags(item: InventoryItem): string[] {
  const tags: string[] = [item.brand.toLowerCase()];
  if (item.listing_type === 'trade_in') {
    tags.push('pre-owned', 'trade-in');
  } else if (item.listing_type === 'ex_demo') {
    tags.push('pre-owned', 'ex-demo');
  }
  if (item.condition_grade) {
    tags.push(`condition-${item.condition_grade}`);
  }
  return tags;
}

function buildShopifyMetafields(item: InventoryItem): Array<{
  namespace: string;
  key: string;
  value: string;
  type: string;
}> {
  const namespace = config.shopify.metafieldNamespace || 'cht';
  return [
    {
      namespace,
      key: 'listing_type',
      value: item.listing_type,
      type: 'single_line_text_field',
    },
    {
      namespace,
      key: 'model_number',
      value: item.model,
      type: 'single_line_text_field',
    },
    ...(item.serial_number
      ? [
          {
            namespace,
            key: 'serial_number',
            value: item.serial_number,
            type: 'single_line_text_field',
          },
        ]
      : []),
    ...(item.condition_grade
      ? [
          {
            namespace,
            key: 'condition_grade',
            value: item.condition_grade,
            type: 'single_line_text_field',
          },
        ]
      : []),
    ...(item.condition_report
      ? [
          {
            namespace,
            key: 'condition_report',
            value: item.condition_report,
            type: 'multi_line_text_field',
          },
        ]
      : []),
  ];
}

async function requestShopifyGraphQL<T>(
  storeDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const response = await withRetry(
    () =>
      fetch(`https://${storeDomain}/admin/api/${config.shopify.apiVersion}/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      }),
    {
      retries: 3,
      isRetryable: isNetworkError,
      onRetry: (err, attempt) => console.log(`Shopify retry ${attempt}:`, err),
    }
  );

  return response.json() as Promise<T>;
}

/**
 * Get HubSpot access token via OAuth client credentials
 */
async function getHubSpotAccessToken(): Promise<string> {
  // First check for direct access token (legacy private app)
  if (process.env.HUBSPOT_ACCESS_TOKEN && process.env.HUBSPOT_ACCESS_TOKEN.startsWith('pat-')) {
    return process.env.HUBSPOT_ACCESS_TOKEN;
  }

  // Use OAuth client credentials flow
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('HubSpot credentials not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET, or HUBSPOT_ACCESS_TOKEN');
  }

  const response = await withRetry(
    () => fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }),
    {
      retries: 3,
      isRetryable: isNetworkError,
      onRetry: (err, attempt) => console.log(`HubSpot OAuth retry ${attempt}:`, err),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`HubSpot OAuth failed: ${error.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Sync to HubSpot - Create Deal in Inventory Intake pipeline
 */
async function syncToHubSpot(item: InventoryItem): Promise<{
  deal_id: string;
  deal_url: string;
}> {
  const accessToken = await getHubSpotAccessToken();
  const pipelineId = process.env.HUBSPOT_PIPELINE_ID || 'default';
  const stageId = process.env.HUBSPOT_INTAKE_STAGE_ID || 'appointmentscheduled';

  const dealName = `${item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}: ${item.brand} ${item.model}`;

  const response = await withRetry(
    () => fetch('https://api.hubapi.com/crm/v3/objects/deals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        properties: {
          dealname: dealName,
          pipeline: pipelineId,
          dealstage: stageId,
          amount: item.sale_price.toString(),
          // Custom properties (must be created in HubSpot first)
          cht_brand: item.brand,
          cht_model: item.model,
          cht_serial_number: item.serial_number || '',
          cht_condition_grade: item.condition_grade || '',
          cht_condition_report: item.condition_report || '',
          cht_rrp: item.rrp_aud?.toString() || '',
          cht_listing_type: item.listing_type,
        },
      }),
    }),
    {
      retries: 3,
      isRetryable: isNetworkError,
      onRetry: (err, attempt) => console.log(`HubSpot deal retry ${attempt}:`, err),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create HubSpot deal');
  }

  const deal = await response.json();

  return {
    deal_id: deal.id,
    deal_url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAL_ID}/deal/${deal.id}`,
  };
}

/**
 * Sync to Notion - Append row to Global Inventory database
 */
async function syncToNotion(item: InventoryItem): Promise<{
  page_id: string;
  page_url: string;
}> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_INVENTORY_DATABASE_ID;

  if (!apiKey || !databaseId) {
    throw new Error('Notion credentials not configured');
  }

  const response = await withRetry(
    () => fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          // Title property (required for Notion databases)
          'Name': {
            title: [{ text: { content: `${item.brand} ${item.model}` } }],
          },
          // Other properties (column names must match your Notion database)
          'Brand': {
            select: { name: item.brand },
          },
          'Model': {
            rich_text: [{ text: { content: item.model } }],
          },
          'Type': {
            select: { name: item.listing_type === 'new' ? 'New' : item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo' },
          },
          'Serial Number': {
            rich_text: [{ text: { content: item.serial_number || 'N/A' } }],
          },
          'RRP': {
            number: item.rrp_aud || 0,
          },
          'Sale Price': {
            number: item.sale_price,
          },
          'Condition': {
            select: item.condition_grade ? { name: item.condition_grade.charAt(0).toUpperCase() + item.condition_grade.slice(1) } : undefined,
          },
          'Status': {
            select: { name: 'Listed' },
          },
          'Shopify ID': {
            rich_text: [{ text: { content: item.shopify_product_id || '' } }],
          },
          'Created': {
            date: { start: new Date().toISOString() },
          },
        },
      }),
    }),
    {
      retries: 3,
      isRetryable: isNetworkError,
      onRetry: (err, attempt) => console.log(`Notion retry ${attempt}:`, err),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create Notion page');
  }

  const page = await response.json();

  return {
    page_id: page.id,
    page_url: page.url,
  };
}

/**
 * Build default description HTML for pre-owned items
 */
function buildDescription(item: InventoryItem): string {
  const isPreOwned = item.listing_type !== 'new';
  
  let html = `<div class="product-description">`;
  
  if (isPreOwned) {
    html += `
      <div class="preowned-notice" style="background: #FEF3C7; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
        <strong>Pre-Owned Item</strong>
        <p>This is a ${item.listing_type === 'trade_in' ? 'customer trade-in' : 'former demonstration unit'}.</p>
        ${item.condition_grade ? `<p>Condition: <strong>${item.condition_grade.charAt(0).toUpperCase() + item.condition_grade.slice(1)}</strong></p>` : ''}
      </div>
    `;
  }
  
  html += `
    <h3>Product Details</h3>
    <ul>
      <li><strong>Brand:</strong> ${item.brand}</li>
      <li><strong>Model:</strong> ${item.model}</li>
      ${item.serial_number ? `<li><strong>Serial Number:</strong> ${item.serial_number}</li>` : ''}
    </ul>
  `;
  
  if (item.condition_report) {
    html += `
      <h3>Condition Notes</h3>
      <p>${item.condition_report}</p>
    `;
  }
  
  html += `</div>`;
  
  return html;
}
