# Phase 3 Features - Detailed Implementation Plan

Detailed planning for the remaining 4 features from Phase 2 optimisations.

---

## #27. Item Comparison View

### Overview
Allow users to select multiple inventory items and compare them side-by-side in a modal/page. Useful for pricing decisions, identifying similar products, and spec comparison.

### User Stories
- As a user, I want to select multiple items from the inventory list
- As a user, I want to see selected items side-by-side with key metrics
- As a user, I want to quickly compare prices, margins, and specifications
- As a user, I want to identify pricing opportunities across similar products

### Technical Implementation

#### 1. Selection State Management
**File:** `src/lib/store/app-store.ts`
```typescript
// Add to existing store
comparisonItems: string[];  // Array of item IDs
addToComparison: (id: string) => void;
removeFromComparison: (id: string) => void;
clearComparison: () => void;
```

#### 2. Comparison Modal Component
**File:** `src/components/inventory/ComparisonModal.tsx`

**Structure:**
- Fixed header with "Compare X Items" title
- Horizontal scrollable grid with sticky first column (field labels)
- Columns for each selected item
- Key comparison rows:
  - Product image thumbnail
  - Brand / Model
  - SKU
  - Listing type
  - Condition grade
  - Cost price
  - RRP
  - Sale price
  - Margin %
  - Discount %
  - Sync status
  - Created date

#### 3. Selection UI in Inventory List
**File:** `src/app/(dashboard)/inventory/page.tsx`

**Changes:**
- Add checkbox column to inventory table
- Add "Compare (X)" button in header when items selected
- Visual indicator for selected items
- Limit selection to max 5 items for usability

#### 4. Comparison Actions
- "Apply same price" to update multiple items
- "Export comparison" to CSV
- Clear selection button

