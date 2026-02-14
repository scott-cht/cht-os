/**
 * Product Matching Engine
 * 
 * Matches Shopify products to pricelist/inventory items using:
 * 1. SKU exact match (highest confidence)
 * 2. Brand + Model exact match
 * 3. Brand + Model fuzzy match (Levenshtein distance)
 */

import { createClient } from '@supabase/supabase-js';
import type { MatchSuggestion, ShopifyProduct } from '@/types/shopify-products';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Normalize text for comparison
 * Removes common variations and noise
 */
function normalizeText(text: string): string {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Extract potential brand from product title or vendor
 */
function extractBrand(product: ShopifyProduct): string {
  // Prefer vendor field
  if (product.vendor) {
    return normalizeText(product.vendor);
  }
  
  // Fall back to first word of title
  const firstWord = product.title.split(/\s+/)[0];
  return normalizeText(firstWord || '');
}

/**
 * Extract potential model from product
 */
function extractModel(product: ShopifyProduct): string {
  const brand = extractBrand(product);
  
  // Try to get model from title by removing brand
  let model = normalizeText(product.title);
  if (brand && model.startsWith(brand)) {
    model = model.substring(brand.length).trim();
  }
  
  // Also check product type
  if (!model && product.product_type) {
    model = normalizeText(product.product_type);
  }
  
  return model;
}

/**
 * Extract SKU from product variants
 */
function extractSku(product: ShopifyProduct): string | null {
  if (!product.variants || product.variants.length === 0) {
    return null;
  }
  
  // Return first non-null SKU
  for (const variant of product.variants) {
    if (variant.sku) {
      return variant.sku.trim();
    }
  }
  
  return null;
}

/**
 * Find matching inventory items for a Shopify product
 */
export async function findMatches(
  product: ShopifyProduct,
  limit: number = 10
): Promise<MatchSuggestion[]> {
  const suggestions: MatchSuggestion[] = [];
  const seenIds = new Set<string>();

  const productSku = extractSku(product);
  const productBrand = extractBrand(product);
  const productModel = extractModel(product);

  // 1. SKU Exact Match (highest priority)
  if (productSku) {
    const { data: skuMatches } = await supabase
      .from('inventory_items')
      .select('id, brand, model, sku, rrp_aud, sale_price, cost_price')
      .eq('sku', productSku)
      .eq('is_archived', false)
      .limit(5);

    if (skuMatches) {
      for (const item of skuMatches) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          suggestions.push({
            inventoryItem: {
              id: item.id,
              brand: item.brand,
              model: item.model,
              sku: item.sku,
              rrp_aud: item.rrp_aud,
              sale_price: item.sale_price,
            },
            matchType: 'sku_exact',
            confidence: 100,
            matchDetails: {
              skuMatch: true,
              brandMatch: normalizeText(item.brand) === productBrand,
              modelMatch: normalizeText(item.model) === productModel,
            },
          });
        }
      }
    }
  }

  // 2. Brand + Model Exact Match
  if (productBrand) {
    const { data: brandMatches } = await supabase
      .from('inventory_items')
      .select('id, brand, model, sku, rrp_aud, sale_price, cost_price')
      .ilike('brand', `%${productBrand}%`)
      .eq('is_archived', false)
      .limit(20);

    if (brandMatches) {
      for (const item of brandMatches) {
        if (seenIds.has(item.id)) continue;

        const itemBrand = normalizeText(item.brand);
        const itemModel = normalizeText(item.model);
        
        const brandMatch = itemBrand === productBrand || 
          itemBrand.includes(productBrand) || 
          productBrand.includes(itemBrand);
        
        const modelMatch = itemModel === productModel;
        
        if (brandMatch && modelMatch) {
          seenIds.add(item.id);
          suggestions.push({
            inventoryItem: {
              id: item.id,
              brand: item.brand,
              model: item.model,
              sku: item.sku,
              rrp_aud: item.rrp_aud,
              sale_price: item.sale_price,
            },
            matchType: 'brand_model_exact',
            confidence: 95,
            matchDetails: {
              skuMatch: productSku ? item.sku === productSku : undefined,
              brandMatch: true,
              modelMatch: true,
            },
          });
        }
      }
    }
  }

  // 3. Brand + Model Fuzzy Match
  if (productBrand && suggestions.length < limit) {
    // Get more candidates for fuzzy matching
    const { data: candidates } = await supabase
      .from('inventory_items')
      .select('id, brand, model, sku, rrp_aud, sale_price, cost_price')
      .eq('is_archived', false)
      .limit(100);

    if (candidates) {
      const fuzzyMatches: Array<MatchSuggestion & { score: number }> = [];

      for (const item of candidates) {
        if (seenIds.has(item.id)) continue;

        const itemBrand = normalizeText(item.brand);
        const itemModel = normalizeText(item.model);

        const brandSimilarity = calculateSimilarity(itemBrand, productBrand);
        const modelSimilarity = calculateSimilarity(itemModel, productModel);

        // Only consider if brand is reasonably similar (>70%)
        if (brandSimilarity >= 70) {
          const combinedScore = (brandSimilarity * 0.4) + (modelSimilarity * 0.6);
          
          // Only include if combined score is above threshold
          if (combinedScore >= 50) {
            fuzzyMatches.push({
              inventoryItem: {
                id: item.id,
                brand: item.brand,
                model: item.model,
                sku: item.sku,
                rrp_aud: item.rrp_aud,
                sale_price: item.sale_price,
              },
              matchType: 'brand_model_fuzzy',
              confidence: Math.round(combinedScore),
              matchDetails: {
                skuMatch: productSku ? item.sku === productSku : undefined,
                brandMatch: brandSimilarity >= 80,
                modelMatch: modelSimilarity >= 80,
                similarityScore: combinedScore,
              },
              score: combinedScore,
            });
          }
        }
      }

      // Sort by score and add top matches
      fuzzyMatches
        .sort((a, b) => b.score - a.score)
        .slice(0, limit - suggestions.length)
        .forEach(match => {
          if (!seenIds.has(match.inventoryItem.id)) {
            seenIds.add(match.inventoryItem.id);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { score, ...suggestion } = match;
            suggestions.push(suggestion);
          }
        });
    }
  }

  // Sort all suggestions by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}

