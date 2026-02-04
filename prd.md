# PRD: Shopify Product Scout & Onboarder (Supabase Edition)

## 1. Project Vision
An internal high-efficiency automation tool for Australian Shopify stores. It transforms a **Brand + Model Number** into a polished **Shopify Draft** by automating discovery, SEO content generation, image optimization, and "Retail Math."

---

## 2. Core Workflow & Phases

### Phase 1: Discovery (Search & Selection)
- **Input:** User enters `Brand` and `Model Number`.
- **Search Logic:** Automates a search using a provider (e.g., SerpApi) with `site:.com.au` filters to ensure Australian pricing and GST visibility.
- **Selection:** UI presents the top 3-5 results; user selects the "Gold Source" URL.

### Phase 2: Extraction (Supabase Edge Logic)
- **Engine:** Playwright (Stealth) running in Supabase Edge Functions to bypass 30s timeouts.
- **Data Priority:** 1. Extract **JSON-LD** (`ld+json`) as the primary Source of Truth for RRP, SKU, and Name.
  2. Fallback to HTML parsing for Technical Specification tables.
- **Persistence:** Save `raw_scraped_json` to Postgres before AI processing for audit/re-mapping.

### Phase 3: AI Copywriting (The Brain)
- **Engine:** LLM (GPT-4o/Claude 3.5) with a Brand Voice persona.
- **SEO Rules:**
  - **Title:** `[Brand] [Model] [Category] - [Key Feature]` (Strictly < 60 characters).
  - **Meta Description:** Strictly 150–155 characters with an actionable CTA.
- **Content Structure:**
  - Unique introductory hook (benefit-driven).
  - 3–5 bullet points highlighting customer value.
  - **Metric Normalization:** All measurements (mm, cm, kg, L) normalized to Australian Metric standards.
- **Compliance:** 100% unique rewrite to avoid SEO duplicate content penalties.

### Phase 4: Retail Math (AU Standards)
- **Pricing Logic:** `Sales Price = round(RRP * (1 - Discount%), 0)`.
- **Constraint:** Sales Price must be a **whole Australian Dollar** (no cents).
- **Safety:** UI Warning if `Sales Price < (Cost Price * 1.2)` (20% margin floor).

### Phase 5: Media & Image Pipeline
- **Processing:** Download -> Convert to **WebP** via `sharp`.
- **SEO Naming:** `brand-model-category-index.webp`.
- **Storage:** Host in **Supabase Storage** bucket `product-images`.
- **Accessibility:** Generate AI-driven, keyword-rich Alt-Text for every image.

### Phase 6: Shopify Push
- **Status:** Always create as `DRAFT`.
- **API:** Shopify GraphQL Admin API.
- **Metadata:** Store the original `source_url` in a hidden Metafield for tracking.

---

## 3. Technical Stack
- **Frontend:** Next.js 15 (App Router).
- **Backend:** Supabase (Auth, DB, Storage, Edge Functions).
- **Realtime:** Supabase Realtime for live status streaming (e.g., "Scraping Harvey Norman...").
- **Image Processing:** `sharp`.

---

## 4. Constraint & Guardrails (The "Must-Haves")
- **AU Residency:** Use AU residential proxies to see correct localized pricing/GST.
- **Manual Override:** All AI-generated fields must be editable in the UI before syncing.
- **No Direct Live:** No "Publish" button; all products land in Shopify as Drafts for final human QC.