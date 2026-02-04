import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN || '';
const shopifyAccessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '';

/**
 * Check if Shopify is configured
 */
export function isShopifyConfigured(): boolean {
  return Boolean(shopifyDomain && shopifyAccessToken);
}

/**
 * Initialize Shopify API client
 */
export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: ['write_products', 'read_products'],
  hostName: shopifyDomain?.replace('https://', '').replace('.myshopify.com', '') || '',
  apiVersion: ApiVersion.January26,
  isEmbeddedApp: false,
});

/**
 * Create a session for Admin API requests
 * Returns null if Shopify is not configured
 */
export function createAdminSession(): Session | null {
  if (!isShopifyConfigured()) {
    return null;
  }
  
  return new Session({
    id: `offline_${shopifyDomain}`,
    shop: shopifyDomain,
    state: '',
    isOnline: false,
    accessToken: shopifyAccessToken,
  });
}

/**
 * Get GraphQL client for Admin API
 * Returns null if Shopify is not configured
 */
export function getGraphQLClient() {
  if (!isShopifyConfigured()) {
    console.warn('Shopify is not configured. Skipping GraphQL client creation.');
    return null;
  }
  
  const session = createAdminSession();
  if (!session) return null;
  
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
