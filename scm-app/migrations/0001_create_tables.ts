import { Effect } from "effect";
import { SqlClient } from "@effect/sql";

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`
CREATE SCHEMA IF NOT EXISTS scm;
SET search_path = scm, public, information_schema, pg_catalog;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE scm.po_status AS ENUM ('DRAFT','APPROVED','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.so_status AS ENUM ('DRAFT','APPROVED','PART_SHIPPED','SHIPPED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.transfer_status AS ENUM ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.reservation_status AS ENUM ('OPEN','PICKED','RELEASED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.picklist_status AS ENUM ('OPEN','IN_PROGRESS','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.pick_item_status AS ENUM ('OPEN','PICKED','SHORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.package_status AS ENUM ('OPEN','SEALED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.inventory_reason AS ENUM (
    'RECEIVE',
    'ISSUE_PICK',
    'TRANSFER_OUT',
    'TRANSFER_IN',
    'ADJUST_POS',
    'ADJUST_NEG',
    'RETURN_FROM_CUST',
    'RETURN_TO_SUPP'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.rma_status AS ENUM ('DRAFT','RECEIVED','DISPOSITIONED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scm.rtv_status AS ENUM ('DRAFT','SHIPPED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create tables
CREATE TABLE IF NOT EXISTS scm.app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar NOT NULL UNIQUE,
  full_name varchar,
  email varchar NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS scm.address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line1 varchar,
  line2 varchar,
  city varchar,
  region varchar,
  country_code char(2),
  postal_code varchar
);

CREATE TABLE IF NOT EXISTS scm.unit_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS scm.uom_conversion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  to_uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  factor numeric(18,6) NOT NULL,
  CONSTRAINT uom_conversion_from_to_key UNIQUE (from_uom_id, to_uom_id)
);

CREATE TABLE IF NOT EXISTS scm.product_category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  code varchar NOT NULL,
  parent_id uuid REFERENCES scm.product_category(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.inventory_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS scm.supplier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  tax_id varchar,
  address_id uuid REFERENCES scm.address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  tax_id varchar,
  address_id uuid REFERENCES scm.address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.warehouse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL,
  name varchar NOT NULL,
  address_id uuid REFERENCES scm.address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.warehouse_bin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  code varchar NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar NOT NULL,
  name varchar NOT NULL,
  category_id uuid REFERENCES scm.product_category(id),
  base_uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  metadata jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_code varchar NOT NULL,
  expiry_date date,
  status_id uuid REFERENCES scm.inventory_status(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  bin_id uuid REFERENCES scm.warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty_on_hand numeric(18,3) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id),
  bin_id_norm uuid GENERATED ALWAYS AS (COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  lot_id_norm uuid GENERATED ALWAYS AS (COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  CONSTRAINT inventory_bucket_key UNIQUE (warehouse_id, bin_id_norm, product_id, lot_id_norm)
);

CREATE TABLE IF NOT EXISTS scm.purchase_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  supplier_id uuid NOT NULL REFERENCES scm.supplier(id),
  status scm.po_status NOT NULL DEFAULT 'DRAFT',
  order_date date NOT NULL,
  expected_date date,
  currency char(3),
  total_amount numeric(18,2),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.purchase_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES scm.purchase_order(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  qty_ordered numeric(18,3) NOT NULL,
  price_per_uom numeric(18,4) NOT NULL,
  qty_received numeric(18,3) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id),
  CONSTRAINT purchase_order_line_po_line_no_key UNIQUE (purchase_order_id, line_no),
  CONSTRAINT purchase_order_line_qty_received_check CHECK (qty_received <= qty_ordered)
);

CREATE TABLE IF NOT EXISTS scm.receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE,
  purchase_order_id uuid NOT NULL REFERENCES scm.purchase_order(id),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.receipt_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES scm.receipt(id) ON DELETE CASCADE,
  po_line_id uuid NOT NULL REFERENCES scm.purchase_order_line(id),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  qty_received numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.sales_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number text UNIQUE,
  customer_id uuid NOT NULL REFERENCES scm.customer(id),
  status scm.so_status NOT NULL DEFAULT 'DRAFT',
  order_date date NOT NULL,
  due_date date,
  currency char(3),
  total_amount numeric(18,2),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.sales_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES scm.sales_order(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  uom_id uuid NOT NULL REFERENCES scm.unit_of_measure(id),
  qty_ordered numeric(18,3) NOT NULL,
  price_per_uom numeric(18,4) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id),
  CONSTRAINT sales_order_line_so_line_no_key UNIQUE (sales_order_id, line_no)
);

CREATE TABLE IF NOT EXISTS scm.carrier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  scac varchar
);

CREATE TABLE IF NOT EXISTS scm.shipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES scm.sales_order(id),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  carrier_id uuid REFERENCES scm.carrier(id),
  tracking_no varchar,
  ship_date date,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.shipment_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES scm.shipment(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty_shipped numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.transfer_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text UNIQUE,
  from_warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  to_warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  status scm.transfer_status NOT NULL DEFAULT 'DRAFT',
  requested_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.transfer_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_order_id uuid NOT NULL REFERENCES scm.transfer_order(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  uom_id uuid REFERENCES scm.unit_of_measure(id),
  qty numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_line_id uuid NOT NULL REFERENCES scm.sales_order_line(id),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  bin_id uuid REFERENCES scm.warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty_reserved numeric(18,3) NOT NULL,
  qty_picked numeric(18,3) NOT NULL DEFAULT 0,
  status scm.reservation_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id),
  bin_id_norm uuid GENERATED ALWAYS AS (COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  lot_id_norm uuid GENERATED ALWAYS AS (COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  CONSTRAINT reservation_bucket_key UNIQUE (so_line_id, warehouse_id, bin_id_norm, product_id, lot_id_norm),
  CONSTRAINT reservation_qty_bounds CHECK (qty_picked <= qty_reserved)
);

CREATE TABLE IF NOT EXISTS scm.picklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  status scm.picklist_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.pick_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picklist_id uuid NOT NULL REFERENCES scm.picklist(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES scm.reservation(id),
  bin_id uuid REFERENCES scm.warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty_to_pick numeric(18,3) NOT NULL,
  qty_picked numeric(18,3) NOT NULL DEFAULT 0,
  status scm.pick_item_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id),
  CONSTRAINT pick_item_qty_bounds CHECK (qty_picked <= qty_to_pick)
);

CREATE TABLE IF NOT EXISTS scm.package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES scm.sales_order(id),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  shipment_id uuid REFERENCES scm.shipment(id),
  package_no text,
  status scm.package_status NOT NULL DEFAULT 'OPEN',
  weight_kg numeric(10,3),
  dims jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.package_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES scm.package(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.inventory_tx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  warehouse_id uuid NOT NULL REFERENCES scm.warehouse(id),
  bin_id uuid REFERENCES scm.warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty_delta numeric(18,3) NOT NULL,
  reason scm.inventory_reason NOT NULL,
  ref_type text,
  ref_id uuid,
  move_key text UNIQUE,
  created_by uuid REFERENCES scm.app_user(id),
  CHECK (qty_delta <> 0)
);

CREATE TABLE IF NOT EXISTS scm.customer_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES scm.customer(id),
  sales_order_id uuid REFERENCES scm.sales_order(id),
  status scm.rma_status NOT NULL DEFAULT 'DRAFT',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.customer_return_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_return_id uuid NOT NULL REFERENCES scm.customer_return(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty numeric(18,3) NOT NULL,
  shipment_item_id uuid REFERENCES scm.shipment_item(id),
  disposition_status_id uuid REFERENCES scm.inventory_status(id)
);

CREATE TABLE IF NOT EXISTS scm.supplier_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES scm.supplier(id),
  purchase_order_id uuid REFERENCES scm.purchase_order(id),
  status scm.rtv_status NOT NULL DEFAULT 'DRAFT',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.supplier_return_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id uuid NOT NULL REFERENCES scm.supplier_return(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES scm.product(id),
  lot_id uuid REFERENCES scm.lot(id),
  qty numeric(18,3) NOT NULL,
  receipt_line_id uuid REFERENCES scm.receipt_line(id)
);

CREATE TABLE IF NOT EXISTS scm.bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id uuid NOT NULL REFERENCES scm.product(id),
  revision text,
  effective_from date,
  effective_to date,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES scm.app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES scm.app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES scm.app_user(id)
);

CREATE TABLE IF NOT EXISTS scm.bom_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid NOT NULL REFERENCES scm.bom(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES scm.product(id),
  qty_per numeric(18,6) NOT NULL,
  sequence int
);

INSERT INTO scm.inventory_status(code)
VALUES ('AVAILABLE'),('HOLD'),('DAMAGED'),('EXPIRED')
ON CONFLICT (code) DO NOTHING;`);
