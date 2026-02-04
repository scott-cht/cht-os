/**
 * CHT Operating System - Sync Service
 * 
 * Publishes inventory items to:
 * - Shopify (as DRAFT, with pre-owned tags if applicable)
 * - HubSpot (Create Deal for trade-ins)
 * - Notion (Global Inventory database)
 */

import type { InventoryItem, SyncResult } from '@/types';

interface ShopifyConfig {
  storeDomain: string;
  accessToken: string;
}

interface HubSpotConfig {
  accessToken: string;
  pipelineId: string;
  stageId: string;
}

interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

/**
 * Main publish function - orchestrates sync to all platforms
 */
export async function publishProduct(item: InventoryItem): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    errors: [],
  };

  // 1. Sync to Shopify
  try {
    const shopifyResult = await syncToShopify(item);
    result.shopify = shopifyResult;
  } catch (error) {
    result.errors?.push(`Shopify: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 2. Sync to HubSpot (only for trade-ins/ex-demo)
  if (item.listing_type !== 'new') {
    try {
      const hubspotResult = await syncToHubSpot(item);
      result.hubspot = hubspotResult;
    } catch (error) {
      result.errors?.push(`HubSpot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // 3. Sync to Notion
  try {
    const notionResult = await syncToNotion(item);
    result.notion = notionResult;
  } catch (error) {
    result.errors?.push(`Notion: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error('Shopify credentials not configured');
  }

  // Build tags
  const tags: string[] = [item.brand.toLowerCase()];
  if (item.listing_type === 'trade_in') {
    tags.push('pre-owned', 'trade-in');
  } else if (item.listing_type === 'ex_demo') {
    tags.push('pre-owned', 'ex-demo');
  }
  if (item.condition_grade) {
    tags.push(`condition-${item.condition_grade}`);
  }

  // GraphQL mutation to create product
  const mutation = `
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

  const variables = {
    input: {
      title: item.title || `${item.brand} ${item.model}`,
      descriptionHtml: item.description_html || buildDescription(item),
      vendor: item.brand,
      productType: item.listing_type === 'new' ? 'New' : 'Pre-Owned',
      status: 'DRAFT',
      tags: tags,
      metafields: [
        {
          namespace: 'cht',
          key: 'listing_type',
          value: item.listing_type,
          type: 'single_line_text_field',
        },
        {
          namespace: 'cht',
          key: 'model_number',
          value: item.model,
          type: 'single_line_text_field',
        },
        ...(item.serial_number ? [{
          namespace: 'cht',
          key: 'serial_number',
          value: item.serial_number,
          type: 'single_line_text_field',
        }] : []),
        ...(item.condition_grade ? [{
          namespace: 'cht',
          key: 'condition_grade',
          value: item.condition_grade,
          type: 'single_line_text_field',
        }] : []),
        ...(item.condition_report ? [{
          namespace: 'cht',
          key: 'condition_report',
          value: item.condition_report,
          type: 'multi_line_text_field',
        }] : []),
      ],
      variants: [{
        price: item.sale_price.toString(),
        sku: item.sku || `${item.brand}-${item.model}`.toUpperCase().replace(/\s+/g, '-'),
        inventoryManagement: 'SHOPIFY',
        inventoryPolicy: 'DENY',
        ...(item.rrp_aud ? { compareAtPrice: item.rrp_aud.toString() } : {}),
      }],
    },
  };

  const response = await fetch(`https://${storeDomain}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const result = await response.json();

  if (result.data?.productCreate?.userErrors?.length > 0) {
    throw new Error(result.data.productCreate.userErrors.map((e: { message: string }) => e.message).join(', '));
  }

  const product = result.data?.productCreate?.product;
  if (!product) {
    throw new Error('Failed to create Shopify product');
  }

  const productId = product.legacyResourceId;
  const variantId = product.variants.edges[0]?.node?.legacyResourceId;

  return {
    product_id: productId,
    variant_id: variantId,
    admin_url: `https://${storeDomain}/admin/products/${productId}`,
  };
}

/**
 * Sync to HubSpot - Create Deal in Inventory Intake pipeline
 */
async function syncToHubSpot(item: InventoryItem): Promise<{
  deal_id: string;
  deal_url: string;
}> {
  const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;
  const pipelineId = process.env.HUBSPOT_PIPELINE_ID || 'default';
  const stageId = process.env.HUBSPOT_INTAKE_STAGE_ID || 'appointmentscheduled';

  if (!accessToken) {
    throw new Error('HubSpot credentials not configured');
  }

  const dealName = `${item.listing_type === 'trade_in' ? 'Trade-In' : 'Ex-Demo'}: ${item.brand} ${item.model}`;

  const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
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
  });

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

  const response = await fetch('https://api.notion.com/v1/pages', {
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
  });

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
