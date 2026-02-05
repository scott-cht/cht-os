/**
 * Environment Variable Validation
 * 
 * Validates required environment variables at startup.
 * Call validateEnv() in instrumentation.ts or layout.tsx.
 */

interface EnvConfig {
  name: string;
  required: boolean;
  description: string;
}

// Required environment variables
const requiredEnvVars: EnvConfig[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key for client-side operations',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key for server-side operations',
  },
];

// Optional but recommended environment variables
const optionalEnvVars: EnvConfig[] = [
  {
    name: 'ANTHROPIC_API_KEY',
    required: false,
    description: 'Anthropic API key for AI content generation',
  },
  {
    name: 'SERPAPI_API_KEY',
    required: false,
    description: 'SerpAPI key for search functionality',
  },
  {
    name: 'SHOPIFY_STORE_DOMAIN',
    required: false,
    description: 'Shopify store domain (e.g., store.myshopify.com)',
  },
  {
    name: 'SHOPIFY_API_KEY',
    required: false,
    description: 'Shopify API key for OAuth',
  },
  {
    name: 'SHOPIFY_API_SECRET',
    required: false,
    description: 'Shopify API secret for OAuth',
  },
  {
    name: 'HUBSPOT_ACCESS_TOKEN',
    required: false,
    description: 'HubSpot access token for deal creation',
  },
  {
    name: 'NOTION_API_KEY',
    required: false,
    description: 'Notion API key for inventory logging',
  },
  {
    name: 'NOTION_DATABASE_ID',
    required: false,
    description: 'Notion database ID for inventory',
  },
  {
    name: 'INTERNAL_API_KEY',
    required: false,
    description: 'API key for internal authentication',
  },
  {
    name: 'PROXY_URL',
    required: false,
    description: 'Proxy server URL for Australian scraping',
  },
];

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required environment variables
 */
export function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required variables
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      missing.push(`${envVar.name} - ${envVar.description}`);
    }
  }
  
  // Check optional but recommended variables
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      warnings.push(`${envVar.name} not set - ${envVar.description}`);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Validate and throw if required variables missing
 */
export function validateEnvOrThrow(): void {
  const result = validateEnv();
  
  if (!result.valid) {
    console.error('\n❌ Missing required environment variables:');
    result.missing.forEach(m => console.error(`   - ${m}`));
    console.error('\nPlease add these to your .env.local file.\n');
    
    throw new Error(
      `Missing required environment variables: ${result.missing.map(m => m.split(' - ')[0]).join(', ')}`
    );
  }
  
  // Log warnings for optional variables
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Optional environment variables not set:');
    result.warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn('');
  }
}

/**
 * Get environment variable with default
 */
export function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

/**
 * Get required environment variable (throws if missing)
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Check if an integration is configured
 */
export function isIntegrationConfigured(integration: 'shopify' | 'hubspot' | 'notion' | 'anthropic' | 'serpapi'): boolean {
  switch (integration) {
    case 'shopify':
      return Boolean(process.env.SHOPIFY_STORE_DOMAIN);
    case 'hubspot':
      return Boolean(process.env.HUBSPOT_ACCESS_TOKEN);
    case 'notion':
      return Boolean(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
    case 'anthropic':
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case 'serpapi':
      return Boolean(process.env.SERPAPI_API_KEY);
    default:
      return false;
  }
}
