-- ============================================
-- Harden RLS for Shopify import tables
-- Replaces permissive policies with authenticated-only policies
-- ============================================

ALTER TABLE shopify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON shopify_products;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON shopify_product_snapshots;

DROP POLICY IF EXISTS "shopify_products_select_authenticated" ON shopify_products;
DROP POLICY IF EXISTS "shopify_products_insert_authenticated" ON shopify_products;
DROP POLICY IF EXISTS "shopify_products_update_authenticated" ON shopify_products;
DROP POLICY IF EXISTS "shopify_products_delete_authenticated" ON shopify_products;

DROP POLICY IF EXISTS "shopify_product_snapshots_select_authenticated" ON shopify_product_snapshots;
DROP POLICY IF EXISTS "shopify_product_snapshots_insert_authenticated" ON shopify_product_snapshots;
DROP POLICY IF EXISTS "shopify_product_snapshots_update_authenticated" ON shopify_product_snapshots;
DROP POLICY IF EXISTS "shopify_product_snapshots_delete_authenticated" ON shopify_product_snapshots;

CREATE POLICY "shopify_products_select_authenticated"
  ON shopify_products
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "shopify_products_insert_authenticated"
  ON shopify_products
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shopify_products_update_authenticated"
  ON shopify_products
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shopify_products_delete_authenticated"
  ON shopify_products
  FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "shopify_product_snapshots_select_authenticated"
  ON shopify_product_snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "shopify_product_snapshots_insert_authenticated"
  ON shopify_product_snapshots
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shopify_product_snapshots_update_authenticated"
  ON shopify_product_snapshots
  FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "shopify_product_snapshots_delete_authenticated"
  ON shopify_product_snapshots
  FOR DELETE
  USING (auth.role() = 'authenticated');