/**
 * Link a Shopify product to an inventory item
 */
export async function linkProduct(
  shopifyProductId: string,
  inventoryItemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shopify_products')
      .update({ linked_inventory_id: inventoryItemId })
      .eq('id', shopifyProductId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Unlink a Shopify product from its inventory item
 */
export async function unlinkProduct(
  shopifyProductId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('shopify_products')
      .update({ linked_inventory_id: null })
      .eq('id', shopifyProductId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Auto-match all unlinked Shopify products
 * Only creates links for high-confidence matches (SKU exact or 95%+ confidence)
 */
export async function autoMatchAll(): Promise<{
  matched: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    matched: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Get all unlinked products
    const { data: unlinked, error } = await supabase
      .from('shopify_products')
      .select('*')
      .is('linked_inventory_id', null);

    if (error) {
      result.errors.push(`Failed to fetch unlinked products: ${error.message}`);
      return result;
    }

    if (!unlinked || unlinked.length === 0) {
      return result;
    }

    for (const product of unlinked) {
      try {
        const matches = await findMatches(product as ShopifyProduct, 1);
        
        if (matches.length > 0 && matches[0].confidence >= 95) {
          const linkResult = await linkProduct(product.id, matches[0].inventoryItem.id);
          
          if (linkResult.success) {
            result.matched++;
          } else {
            result.errors.push(`Failed to link ${product.title}: ${linkResult.error}`);
          }
        } else {
          result.skipped++;
        }
      } catch (productError) {
        result.errors.push(
          `Error processing ${product.title}: ${productError instanceof Error ? productError.message : 'Unknown error'}`
        );
      }
    }
  } catch (error) {
    result.errors.push(`Auto-match failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}
