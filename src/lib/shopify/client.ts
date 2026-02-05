import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import { createClient } from '@supabase/supabase-js';

const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN || '';

// Cache for the OAuth token
let cachedToken: string | null = null;
let tokenFetchedAt: number = 0;
const TOKEN_CACHE_MS = 60000; // Cache for 1 minute

/**
 * Get Shopify access token from Supabase (OAuth) or env var (fallback)
 */
async function getAccessToken(): Promise<string | null> {
  // Check env var first (for backwards compatibility)
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }
  
  // Check cache
  if (cachedToken && Date.now() - tokenFetchedAt < TOKEN_CACHE_MS) {
    return cachedToken;
  }
  
  // Fetch from Supabase
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('provider', 'shopify')
      .eq('shop', shopifyDomain)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    cachedToken = data.access_token;
    tokenFetchedAt = Date.now();
    return cachedToken;
  } catch (error) {
    console.error('Failed to fetch Shopify token:', error);
    return null;
  }
}

/**
 * Check if Shopify is configured (has domain and token)
 */
export async function isShopifyConfigured(): Promise<boolean> {
  if (!shopifyDomain) return false;
  const token = await getAccessToken();
  return Boolean(token);
}

/**
 * Check if Shopify has basic config (for showing auth button)
 */
export function hasShopifyConfig(): boolean {
  return Boolean(
    shopifyDomain &&
    process.env.SHOPIFY_API_KEY &&
    process.env.SHOPIFY_API_SECRET
  );
}

/**
 * Initialize Shopify API client
 */
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: ['write_products', 'read_products', 'write_inventory', 'read_inventory'],
  hostName: shopifyDomain?.replace('https://', '').replace('.myshopify.com', '') || '',
  apiVersion: ApiVersion.January25,
  isEmbeddedApp: false,
});

/**
 * Create a session for Admin API requests
 * Returns null if Shopify is not configured
 */
export async function createAdminSession(): Promise<Session | null> {
  const token = await getAccessToken();
  
  if (!shopifyDomain || !token) {
    return null;
  }
  
  return new Session({
    id: `offline_${shopifyDomain}`,
    shop: shopifyDomain,
    state: '',
    isOnline: false,
    accessToken: token,
  });
}

/**
 * Get GraphQL client for Admin API
 * Returns null if Shopify is not configured
 */
export async function getGraphQLClient() {
  const session = await createAdminSession();
  
  if (!session) {
    console.warn('Shopify is not configured. Skipping GraphQL client creation.');
    return null;
  }
  
  return new shopify.clients.Graphql({ session });
}

/**
 * GraphQL mutation to create a draft product
 * IMPORTANT: Always creates with status: DRAFT per PRD requirements
 */
export const CREATE_PRODUCT_MUTATION = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        handle
        status
        variants(first: 1) {
          edges {
            node {
              id
              price
              sku
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

/**
 * GraphQL mutation to add images to a product
 */
export const ADD_PRODUCT_IMAGES_MUTATION = `
  mutation productAppendImages($input: ProductAppendImagesInput!) {
    productAppendImages(input: $input) {
      newImages {
        id
        src
        altText
      }
      userErrors {
        field
        message
      }
    }
  }
`;
