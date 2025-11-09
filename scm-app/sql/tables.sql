SET search_path = scm, public, information_schema, pg_catalog;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('DRAFT','APPROVED','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE so_status AS ENUM ('DRAFT','APPROVED','PART_SHIPPED','SHIPPED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transfer_status AS ENUM ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('OPEN','PICKED','RELEASED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE picklist_status AS ENUM ('OPEN','IN_PROGRESS','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE pick_item_status AS ENUM ('OPEN','PICKED','SHORT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE package_status AS ENUM ('OPEN','SEALED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE inventory_reason AS ENUM (
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
  CREATE TYPE rma_status AS ENUM ('DRAFT','RECEIVED','DISPOSITIONED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE rtv_status AS ENUM ('DRAFT','SHIPPED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar NOT NULL UNIQUE,
  full_name varchar,
  email varchar NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);

CREATE TABLE address (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line1 varchar,
  line2 varchar,
  city varchar,
  region varchar,
  country_code char(2),
  postal_code varchar
);

CREATE TABLE unit_of_measure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL UNIQUE,
  name varchar NOT NULL
);

CREATE TABLE uom_conversion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  to_uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  factor numeric(18,6) NOT NULL,
  CONSTRAINT uom_conversion_from_to_key UNIQUE (from_uom_id, to_uom_id)
);

CREATE TABLE product_category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  code varchar NOT NULL,
  parent_id uuid REFERENCES product_category(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE inventory_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE
);

CREATE TABLE supplier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  tax_id varchar,
  address_id uuid REFERENCES address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  tax_id varchar,
  address_id uuid REFERENCES address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE warehouse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar NOT NULL,
  name varchar NOT NULL,
  address_id uuid REFERENCES address(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE warehouse_bin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  code varchar NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar NOT NULL,
  name varchar NOT NULL,
  category_id uuid REFERENCES product_category(id),
  base_uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  metadata jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_code varchar NOT NULL,
  expiry_date date,
  status_id uuid REFERENCES inventory_status(id),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  bin_id uuid REFERENCES warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty_on_hand numeric(18,3) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id),
  bin_id_norm uuid GENERATED ALWAYS AS (COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  lot_id_norm uuid GENERATED ALWAYS AS (COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  CONSTRAINT inventory_bucket_key UNIQUE (warehouse_id, bin_id_norm, product_id, lot_id_norm)
);

CREATE TABLE purchase_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text UNIQUE,
  supplier_id uuid NOT NULL REFERENCES supplier(id),
  status po_status NOT NULL DEFAULT 'DRAFT',
  order_date date NOT NULL,
  expected_date date,
  currency char(3),
  total_amount numeric(18,2),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE purchase_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  product_id uuid NOT NULL REFERENCES product(id),
  uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  qty_ordered numeric(18,3) NOT NULL,
  price_per_uom numeric(18,4) NOT NULL,
  qty_received numeric(18,3) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id),
  CONSTRAINT purchase_order_line_po_line_no_key UNIQUE (purchase_order_id, line_no),
  CONSTRAINT purchase_order_line_qty_received_check CHECK (qty_received <= qty_ordered)
);

CREATE TABLE receipt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_order(id),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE receipt_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES receipt(id) ON DELETE CASCADE,
  po_line_id uuid NOT NULL REFERENCES purchase_order_line(id),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  qty_received numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE sales_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number text UNIQUE,
  customer_id uuid NOT NULL REFERENCES customer(id),
  status so_status NOT NULL DEFAULT 'DRAFT',
  order_date date NOT NULL,
  due_date date,
  currency char(3),
  total_amount numeric(18,2),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE sales_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  product_id uuid NOT NULL REFERENCES product(id),
  uom_id uuid NOT NULL REFERENCES unit_of_measure(id),
  qty_ordered numeric(18,3) NOT NULL,
  price_per_uom numeric(18,4) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id),
  CONSTRAINT sales_order_line_so_line_no_key UNIQUE (sales_order_id, line_no)
);

CREATE TABLE carrier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  scac varchar
);

