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

### Phase 2: Klaviyo Marketing Engine
- **Tool:** Email Generator.
- **Logic:** Pull inventory data (New or Trade-in) directly from the Phase 1 cache into AI-generated email templates based on historical CHT styles.

---

## 🚀 Phase 4: Post-Sales & Service Engine (ACTIVE)
Focus on returns, repairs, and maintaining customer trust after purchase.

**Current implementation scope**
- Full Phase 4.1 + 4.2 in this delivery wave.
- HubSpot sync target is **Tickets** (not Deals).
- AI recommendation logic is included in Phase 4.2.

#### 4.1 RMA & Repair Manager
Replace spreadsheet tracking with an RMA tab that syncs with product and customer data.
- **Intake:** Select the original Shopify order; tool pulls serial number and customer details.
- **Condition Capture:** Reuse Trade-in camera flow to document "arrival condition" of the return.
- **Status Pipeline:** `Received` → `Testing` → `Sent to Manufacturer` → `Repaired/Replaced` → `Back to Customer`.
- **HubSpot Sync:** Automatically update HubSpot **Tickets** so the sales rep sees repair status.

#### 4.2 Service History & Serial Number Registry
Leverage serial numbers already captured for trade-ins to build a **Serial Number Registry** ("Service Passport" for high-end assets).
- **Why:** When a customer later trades back a projector, you have full history: when sold, any RMAs, lamp hours at last check.
- **AI Suggestion:** When a product is scanned for RMA, AI checks history and can flag e.g. *"This unit has been back 3 times for HDMI issues. Suggest replacement over repair."*

---

## 🔮 Future Phases (FOR REFERENCE ONLY)

### Phase 3: CRM Automation & Bidirectional Sync
- Implement Webhooks: When a product sells in Shopify, mark the HubSpot Deal as 'Closed Won'.
- Automated customer matching in HubSpot based on trade-in intake.

### Phase 5: Expert Value-Adds
Technical consulting and system-selling tools that position CHT as experts.

#### 5.1 Dirac Live House Curve Library
- **Feature:** Central repository of custom Dirac house curves (flat, +6dB bass, etc.) with download links for customers.
- **Support Logic:** Customer uploads a measurement screenshot; AI (Vision) analyzes the graph and suggests e.g. *"Your 80Hz dip looks like a phase issue; try moving the sub."*

#### 5.2 Custom Bundle / Quote Builder
Shopify handles single items; complex "System Quotes" (e.g. 7.2.4 Atmos packages) need a dedicated tool.
- **Idea:** Draft a system by pulling products from Shopify and applying a **Package Discount** not visible on the website.
- **Export:** Professional PDF quote with CHT branding and a hidden "Buy Now" link that creates a pre-filled Shopify cart.

#### 5.3 Other Specialty Tools (Future)
- **Manhattan Chair Configurator:** 3D visualization and Shopify quote generation.

### Phase 6: CHT Core — Business Intelligence Dashboard
**Goal:** Real-time business health visibility in one place. (Not "KOI"; branded as **CHT Core**.)

| Dashboard KPI | Why it matters for CHT |
|---------------|------------------------|
| **Trade-in Velocity** | How many days does a used Denon sit on the shelf before it sells? |
| **RMA Rate by Brand** | Which brands cost the most in shipping and support time? |
| **Email to Sale ROI** | Which Klaviyo templates drove the most high-ticket projector sales? |
| **Regional Traffic** | Where in Australia is demand strongest for "Home Cinema Installs"? |

**Data sources:** Sales (Shopify), expenses (Xero), marketing ROI (Klaviyo).

### Phase 7: Advanced Automation (The "Agentic" Phase)
Software that does work *without* you.

#### 7.1 Automated Competitor Price-Match Alerts
- **Logic:** Competitor Monitor detects e.g. a rival has dropped the price of a Sony projector.
- **Action:** Notification: *"Competitor X dropped price to $5,499. Update our Shopify price to match, or send a Klaviyo email highlighting our 5-year warranty?"*

#### 7.2 "Stock Low" Klaviyo Trigger
- **Logic:** When a popular item (e.g. a specific subwoofer) hits "2 left in stock" in Shopify.
- **Action:** AI drafts a "Last Chance" email segment to everyone who viewed that product in the last 30 days but didn’t buy.

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