### UI/UX Design
```
┌─────────────────────────────────────────────────────────────┐
│  Compare 3 Items                                    [Close] │
├─────────────────────────────────────────────────────────────┤
│              │ Item 1        │ Item 2        │ Item 3       │
├──────────────┼───────────────┼───────────────┼──────────────┤
│ Image        │ [thumbnail]   │ [thumbnail]   │ [thumbnail]  │
│ Brand        │ Marantz       │ Marantz       │ Denon        │
│ Model        │ AV30          │ SR8015        │ AVR-X6700H   │
│ Cost         │ $3,500        │ $2,800        │ $2,200       │
│ RRP          │ $5,999        │ $4,999        │ $3,999       │
│ Sale Price   │ $4,999 ✓      │ $4,299        │ $3,499       │
│ Margin       │ 30.0%         │ 34.9%         │ 37.1% ★      │
│ Status       │ Synced        │ Pending       │ Error        │
├──────────────┴───────────────┴───────────────┴──────────────┤
│ [Export Comparison]                    [Clear Selection]    │
└─────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify
1. `src/components/inventory/ComparisonModal.tsx` - New
2. `src/components/inventory/index.ts` - Update exports
3. `src/lib/store/app-store.ts` - Add comparison state
4. `src/app/(dashboard)/inventory/page.tsx` - Add selection UI

### Estimated Complexity: Medium
- Selection state: Simple
- Modal component: Medium
- UI integration: Simple

---

## #28. Dashboard Analytics Charts

### Overview
Add visual charts to the dashboard showing inventory trends, sync status breakdown, and financial metrics over time.

### User Stories
- As a user, I want to see inventory distribution by listing type
- As a user, I want to track sync success/failure rates
- As a user, I want to visualize inventory value over time
- As a user, I want to see average margins and pricing trends

### Technical Implementation

#### 1. Install Chart Library
```bash
npm install recharts
```
Recharts chosen over Chart.js for better React integration and TypeScript support.

#### 2. Analytics API Endpoint
**File:** `src/app/api/analytics/route.ts`

**Response structure:**
```typescript
interface AnalyticsData {
  summary: {
    totalItems: number;
    totalValue: number;
    averageMargin: number;
    pendingSyncs: number;
  };
  byListingType: {
    type: string;
    count: number;
    value: number;
  }[];
  bySyncStatus: {
    status: string;
    count: number;
  }[];
  byCondition: {
    grade: string;
    count: number;
  }[];
  timeline: {
    date: string;
    itemsAdded: number;
    itemsSynced: number;
    totalValue: number;
  }[];
}
```

#### 3. Chart Components
**Directory:** `src/components/analytics/`

**Files:**
- `InventoryPieChart.tsx` - Distribution by type
- `SyncStatusChart.tsx` - Sync status breakdown
- `TimelineChart.tsx` - Items over time
- `MarginHistogram.tsx` - Margin distribution
- `AnalyticsDashboard.tsx` - Container component

#### 4. Dashboard Integration
**File:** `src/app/(dashboard)/page.tsx`

Add new "Analytics" section below existing stats cards with:
- Row 1: Inventory by Type (pie), Sync Status (donut)
- Row 2: Timeline chart (area chart, full width)
- Row 3: Margin distribution (bar chart)

### Chart Specifications

#### Inventory by Listing Type (Pie Chart)
```
Data: { name: "New", value: 45 }, { name: "Trade-In", value: 28 }, { name: "Ex-Demo", value: 12 }
Colors: Emerald (new), Blue (trade-in), Purple (ex-demo)
```

#### Sync Status (Donut Chart)
```
Data: { name: "Synced", value: 65 }, { name: "Pending", value: 15 }, { name: "Error", value: 5 }
Colors: Green (synced), Amber (pending), Red (error)
```

#### Timeline (Area Chart)
```
X-axis: Last 30 days
Y-axis: Item count / Value
Lines: Items added, Items synced
```

### Files to Create/Modify
1. `src/app/api/analytics/route.ts` - New
2. `src/components/analytics/` - New directory
3. `src/app/(dashboard)/page.tsx` - Integrate charts
4. `package.json` - Add recharts dependency

### Estimated Complexity: Medium-High
- API endpoint: Medium
- Chart components: Medium (5 components)
- Integration: Simple
- Responsive design: Medium

---

## #29. Saved Filters/Views

### Overview
Allow users to save common filter combinations as named presets for quick access. Store in localStorage with optional sync to database for persistence across devices.

### User Stories
- As a user, I want to save my current filter as a preset
- As a user, I want to quickly switch between saved views
- As a user, I want to name and organize my filter presets
- As a user, I want default system presets (e.g., "Pending Sync")

### Technical Implementation

#### 1. Filter Preset Type
**File:** `src/types/filters.ts`
```typescript
interface FilterPreset {
  id: string;
  name: string;
  icon?: string;
  filters: {
    listing_type?: ListingType | 'all';
    sync_status?: SyncStatus | 'all';
    condition_grade?: ConditionGrade;
    listing_status?: ListingStatus;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  isSystem?: boolean;  // Built-in presets
  createdAt: string;
}
```

#### 2. Default System Presets
```typescript
const SYSTEM_PRESETS: FilterPreset[] = [
  { id: 'pending-sync', name: 'Pending Sync', filters: { sync_status: 'pending' }, isSystem: true },
  { id: 'sync-errors', name: 'Sync Errors', filters: { sync_status: 'error' }, isSystem: true },
  { id: 'trade-ins', name: 'Trade-Ins', filters: { listing_type: 'trade_in' }, isSystem: true },
  { id: 'ex-demo', name: 'Ex-Demo Units', filters: { listing_type: 'ex_demo' }, isSystem: true },
  { id: 'on-demo', name: 'On Demo', filters: { listing_status: 'on_demo' }, isSystem: true },
  { id: 'high-value', name: 'High Value (>$2k)', filters: { minPrice: 2000 }, isSystem: true },
];
```

#### 3. Storage Layer
**File:** `src/lib/filters/presets.ts`
```typescript
// LocalStorage operations
function getPresets(): FilterPreset[]
function savePreset(preset: Omit<FilterPreset, 'id' | 'createdAt'>): FilterPreset
function deletePreset(id: string): void
function updatePreset(id: string, updates: Partial<FilterPreset>): void
```

#### 4. UI Components

**SaveFilterDialog.tsx**
- Input for preset name
- Optional icon picker
- Preview of current filters being saved
- Save/Cancel buttons

**FilterPresetsDropdown.tsx**
- Dropdown showing all presets (system + custom)
- Click to apply preset
- Edit/Delete buttons for custom presets
- "Save Current Filters" button

### UI/UX Design
```
┌──────────────────────────────────────────────────────────┐
│ Inventory                               [Saved Views ▼]  │
├──────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐  │
│ │ System Views                                        │  │
│ │   🕐 Pending Sync (12)                              │  │
│ │   ❌ Sync Errors (3)                                │  │
│ │   🔄 Trade-Ins                                      │  │
│ │   📦 Ex-Demo Units                                  │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ My Views                                            │  │
│ │   💰 High Margin Items          [Edit] [Delete]    │  │
│ │   📅 This Week's Listings       [Edit] [Delete]    │  │
│ ├─────────────────────────────────────────────────────┤  │
│ │ ➕ Save Current Filters...                          │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Files to Create/Modify
1. `src/types/filters.ts` - New
2. `src/lib/filters/presets.ts` - New
3. `src/components/inventory/FilterPresetsDropdown.tsx` - New
4. `src/components/inventory/SaveFilterDialog.tsx` - New
5. `src/app/(dashboard)/inventory/page.tsx` - Integrate

### Estimated Complexity: Medium
- Type definitions: Simple
- Storage layer: Simple
- UI components: Medium
- Integration: Simple

---

## #30. Print Labels Feature

### Overview
Generate printable label sheets for inventory items with QR codes linking to item details, price tags, and barcode support.

### User Stories
- As a user, I want to print price tags for display items
- As a user, I want QR codes that link to product details
- As a user, I want to print labels in standard label sheet formats
- As a user, I want to customize what information appears on labels

### Technical Implementation

#### 1. Install Dependencies
```bash
npm install qrcode react-to-print
```

#### 2. Label Templates
**File:** `src/lib/labels/templates.ts`

**Template Types:**
```typescript
interface LabelTemplate {
  id: string;
  name: string;
  description: string;
  pageSize: 'A4' | 'Letter';
  labelsPerSheet: number;
  labelWidth: number;  // mm
  labelHeight: number; // mm
  columns: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gapX: number;
  gapY: number;
}

// Pre-defined templates
const LABEL_TEMPLATES = {
  avery5160: { ... },  // 30 labels/sheet (2.625" x 1")
  avery5163: { ... },  // 10 labels/sheet (4" x 2")
  dymo30252: { ... },  // Single label roll
  priceTag: { ... },   // Custom price tag format
};
```

#### 3. Label Content Configuration
```typescript
interface LabelContent {
  showBrand: boolean;
  showModel: boolean;
  showSku: boolean;
  showPrice: boolean;
  showRrp: boolean;
  showDiscount: boolean;
  showQrCode: boolean;
  showBarcode: boolean;
  qrCodeUrl: 'admin' | 'shopify' | 'custom';
  customText?: string;
}
```

#### 4. Components

**LabelPreview.tsx**
- Shows single label with configured content
- QR code generation using `qrcode` library
- Barcode generation (optional - Code 128)

**LabelSheet.tsx**
- Grid layout matching selected template
- Multiple labels per page
- Print-optimized CSS

**PrintLabelsDialog.tsx**
- Template selection dropdown
- Content configuration checkboxes
- Item selection (single or multiple)
- Preview pane
- Print button using `react-to-print`

#### 5. Print Styles
**File:** `src/app/globals.css`
```css
@media print {
  .label-sheet {
    /* Print-specific styles */
    margin: 0;
    padding: 0;
  }
  .no-print {
    display: none !important;
  }
}
```

### Label Design
```
┌────────────────────────────────────┐
│  [QR]   MARANTZ AV30               │
│  [QR]   SKU: MAR-AV30-BLK          │
│  [QR]                              │
│         ━━━━━━━━━━━━━━━━━          │
│         RRP: $5,999   -17%         │
│         ══════════════════         │
│              $4,999                │
└────────────────────────────────────┘
```

### Files to Create/Modify
1. `src/lib/labels/templates.ts` - New
2. `src/components/labels/LabelPreview.tsx` - New
3. `src/components/labels/LabelSheet.tsx` - New
4. `src/components/labels/PrintLabelsDialog.tsx` - New
5. `src/app/(dashboard)/inventory/[id]/page.tsx` - Add print button
6. `src/app/globals.css` - Print styles
7. `package.json` - Add dependencies

### Estimated Complexity: Medium-High
- Template system: Medium
- QR code generation: Simple (library)
- Print CSS: Medium (tricky)
- UI integration: Simple

---

## Implementation Priority

Based on user value and complexity:

| Feature | User Value | Complexity | Priority |
|---------|-----------|------------|----------|
| #29 Saved Filters | High | Medium | 1 |
| #27 Item Comparison | High | Medium | 2 |
| #28 Analytics Charts | Medium | Medium-High | 3 |
| #30 Print Labels | Medium | Medium-High | 4 |

### Recommended Order
1. **Saved Filters** - Low complexity, high daily use value
2. **Item Comparison** - Useful for pricing decisions
3. **Analytics Charts** - Nice-to-have visibility
4. **Print Labels** - Specialized use case

---

## Dependencies Summary

```bash
# New packages needed
npm install recharts qrcode react-to-print @types/qrcode
```

## Estimated Total Effort
- Feature #27: ~3-4 hours
- Feature #28: ~4-5 hours
- Feature #29: ~2-3 hours
- Feature #30: ~4-5 hours
- **Total: ~13-17 hours**