CREATE TABLE shipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text UNIQUE,
  sales_order_id uuid NOT NULL REFERENCES sales_order(id),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  carrier_id uuid REFERENCES carrier(id),
  tracking_no varchar,
  ship_date date,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE shipment_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipment(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty_shipped numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE transfer_order (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number text UNIQUE,
  from_warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  to_warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  status transfer_status NOT NULL DEFAULT 'DRAFT',
  requested_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE transfer_order_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_order_id uuid NOT NULL REFERENCES transfer_order(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  uom_id uuid REFERENCES unit_of_measure(id),
  qty numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_line_id uuid NOT NULL REFERENCES sales_order_line(id),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  bin_id uuid REFERENCES warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty_reserved numeric(18,3) NOT NULL,
  qty_picked numeric(18,3) NOT NULL DEFAULT 0,
  status reservation_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id),
  bin_id_norm uuid GENERATED ALWAYS AS (COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  lot_id_norm uuid GENERATED ALWAYS AS (COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  CONSTRAINT reservation_bucket_key UNIQUE (so_line_id, warehouse_id, bin_id_norm, product_id, lot_id_norm),
  CONSTRAINT reservation_qty_bounds CHECK (qty_picked <= qty_reserved)
);

CREATE TABLE picklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  status picklist_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE pick_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picklist_id uuid NOT NULL REFERENCES picklist(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES reservation(id),
  bin_id uuid REFERENCES warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty_to_pick numeric(18,3) NOT NULL,
  qty_picked numeric(18,3) NOT NULL DEFAULT 0,
  status pick_item_status NOT NULL DEFAULT 'OPEN',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id),
  CONSTRAINT pick_item_qty_bounds CHECK (qty_picked <= qty_to_pick)
);

CREATE TABLE package (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES sales_order(id),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  shipment_id uuid REFERENCES shipment(id),
  package_no text,
  status package_status NOT NULL DEFAULT 'OPEN',
  weight_kg numeric(10,3),
  dims jsonb,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE package_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES package(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty numeric(18,3) NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE inventory_tx (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  warehouse_id uuid NOT NULL REFERENCES warehouse(id),
  bin_id uuid REFERENCES warehouse_bin(id),
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty_delta numeric(18,3) NOT NULL,
  reason inventory_reason NOT NULL,
  ref_type text,
  ref_id uuid,
  move_key text UNIQUE,
  created_by uuid REFERENCES app_user(id),
  CHECK (qty_delta <> 0)
);

CREATE TABLE customer_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customer(id),
  sales_order_id uuid REFERENCES sales_order(id),
  status rma_status NOT NULL DEFAULT 'DRAFT',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE customer_return_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_return_id uuid NOT NULL REFERENCES customer_return(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty numeric(18,3) NOT NULL,
  shipment_item_id uuid REFERENCES shipment_item(id),
  disposition_status_id uuid REFERENCES inventory_status(id)
);

CREATE TABLE supplier_return (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES supplier(id),
  purchase_order_id uuid REFERENCES purchase_order(id),
  status rtv_status NOT NULL DEFAULT 'DRAFT',
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE supplier_return_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_return_id uuid NOT NULL REFERENCES supplier_return(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product(id),
  lot_id uuid REFERENCES lot(id),
  qty numeric(18,3) NOT NULL,
  receipt_line_id uuid REFERENCES receipt_line(id)
);

CREATE TABLE bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id uuid NOT NULL REFERENCES product(id),
  revision text,
  effective_from date,
  effective_to date,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES app_user(id),
  updated_at timestamptz,
  updated_by uuid REFERENCES app_user(id),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_user(id)
);

CREATE TABLE bom_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bom_id uuid NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES product(id),
  qty_per numeric(18,6) NOT NULL,
  sequence int
);

INSERT INTO scm.inventory_status(code)
VALUES ('AVAILABLE'),('HOLD'),('DAMAGED'),('EXPIRED')
ON CONFLICT (code) DO NOTHING;