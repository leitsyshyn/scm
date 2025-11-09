import { Effect } from "effect";
import { SqlClient } from "@effect/sql";

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`SET search_path = scm, public, pg_catalog;

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION scm.immutable_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT unaccent('unaccent'::regdictionary, $1) $$;

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(sku,''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(name,''))), 'B')
  ) STORED;

ALTER TABLE product_category
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(code,''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(name,''))), 'B')
  ) STORED;

ALTER TABLE customer
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(name,''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(tax_id,''))), 'D')
  ) STORED;

ALTER TABLE supplier
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(name,''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(tax_id,''))), 'D')
  ) STORED;

ALTER TABLE warehouse
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(code,''))), 'A') ||
    setweight(to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(name,''))), 'B')
  ) STORED;

ALTER TABLE lot
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('pg_catalog.simple', scm.immutable_unaccent(coalesce(lot_code,'')))
  ) STORED;

ALTER TABLE address
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('pg_catalog.simple',
      scm.immutable_unaccent(
        coalesce(line1,'')||' '||coalesce(line2,'')||' '||
        coalesce(city,'')||' '||coalesce(region,'')||' '||
        coalesce(postal_code,'')||' '||coalesce(country_code,'')
      )
    )
  ) STORED;

ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_user__email_ci ON app_user (lower(email));
CREATE INDEX IF NOT EXISTS ix_app_user__username_trgm ON app_user USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_app_user__full_name_trgm ON app_user USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_address__postal_code ON address (postal_code);
CREATE INDEX IF NOT EXISTS ix_address__city_trgm ON address USING GIN (city gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_address__region_trgm ON address USING GIN (region gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ix_uom_conv__to_from ON uom_conversion (to_uom_id, from_uom_id);

CREATE INDEX IF NOT EXISTS ix_prod_cat__parent_id ON product_category (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prod_cat__code_active ON product_category (code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_prod_cat__name_trgm_active ON product_category USING GIN (name gin_trgm_ops) WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_product__sku_active ON product (sku) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_product__category_active ON product (category_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_product__metadata_gin ON product USING GIN (metadata);
CREATE INDEX IF NOT EXISTS ix_product__name_trgm_active ON product USING GIN (name gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_product__tsv ON product USING GIN (search_tsv) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_supplier__name_trgm_active ON supplier USING GIN (name gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_supplier__address_active ON supplier (address_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_supplier__tsv ON supplier USING GIN (search_tsv) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer__name_trgm_active ON customer USING GIN (name gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_customer__address_active ON customer (address_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_customer__tsv ON customer USING GIN (search_tsv) WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse__code_active ON warehouse (code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_warehouse__name_trgm_active ON warehouse USING GIN (name gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_warehouse__address ON warehouse (address_id);
CREATE INDEX IF NOT EXISTS ix_warehouse__tsv ON warehouse USING GIN (search_tsv) WHERE is_deleted = false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_bin__wh_code_active ON warehouse_bin (warehouse_id, code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_wh_bin__warehouse ON warehouse_bin (warehouse_id);

CREATE INDEX IF NOT EXISTS ix_carrier__name_trgm ON carrier USING GIN (name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lot__product_code_active ON lot (product_id, lot_code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lot__product_active ON lot (product_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lot__expiry_active ON lot (expiry_date) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lot__status_active ON lot (status_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lot__code_trgm_active ON lot USING GIN (lot_code gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_lot__tsv ON lot USING GIN (search_tsv) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_inventory__wh_prod_active ON inventory (warehouse_id, product_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_inventory__wh_prod_lot_active ON inventory (warehouse_id, product_id, lot_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_inventory__bin_active ON inventory (warehouse_id, bin_id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_po__supplier_date_active ON purchase_order (supplier_id, order_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_po__status_active ON purchase_order (status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pol__po ON purchase_order_line (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_pol__product ON purchase_order_line (product_id);

CREATE INDEX IF NOT EXISTS ix_receipt__po_active ON receipt (purchase_order_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_receipt__wh_date_active ON receipt (warehouse_id, received_at DESC) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_receipt_line__receipt ON receipt_line (receipt_id);
CREATE INDEX IF NOT EXISTS ix_receipt_line__po_line ON receipt_line (po_line_id);
CREATE INDEX IF NOT EXISTS ix_receipt_line__product ON receipt_line (product_id);

CREATE INDEX IF NOT EXISTS ix_so__customer_date_active ON sales_order (customer_id, order_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_so__status_active ON sales_order (status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_sol__so ON sales_order_line (sales_order_id);
CREATE INDEX IF NOT EXISTS ix_sol__product ON sales_order_line (product_id);

CREATE INDEX IF NOT EXISTS ix_shipment__so_active ON shipment (sales_order_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_shipment__wh_date_active ON shipment (warehouse_id, ship_date DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_shipment__tracking_active ON shipment (tracking_no) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_shipment_item__shipment ON shipment_item (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_item__product_lot ON shipment_item (product_id, lot_id);

CREATE INDEX IF NOT EXISTS ix_package__so_active ON package (sales_order_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_package__shipment_active ON package (shipment_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_package__warehouse_active ON package (warehouse_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_package__package_no_active ON package (package_no) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_package__dims_gin ON package USING GIN (dims);

CREATE INDEX IF NOT EXISTS ix_package_item__package ON package_item (package_id);
CREATE INDEX IF NOT EXISTS ix_package_item__product_lot ON package_item (product_id, lot_id);

CREATE INDEX IF NOT EXISTS ix_transfer_order__from_to_active ON transfer_order (from_warehouse_id, to_warehouse_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_transfer_order__status_date_active ON transfer_order (status, requested_at DESC) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_transfer_order_line__to ON transfer_order_line (transfer_order_id);
CREATE INDEX IF NOT EXISTS ix_transfer_order_line__product ON transfer_order_line (product_id);

CREATE INDEX IF NOT EXISTS ix_reservation__so_line ON reservation (so_line_id);
CREATE INDEX IF NOT EXISTS ix_reservation__wh_prod_status_active ON reservation (warehouse_id, product_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_picklist__wh_status_active ON picklist (warehouse_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_pick_item__picklist ON pick_item (picklist_id);
CREATE INDEX IF NOT EXISTS ix_pick_item__reservation ON pick_item (reservation_id);
CREATE INDEX IF NOT EXISTS ix_pick_item__bin_prod_active ON pick_item (bin_id, product_id) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_return__cust_status_active ON customer_return (customer_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_customer_return_line__parent ON customer_return_line (customer_return_id);
CREATE INDEX IF NOT EXISTS ix_customer_return_line__prod_lot ON customer_return_line (product_id, lot_id);
CREATE INDEX IF NOT EXISTS ix_customer_return_line__shipment_item ON customer_return_line (shipment_item_id);

CREATE INDEX IF NOT EXISTS ix_supplier_return__supp_status_active ON supplier_return (supplier_id, status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS ix_supplier_return_line__parent ON supplier_return_line (supplier_return_id);
CREATE INDEX IF NOT EXISTS ix_supplier_return_line__prod_lot ON supplier_return_line (product_id, lot_id);
CREATE INDEX IF NOT EXISTS ix_supplier_return_line__receipt_line ON supplier_return_line (receipt_line_id);

CREATE INDEX IF NOT EXISTS ix_bom__parent_eff_active ON bom (parent_product_id, effective_from DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS ix_bom_item__bom ON bom_item (bom_id);
CREATE INDEX IF NOT EXISTS ix_bom_item__component ON bom_item (component_product_id);

CREATE INDEX IF NOT EXISTS ix_inventory_tx__ts_brin ON inventory_tx USING BRIN (ts);
CREATE INDEX IF NOT EXISTS ix_inventory_tx__wh_prod_ts ON inventory_tx (warehouse_id, product_id, ts DESC);`);