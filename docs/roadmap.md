# CHT Operating System - Master Roadmap

## 🎯 Primary Mission
To build the "CHT Command Centre": a centralized intelligence layer that automates product intake, marketing, and cross-platform synchronization (Shopify, HubSpot, Notion, Klaviyo).

## 🛠️ Development Philosophy
1. **Phase-Gating:** Strictly focus development on the "ACTIVE" phase. Future phases are for architectural context only to prevent technical debt.
2. **Unified Architecture:** Reuse shared infrastructure (API services, UI components) for both "New" and "Pre-Owned" workflows.
3. **Data Integrity:** All records must use UUIDs. Shopify remains the primary inventory source; HubSpot remains the primary CRM source.
4. **Localization:** All scrapers and currency logic must prioritize Australian (.com.au) sources and AUD.

---

## 🚀 Phase 1: Unified Product Lister (ACTIVE)
**Goal:** Create a single entry point for all CHT inventory, bifurcating into two distinct logic paths.

### 1.1 Dual-Path Intake Flow
The UI must prompt for the "Listing Type" immediately:
- **Path A: New Retail** - Standard listing logic (Referencing existing `@ProductLister` code).
    - Focus on manufacturer specs and MSRP.
- **Path B: Pre-Owned / Ex-Demo**
    - **Intake:** Mobile camera access for product/serial photo.
    - **AI Vision:** Extract Brand, Model, and Serial Number.
    - **Serial Number Logic:** **NOT REQUIRED.** Capture is strongly encouraged, but the user must be able to "Skip" or "Not Found".
    - **Scraper:** Search AU retailers for current/historical RRP.
    - **Pricing:** Default 30% off RRP with manual override.

### 1.2 Shared Middleware Sync (The "Pipes")
When "Publish" is clicked, trigger a unified sync service:
- **Shopify:** - Create/Update product.
    - **Condition Tagging:** If Pre-Owned, apply tags `pre-owned` and `trade-in`.
- **HubSpot (Middleware Logic):** - Create/Update a 'Deal' in the 'Inventory Intake' stage.
    - Map Serial Number and Condition Report to Deal properties.
- **Notion:** - Log entry in the 'Global Inventory' database for internal tracking.

---

## 🔮 Future Phases (FOR REFERENCE ONLY)

### Phase 2: CRM Automation & Bidirectional Sync
- Implement Webhooks: When a product sells in Shopify, mark the HubSpot Deal as 'Closed Won'.
- Automated customer matching in HubSpot based on trade-in intake.

### Phase 3: Klaviyo Marketing Engine
- **Tool:** Email Generator.
- **Logic:** Pull inventory data (New or Trade-in) directly from the Phase 1 cache into AI-generated email templates based on historical CHT styles.

### Phase 4: Business KOI Dashboard
- **Goal:** Real-time business health visibility.
- **Data:** Pull sales (Shopify), expenses (Xero), and marketing ROI (Klaviyo) into one view.

### Phase 5: Advanced Specialty Tools
- **Manhattan Chair Configurator:** 3D visualization and Shopify quote generation.
- **Dirac Optimiser:** Strategy guide and house-curve management for customers.

---

## 💾 Database Schema Reference (Phase 1)
- **Table:** `inventory_items`
    - `id`: uuid (PK)
    - `listing_type`: enum ('new', 'trade_in', 'ex_demo')
    - `brand`, `model`: string
    - `serial_number`: string (nullable)
    - `rrp_aud`: decimal
    - `sale_price`: decimal
    - `condition_report`: text
    - `image_urls`: text[]
    - `hubspot_deal_id`: string (nullable)