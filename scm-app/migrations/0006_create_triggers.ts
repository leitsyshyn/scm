import { Effect } from "effect";
import { SqlClient } from "@effect/sql";

export default Effect.flatMap(
  SqlClient.SqlClient,
  (sql) => sql`SET search_path = scm, public, pg_catalog;

CREATE OR REPLACE FUNCTION scm.normalize_email_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN NEW.email := lower(NEW.email); END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_app_user__normalize_email ON app_user;
CREATE TRIGGER trg_app_user__normalize_email
BEFORE INSERT OR UPDATE ON app_user
FOR EACH ROW EXECUTE FUNCTION scm.normalize_email_trg();

CREATE OR REPLACE FUNCTION scm.touch_updated_at_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_product_category__touch ON product_category;
CREATE TRIGGER trg_product_category__touch BEFORE UPDATE ON product_category FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_supplier__touch ON supplier;
CREATE TRIGGER trg_supplier__touch BEFORE UPDATE ON supplier FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_customer__touch ON customer;
CREATE TRIGGER trg_customer__touch BEFORE UPDATE ON customer FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_warehouse__touch ON warehouse;
CREATE TRIGGER trg_warehouse__touch BEFORE UPDATE ON warehouse FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_warehouse_bin__touch ON warehouse_bin;
CREATE TRIGGER trg_warehouse_bin__touch BEFORE UPDATE ON warehouse_bin FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_product__touch ON product;
CREATE TRIGGER trg_product__touch BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_lot__touch ON lot;
CREATE TRIGGER trg_lot__touch BEFORE UPDATE ON lot FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_inventory__touch ON inventory;
CREATE TRIGGER trg_inventory__touch BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_purchase_order__touch ON purchase_order;
CREATE TRIGGER trg_purchase_order__touch BEFORE UPDATE ON purchase_order FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_purchase_order_line__touch ON purchase_order_line;
CREATE TRIGGER trg_purchase_order_line__touch BEFORE UPDATE ON purchase_order_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_receipt__touch ON receipt;
CREATE TRIGGER trg_receipt__touch BEFORE UPDATE ON receipt FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_receipt_line__touch ON receipt_line;
CREATE TRIGGER trg_receipt_line__touch BEFORE UPDATE ON receipt_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_sales_order__touch ON sales_order;
CREATE TRIGGER trg_sales_order__touch BEFORE UPDATE ON sales_order FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_sales_order_line__touch ON sales_order_line;
CREATE TRIGGER trg_sales_order_line__touch BEFORE UPDATE ON sales_order_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_shipment__touch ON shipment;
CREATE TRIGGER trg_shipment__touch BEFORE UPDATE ON shipment FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_shipment_item__touch ON shipment_item;
CREATE TRIGGER trg_shipment_item__touch BEFORE UPDATE ON shipment_item FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_transfer_order__touch ON transfer_order;
CREATE TRIGGER trg_transfer_order__touch BEFORE UPDATE ON transfer_order FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_transfer_order_line__touch ON transfer_order_line;
CREATE TRIGGER trg_transfer_order_line__touch BEFORE UPDATE ON transfer_order_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_reservation__touch ON reservation;
CREATE TRIGGER trg_reservation__touch BEFORE UPDATE ON reservation FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_picklist__touch ON picklist;
CREATE TRIGGER trg_picklist__touch BEFORE UPDATE ON picklist FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_pick_item__touch ON pick_item;
CREATE TRIGGER trg_pick_item__touch BEFORE UPDATE ON pick_item FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_package__touch ON package;
CREATE TRIGGER trg_package__touch BEFORE UPDATE ON package FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_package_item__touch ON package_item;
CREATE TRIGGER trg_package_item__touch BEFORE UPDATE ON package_item FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_customer_return__touch ON customer_return;
CREATE TRIGGER trg_customer_return__touch BEFORE UPDATE ON customer_return FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_customer_return_line__touch ON customer_return_line;
CREATE TRIGGER trg_customer_return_line__touch BEFORE UPDATE ON customer_return_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_supplier_return__touch ON supplier_return;
CREATE TRIGGER trg_supplier_return__touch BEFORE UPDATE ON supplier_return FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_supplier_return_line__touch ON supplier_return_line;
CREATE TRIGGER trg_supplier_return_line__touch BEFORE UPDATE ON supplier_return_line FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

DROP TRIGGER IF EXISTS trg_bom__touch ON bom;
CREATE TRIGGER trg_bom__touch BEFORE UPDATE ON bom FOR EACH ROW EXECUTE FUNCTION scm.touch_updated_at_trg();

CREATE OR REPLACE FUNCTION scm.inventory_guard_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('scm.allow_inventory_mutation', true) <> '1' THEN
    IF TG_OP = 'INSERT' THEN
      IF COALESCE(NEW.qty_on_hand,0) <> 0 THEN RAISE EXCEPTION 'Direct insert into inventory is not allowed'; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.qty_on_hand IS DISTINCT FROM OLD.qty_on_hand THEN RAISE EXCEPTION 'Direct change to inventory.qty_on_hand is not allowed'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_inventory__guard ON inventory;
CREATE TRIGGER trg_inventory__guard
BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION scm.inventory_guard_trg();

CREATE OR REPLACE FUNCTION scm.inventory_tx_guard_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('scm.allow_inventory_tx_insert', true) <> '1' THEN
    RAISE EXCEPTION 'Direct insert into inventory_tx is not allowed';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_inventory_tx__guard ON inventory_tx;
CREATE TRIGGER trg_inventory_tx__guard
BEFORE INSERT ON inventory_tx
FOR EACH ROW EXECUTE FUNCTION scm.inventory_tx_guard_trg();

CREATE OR REPLACE FUNCTION scm.post_inventory_tx(
  _warehouse_id uuid,
  _bin_id uuid,
  _product_id uuid,
  _lot_id uuid,
  _qty_delta numeric,
  _reason inventory_reason,
  _ref_type text,
  _ref_id uuid,
  _move_key text,
  _user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_inv_id uuid;
DECLARE v_new_qty numeric;
DECLARE v_tx_id uuid;
BEGIN
  PERFORM set_config('scm.allow_inventory_mutation','1', true);
  PERFORM set_config('scm.allow_inventory_tx_insert','1', true);

  v_inv_id := scm.ensure_inventory_row(_warehouse_id, _bin_id, _product_id, _lot_id, _user_id);

  SELECT qty_on_hand INTO v_new_qty FROM inventory WHERE id = v_inv_id FOR UPDATE;
  v_new_qty := v_new_qty + _qty_delta;
  IF v_new_qty < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for warehouse %, bin %, product %, lot %', _warehouse_id, _bin_id, _product_id, _lot_id;
  END IF;

  UPDATE inventory
  SET qty_on_hand = v_new_qty, updated_at = now(), updated_by = _user_id
  WHERE id = v_inv_id;

  INSERT INTO inventory_tx (id, ts, warehouse_id, bin_id, product_id, lot_id, qty_delta, reason, ref_type, ref_id, move_key, created_by)
  VALUES (gen_random_uuid(), now(), _warehouse_id, _bin_id, _product_id, _lot_id, _qty_delta, _reason, _ref_type, _ref_id, _move_key, _user_id)
  RETURNING id INTO v_tx_id;

  PERFORM set_config('scm.allow_inventory_mutation','0', true);
  PERFORM set_config('scm.allow_inventory_tx_insert','0', true);
  RETURN v_tx_id;
END$$;

CREATE OR REPLACE FUNCTION scm.reservation_guard_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_line sales_order_line%ROWTYPE;
DECLARE v_prod product%ROWTYPE;
DECLARE v_limit numeric;
DECLARE v_total_reserved_excl numeric;
DECLARE v_total_with_new numeric;
DECLARE v_delta_reserved numeric;
DECLARE v_avail numeric;
BEGIN
  SELECT sol.* INTO v_line FROM sales_order_line sol WHERE sol.id = NEW.so_line_id AND sol.is_deleted = false;
  IF v_line.id IS NULL THEN RAISE EXCEPTION 'SO line not found'; END IF;
  SELECT p.* INTO v_prod FROM product p WHERE p.id = v_line.product_id AND p.is_deleted = false;
  IF v_prod.id IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF NEW.product_id IS DISTINCT FROM v_line.product_id THEN RAISE EXCEPTION 'Reservation product mismatch with SO line'; END IF;

  v_limit := scm.convert_qty(v_line.qty_ordered, v_line.uom_id, v_prod.base_uom_id);

  SELECT COALESCE(SUM(qty_reserved),0) INTO v_total_reserved_excl
  FROM reservation
  WHERE so_line_id = NEW.so_line_id
    AND id IS DISTINCT FROM COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND is_deleted = false;

  v_total_with_new := v_total_reserved_excl + NEW.qty_reserved;
  IF v_total_with_new > v_limit THEN
    RAISE EXCEPTION 'Total reserved % exceeds ordered % for SO line %', v_total_with_new, v_limit, NEW.so_line_id;
  END IF;

  IF NEW.qty_picked > NEW.qty_reserved THEN
    RAISE EXCEPTION 'Picked qty cannot exceed reserved qty';
  END IF;

  v_delta_reserved := CASE WHEN TG_OP = 'INSERT' THEN NEW.qty_reserved ELSE GREATEST(NEW.qty_reserved - OLD.qty_reserved, 0) END;
  IF v_delta_reserved > 0 THEN
    v_avail := scm.available_qty(NEW.warehouse_id, NEW.bin_id, NEW.product_id, NEW.lot_id);
    IF v_avail < v_delta_reserved THEN
      RAISE EXCEPTION 'Insufficient available qty for reservation. Needed %, available %', v_delta_reserved, v_avail;
    END IF;
  END IF;

  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_reservation__guard ON reservation;
CREATE TRIGGER trg_reservation__guard
BEFORE INSERT OR UPDATE ON reservation
FOR EACH ROW EXECUTE FUNCTION scm.reservation_guard_trg();

CREATE OR REPLACE FUNCTION scm.picklist_autoclose_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pick_item
    WHERE picklist_id = NEW.picklist_id AND is_deleted = false AND status <> 'PICKED'
  ) THEN
    RETURN NEW;
  END IF;
  UPDATE picklist SET status = 'CLOSED', updated_at = now() WHERE id = NEW.picklist_id AND status <> 'CLOSED';
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_pick_item__autoclose ON pick_item;
CREATE TRIGGER trg_pick_item__autoclose
AFTER INSERT OR UPDATE ON pick_item
FOR EACH ROW EXECUTE FUNCTION scm.picklist_autoclose_trg();

CREATE OR REPLACE FUNCTION scm.recompute_so_ship_status(_so_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_ordered numeric := 0;
DECLARE v_shipped numeric := 0;
DECLARE v_cur text;
BEGIN
  SELECT COALESCE(SUM(qty_ordered),0) INTO v_ordered
  FROM sales_order_line
  WHERE sales_order_id = _so_id AND is_deleted = false;

  SELECT COALESCE(SUM(si.qty_shipped),0) INTO v_shipped
  FROM shipment_item si
  JOIN shipment s ON s.id = si.shipment_id
  WHERE s.sales_order_id = _so_id AND s.is_deleted = false AND si.is_deleted = false;

  SELECT status INTO v_cur FROM sales_order WHERE id = _so_id AND is_deleted = false FOR UPDATE;

  IF v_cur IS NOT NULL AND v_cur <> 'CANCELLED' THEN
    IF v_ordered > 0 AND v_shipped >= v_ordered THEN
      UPDATE sales_order SET status = 'SHIPPED', updated_at = now() WHERE id = _so_id AND status <> 'SHIPPED';
    ELSIF v_shipped > 0 THEN
      UPDATE sales_order SET status = 'PART_SHIPPED', updated_at = now() WHERE id = _so_id AND status <> 'PART_SHIPPED';
    END IF;
  END IF;
END$$;

CREATE OR REPLACE FUNCTION scm.shipment_item_so_status_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_so_id uuid;
BEGIN
  SELECT sales_order_id INTO v_so_id FROM shipment WHERE id = COALESCE(NEW.shipment_id, OLD.shipment_id);
  IF v_so_id IS NOT NULL THEN PERFORM scm.recompute_so_ship_status(v_so_id); END IF;
  RETURN COALESCE(NEW, OLD);
END$$;

DROP TRIGGER IF EXISTS trg_shipment_item__so_status ON shipment_item;
CREATE TRIGGER trg_shipment_item__so_status
AFTER INSERT OR UPDATE OR DELETE ON shipment_item
FOR EACH ROW EXECUTE FUNCTION scm.shipment_item_so_status_trg();

CREATE OR REPLACE FUNCTION scm.recompute_po_received_status(_po_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE v_open int;
BEGIN
  SELECT COUNT(*) INTO v_open
  FROM purchase_order_line
  WHERE purchase_order_id = _po_id
    AND is_deleted = false
    AND qty_received < qty_ordered;

  IF v_open = 0 THEN
    UPDATE purchase_order SET status = 'RECEIVED', updated_at = now()
    WHERE id = _po_id AND is_deleted = false AND status <> 'CANCELLED' AND status <> 'RECEIVED';
  END IF;
END$$;

CREATE OR REPLACE FUNCTION scm.purchase_order_line_status_trg()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_po_id uuid;
BEGIN
  v_po_id := COALESCE(NEW.purchase_order_id, OLD.purchase_order_id);
  IF v_po_id IS NOT NULL THEN PERFORM scm.recompute_po_received_status(v_po_id); END IF;
  RETURN COALESCE(NEW, OLD);
END$$;

DROP TRIGGER IF EXISTS trg_purchase_order_line__po_status ON purchase_order_line;
CREATE TRIGGER trg_purchase_order_line__po_status
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_line
FOR EACH ROW EXECUTE FUNCTION scm.purchase_order_line_status_trg();`);