CREATE OR REPLACE PROCEDURE scm.po_create(
  IN _supplier_id uuid,
  IN _order_date date,
  IN _expected_date date,
  IN _currency char(3),
  IN _user_id uuid,
  INOUT _po_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO purchase_order(id, po_number, supplier_id, status, order_date, expected_date, currency, is_deleted, created_at, created_by)
  VALUES (COALESCE(_po_id, gen_random_uuid()), NULL, _supplier_id, 'DRAFT', _order_date, _expected_date, _currency, false, now(), _user_id)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO _po_id FROM purchase_order WHERE id = COALESCE(_po_id, _po_id);
END$$;

CREATE OR REPLACE PROCEDURE scm.po_add_line(
  IN _po_id uuid,
  IN _product_id uuid,
  IN _uom_id uuid,
  IN _qty_ordered numeric,
  IN _price_per_uom numeric,
  IN _user_id uuid,
  INOUT _po_line_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_line_no int;
BEGIN
  SELECT COALESCE(MAX(line_no),0)+1 INTO v_line_no FROM purchase_order_line WHERE purchase_order_id = _po_id;
  INSERT INTO purchase_order_line(id, purchase_order_id, line_no, product_id, uom_id, qty_ordered, price_per_uom, is_deleted, created_at, created_by)
  VALUES (COALESCE(_po_line_id, gen_random_uuid()), _po_id, v_line_no, _product_id, _uom_id, _qty_ordered, _price_per_uom, false, now(), _user_id)
  RETURNING id INTO _po_line_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.po_approve(IN _po_id uuid, IN _user_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE purchase_order SET status = 'APPROVED', updated_at = now(), updated_by = _user_id
  WHERE id = _po_id AND is_deleted = false AND status = 'DRAFT';
END$$;

CREATE OR REPLACE PROCEDURE scm.receipt_create(
  IN _po_id uuid,
  IN _warehouse_id uuid,
  IN _user_id uuid,
  INOUT _receipt_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO receipt(id, receipt_number, purchase_order_id, warehouse_id, is_deleted, created_at, created_by)
  VALUES (COALESCE(_receipt_id, gen_random_uuid()), NULL, _po_id, _warehouse_id, false, now(), _user_id)
  RETURNING id INTO _receipt_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.receipt_add_line(
  IN _receipt_id uuid,
  IN _po_line_id uuid,
  IN _product_id uuid,
  IN _uom_id uuid,
  IN _qty_received numeric,
  IN _lot_id uuid,
  IN _user_id uuid,
  INOUT _receipt_line_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_rec receipt%ROWTYPE;
DECLARE v_pol purchase_order_line%ROWTYPE;
DECLARE v_po purchase_order%ROWTYPE;
DECLARE v_qty_base numeric;
DECLARE v_base_uom uuid;
DECLARE v_wh uuid;
DECLARE v_tx uuid;
BEGIN
  SELECT * INTO v_rec FROM receipt WHERE id = _receipt_id AND is_deleted = false;
  IF v_rec.id IS NULL THEN RAISE EXCEPTION 'Receipt not found'; END IF;

  SELECT * INTO v_pol FROM purchase_order_line WHERE id = _po_line_id AND is_deleted = false FOR UPDATE;
  IF v_pol.id IS NULL THEN RAISE EXCEPTION 'PO line not found'; END IF;

  SELECT * INTO v_po FROM purchase_order WHERE id = v_pol.purchase_order_id AND is_deleted = false FOR UPDATE;
  IF v_po.id IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;

  SELECT base_uom_id INTO v_base_uom FROM product WHERE id = _product_id AND is_deleted = false;
  v_qty_base := scm.convert_qty(_qty_received, _uom_id, v_base_uom);
  IF v_qty_base <= 0 THEN RAISE EXCEPTION 'Invalid received qty'; END IF;

  INSERT INTO receipt_line(id, receipt_id, po_line_id, product_id, lot_id, uom_id, qty_received, is_deleted, created_at, created_by)
  VALUES (COALESCE(_receipt_line_id, gen_random_uuid()), _receipt_id, _po_line_id, _product_id, _lot_id, _uom_id, _qty_received, false, now(), _user_id)
  RETURNING id INTO _receipt_line_id;

  UPDATE purchase_order_line
  SET qty_received = qty_received + _qty_received, updated_at = now(), updated_by = _user_id
  WHERE id = _po_line_id;

  v_wh := v_rec.warehouse_id;
  v_tx := scm.post_inventory_tx(v_wh, NULL, _product_id, _lot_id, v_qty_base, 'RECEIVE', 'RECEIPT_LINE', _receipt_line_id, 'RECEIPT:'||_receipt_line_id::text, _user_id);

  IF NOT EXISTS (
    SELECT 1 FROM purchase_order_line
    WHERE purchase_order_id = v_pol.purchase_order_id
      AND (qty_received < qty_ordered) AND is_deleted = false
  )
  THEN
    UPDATE purchase_order SET status = 'RECEIVED', updated_at = now(), updated_by = _user_id WHERE id = v_pol.purchase_order_id;
  END IF;
END$$;

CREATE OR REPLACE PROCEDURE scm.so_create(
  IN _customer_id uuid,
  IN _order_date date,
  IN _due_date date,
  IN _currency char(3),
  IN _user_id uuid,
  INOUT _so_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO sales_order(id, so_number, customer_id, status, order_date, due_date, currency, is_deleted, created_at, created_by)
  VALUES (COALESCE(_so_id, gen_random_uuid()), NULL, _customer_id, 'DRAFT', _order_date, _due_date, _currency, false, now(), _user_id)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO _so_id FROM sales_order WHERE id = COALESCE(_so_id, _so_id);
END$$;

CREATE OR REPLACE PROCEDURE scm.so_add_line(
  IN _so_id uuid,
  IN _product_id uuid,
  IN _uom_id uuid,
  IN _qty_ordered numeric,
  IN _price_per_uom numeric,
  IN _user_id uuid,
  INOUT _so_line_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_line_no int;
BEGIN
  SELECT COALESCE(MAX(line_no),0)+1 INTO v_line_no FROM sales_order_line WHERE sales_order_id = _so_id;
  INSERT INTO sales_order_line(id, sales_order_id, line_no, product_id, uom_id, qty_ordered, price_per_uom, is_deleted, created_at, created_by)
  VALUES (COALESCE(_so_line_id, gen_random_uuid()), _so_id, v_line_no, _product_id, _uom_id, _qty_ordered, _price_per_uom, false, now(), _user_id)
  RETURNING id INTO _so_line_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.so_approve(IN _so_id uuid, IN _user_id uuid)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE sales_order SET status = 'APPROVED', updated_at = now(), updated_by = _user_id
  WHERE id = _so_id AND is_deleted = false AND status = 'DRAFT';
END$$;

CREATE OR REPLACE PROCEDURE scm.reservation_create(
  IN _so_line_id uuid,
  IN _warehouse_id uuid,
  IN _bin_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _qty_reserved numeric,
  IN _user_id uuid,
  INOUT _reservation_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_base_uom uuid;
DECLARE v_line sales_order_line%ROWTYPE;
DECLARE v_qty_base numeric;
DECLARE v_available numeric;
BEGIN
  SELECT * INTO v_line FROM sales_order_line WHERE id = _so_line_id AND is_deleted = false;
  IF v_line.id IS NULL THEN RAISE EXCEPTION 'SO line not found'; END IF;

  SELECT base_uom_id INTO v_base_uom FROM product WHERE id = _product_id AND is_deleted = false;
  v_qty_base := scm.convert_qty(_qty_reserved, v_line.uom_id, v_base_uom);

  v_available := scm.available_qty(_warehouse_id, _bin_id, _product_id, _lot_id);
  IF v_available < v_qty_base THEN
    RAISE EXCEPTION 'Insufficient available qty: requested %, available %', v_qty_base, v_available;
  END IF;

  INSERT INTO reservation(id, so_line_id, warehouse_id, bin_id, product_id, lot_id, qty_reserved, qty_picked, status, is_deleted, created_at, created_by)
  VALUES (COALESCE(_reservation_id, gen_random_uuid()), _so_line_id, _warehouse_id, _bin_id, _product_id, _lot_id, v_qty_base, 0, 'OPEN', false, now(), _user_id)
  RETURNING id INTO _reservation_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.picklist_create_for_order(
  IN _sales_order_id uuid,
  IN _warehouse_id uuid,
  IN _user_id uuid,
  INOUT _picklist_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO picklist(id, warehouse_id, status, is_deleted, created_at, created_by)
  VALUES (COALESCE(_picklist_id, gen_random_uuid()), _warehouse_id, 'OPEN', false, now(), _user_id)
  ON CONFLICT (id) DO NOTHING;
  SELECT id INTO _picklist_id FROM picklist WHERE id = COALESCE(_picklist_id, _picklist_id);

  INSERT INTO pick_item(id, picklist_id, reservation_id, bin_id, product_id, lot_id, qty_to_pick, qty_picked, status, is_deleted, created_at, created_by)
  SELECT gen_random_uuid(), _picklist_id, r.id, r.bin_id, r.product_id, r.lot_id,
         (r.qty_reserved - r.qty_picked), 0, 'OPEN', false, now(), _user_id
  FROM reservation r
  JOIN sales_order_line sol ON sol.id = r.so_line_id AND sol.is_deleted = false
  WHERE sol.sales_order_id = _sales_order_id
    AND r.is_deleted = false
    AND r.status IN ('OPEN','PICKED')
    AND (r.qty_reserved - r.qty_picked) > 0;
END$$;

CREATE OR REPLACE PROCEDURE scm.pick_item_confirm(
  IN _pick_item_id uuid,
  IN _qty_to_confirm numeric,
  IN _user_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_pi pick_item%ROWTYPE;
DECLARE v_res reservation%ROWTYPE;
DECLARE v_base_uom uuid;
DECLARE v_tx uuid;
DECLARE v_move_key text;
BEGIN
  SELECT * INTO v_pi FROM pick_item WHERE id = _pick_item_id AND is_deleted = false FOR UPDATE;
  IF v_pi.id IS NULL THEN RAISE EXCEPTION 'Pick item not found'; END IF;

  SELECT * INTO v_res FROM reservation WHERE id = v_pi.reservation_id AND is_deleted = false FOR UPDATE;
  IF v_res.id IS NULL THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  SELECT base_uom_id INTO v_base_uom FROM product WHERE id = v_pi.product_id AND is_deleted = false;

  IF _qty_to_confirm <= 0 OR _qty_to_confirm > (v_pi.qty_to_pick - v_pi.qty_picked) THEN
    RAISE EXCEPTION 'Invalid confirm quantity';
  END IF;

  v_move_key := 'PICK:'||_pick_item_id::text;

  v_tx := scm.post_inventory_tx(v_res.warehouse_id, v_pi.bin_id, v_pi.product_id, v_pi.lot_id,
                                -_qty_to_confirm, 'ISSUE_PICK', 'PICK_ITEM', _pick_item_id, v_move_key, _user_id);

  UPDATE pick_item
  SET qty_picked = qty_picked + _qty_to_confirm,
      status = CASE WHEN qty_picked + _qty_to_confirm >= qty_to_pick THEN 'PICKED' ELSE status END,
      updated_at = now(), updated_by = _user_id
  WHERE id = _pick_item_id;

  UPDATE reservation
  SET qty_picked = qty_picked + _qty_to_confirm,
      status = CASE WHEN qty_picked + _qty_to_confirm >= qty_reserved THEN 'PICKED' ELSE status END,
      updated_at = now(), updated_by = _user_id
  WHERE id = v_res.id;
END$$;

CREATE OR REPLACE PROCEDURE scm.package_create(
  IN _sales_order_id uuid,
  IN _warehouse_id uuid,
  IN _user_id uuid,
  INOUT _package_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO package(id, sales_order_id, warehouse_id, status, is_deleted, created_at, created_by)
  VALUES (COALESCE(_package_id, gen_random_uuid()), _sales_order_id, _warehouse_id, 'OPEN', false, now(), _user_id)
  RETURNING id INTO _package_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.package_add_item(
  IN _package_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _qty numeric,
  IN _user_id uuid,
  INOUT _package_item_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO package_item(id, package_id, product_id, lot_id, qty, is_deleted, created_at, created_by)
  VALUES (COALESCE(_package_item_id, gen_random_uuid()), _package_id, _product_id, _lot_id, _qty, false, now(), _user_id)
  RETURNING id INTO _package_item_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.shipment_create(
  IN _sales_order_id uuid,
  IN _warehouse_id uuid,
  IN _carrier_id uuid,
  IN _tracking_no text,
  IN _ship_date date,
  IN _user_id uuid,
  INOUT _shipment_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO shipment(id, shipment_number, sales_order_id, warehouse_id, carrier_id, tracking_no, ship_date, is_deleted, created_at, created_by)
  VALUES (COALESCE(_shipment_id, gen_random_uuid()), NULL, _sales_order_id, _warehouse_id, _carrier_id, _tracking_no, _ship_date, false, now(), _user_id)
  RETURNING id INTO _shipment_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.shipment_add_from_picks(
  IN _shipment_id uuid,
  IN _user_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_ship shipment%ROWTYPE;
DECLARE v_so_id uuid;
DECLARE v_all_qty numeric;
DECLARE v_shipped_qty numeric;
BEGIN
  SELECT * INTO v_ship FROM shipment WHERE id = _shipment_id AND is_deleted = false;
  IF v_ship.id IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;

  INSERT INTO shipment_item(id, shipment_id, product_id, lot_id, qty_shipped, is_deleted, created_at, created_by)
  SELECT gen_random_uuid(), _shipment_id, pi.product_id, pi.lot_id, pi.qty_picked, false, now(), _user_id
  FROM pick_item pi
  JOIN picklist pl ON pl.id = pi.picklist_id AND pl.is_deleted = false
  WHERE pi.is_deleted = false AND pi.qty_picked > 0
    AND pl.warehouse_id = v_ship.warehouse_id;

  v_so_id := v_ship.sales_order_id;

  SELECT COALESCE(SUM(sol.qty_ordered),0) INTO v_all_qty
  FROM sales_order_line sol
  WHERE sol.sales_order_id = v_so_id AND sol.is_deleted = false;

  SELECT COALESCE(SUM(si.qty_shipped),0) INTO v_shipped_qty
  FROM shipment_item si
  JOIN shipment s ON s.id = si.shipment_id AND s.sales_order_id = v_so_id AND s.is_deleted = false
  WHERE si.is_deleted = false;

  UPDATE sales_order
  SET status = CASE WHEN v_shipped_qty >= v_all_qty AND v_all_qty > 0 THEN 'SHIPPED'::so_status ELSE 'PART_SHIPPED'::so_status END,
      updated_at = now(), updated_by = _user_id
  WHERE id = v_so_id AND is_deleted = false;
END$$;

CREATE OR REPLACE PROCEDURE scm.transfer_create(
  IN _from_warehouse_id uuid,
  IN _to_warehouse_id uuid,
  IN _user_id uuid,
  INOUT _transfer_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO transfer_order(id, transfer_number, from_warehouse_id, to_warehouse_id, status, is_deleted, created_at, created_by)
  VALUES (COALESCE(_transfer_id, gen_random_uuid()), NULL, _from_warehouse_id, _to_warehouse_id, 'DRAFT', false, now(), _user_id)
  RETURNING id INTO _transfer_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.transfer_add_line(
  IN _transfer_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _uom_id uuid,
  IN _qty numeric,
  IN _user_id uuid,
  INOUT _transfer_line_id uuid
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO transfer_order_line(id, transfer_order_id, product_id, lot_id, uom_id, qty, is_deleted, created_at, created_by)
  VALUES (COALESCE(_transfer_line_id, gen_random_uuid()), _transfer_id, _product_id, _lot_id, _uom_id, _qty, false, now(), _user_id)
  RETURNING id INTO _transfer_line_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.transfer_post_out(
  IN _transfer_id uuid,
  IN _from_bin_id uuid,
  IN _user_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_to transfer_order%ROWTYPE;
DECLARE r record;
DECLARE v_base_uom uuid;
DECLARE v_qty_base numeric;
DECLARE v_move_key text;
BEGIN
  SELECT * INTO v_to FROM transfer_order WHERE id = _transfer_id AND is_deleted = false FOR UPDATE;
  IF v_to.id IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  FOR r IN
    SELECT tol.*, p.base_uom_id AS base_uom FROM transfer_order_line tol
    JOIN product p ON p.id = tol.product_id AND p.is_deleted = false
    WHERE tol.transfer_order_id = _transfer_id AND tol.is_deleted = false
  LOOP
    v_base_uom := r.base_uom;
    v_qty_base := scm.convert_qty(r.qty, r.uom_id, v_base_uom);
    v_move_key := 'TO_OUT:'||r.id::text;
    PERFORM scm.post_inventory_tx(v_to.from_warehouse_id, _from_bin_id, r.product_id, r.lot_id,
                                  -v_qty_base, 'TRANSFER_OUT', 'TRANSFER_LINE', r.id, v_move_key, _user_id);
  END LOOP;

  UPDATE transfer_order SET status = 'IN_TRANSIT', updated_at = now(), updated_by = _user_id WHERE id = _transfer_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.transfer_post_in(
  IN _transfer_id uuid,
  IN _to_bin_id uuid,
  IN _user_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_to transfer_order%ROWTYPE;
DECLARE r record;
DECLARE v_base_uom uuid;
DECLARE v_qty_base numeric;
DECLARE v_move_key text;
BEGIN
  SELECT * INTO v_to FROM transfer_order WHERE id = _transfer_id AND is_deleted = false FOR UPDATE;
  IF v_to.id IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  FOR r IN
    SELECT tol.*, p.base_uom_id AS base_uom FROM transfer_order_line tol
    JOIN product p ON p.id = tol.product_id AND p.is_deleted = false
    WHERE tol.transfer_order_id = _transfer_id AND tol.is_deleted = false
  LOOP
    v_base_uom := r.base_uom;
    v_qty_base := scm.convert_qty(r.qty, r.uom_id, v_base_uom);
    v_move_key := 'TO_IN:'||r.id::text;
    PERFORM scm.post_inventory_tx(v_to.to_warehouse_id, _to_bin_id, r.product_id, r.lot_id,
                                  v_qty_base, 'TRANSFER_IN', 'TRANSFER_LINE', r.id, v_move_key, _user_id);
  END LOOP;

  UPDATE transfer_order SET status = 'RECEIVED', updated_at = now(), updated_by = _user_id WHERE id = _transfer_id;
END$$;

CREATE OR REPLACE PROCEDURE scm.inventory_adjust(
  IN _warehouse_id uuid,
  IN _bin_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _qty_delta numeric,
  IN _ref_type text,
  IN _ref_id uuid,
  IN _user_id uuid,
  INOUT _tx_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_reason inventory_reason;
BEGIN
  v_reason := CASE WHEN _qty_delta >= 0 THEN 'ADJUST_POS' ELSE 'ADJUST_NEG' END;
  _tx_id := scm.post_inventory_tx(_warehouse_id, _bin_id, _product_id, _lot_id, _qty_delta, v_reason, _ref_type, _ref_id, 'ADJ:'||COALESCE(_ref_id::text,'')||':'||now()::text, _user_id);
END$$;

CREATE OR REPLACE PROCEDURE scm.customer_return_receive(
  IN _customer_return_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _uom_id uuid,
  IN _qty numeric,
  IN _warehouse_id uuid,
  IN _bin_id uuid,
  IN _user_id uuid,
  INOUT _customer_return_line_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_base_uom uuid;
DECLARE v_qty_base numeric;
DECLARE v_move_key text;
BEGIN
  SELECT base_uom_id INTO v_base_uom FROM product WHERE id = _product_id AND is_deleted = false;
  v_qty_base := scm.convert_qty(_qty, _uom_id, v_base_uom);

  INSERT INTO customer_return_line(id, customer_return_id, product_id, lot_id, qty)
  VALUES (COALESCE(_customer_return_line_id, gen_random_uuid()), _customer_return_id, _product_id, _lot_id, _qty)
  RETURNING id INTO _customer_return_line_id;

  v_move_key := 'RMA_IN:'||_customer_return_line_id::text;
  PERFORM scm.post_inventory_tx(_warehouse_id, _bin_id, _product_id, _lot_id, v_qty_base, 'RETURN_FROM_CUST', 'CUSTOMER_RETURN_LINE', _customer_return_line_id, v_move_key, _user_id);

  UPDATE customer_return SET status = 'RECEIVED', updated_at = now(), updated_by = _user_id
  WHERE id = _customer_return_id AND status = 'DRAFT';
END$$;

CREATE OR REPLACE PROCEDURE scm.supplier_return_ship(
  IN _supplier_return_id uuid,
  IN _product_id uuid,
  IN _lot_id uuid,
  IN _uom_id uuid,
  IN _qty numeric,
  IN _warehouse_id uuid,
  IN _bin_id uuid,
  IN _user_id uuid,
  INOUT _supplier_return_line_id uuid
)
LANGUAGE plpgsql
AS $$
DECLARE v_base_uom uuid;
DECLARE v_qty_base numeric;
DECLARE v_move_key text;
BEGIN
  SELECT base_uom_id INTO v_base_uom FROM product WHERE id = _product_id AND is_deleted = false;
  v_qty_base := scm.convert_qty(_qty, _uom_id, v_base_uom);

  INSERT INTO supplier_return_line(id, supplier_return_id, product_id, lot_id, qty)
  VALUES (COALESCE(_supplier_return_line_id, gen_random_uuid()), _supplier_return_id, _product_id, _lot_id, _qty)
  RETURNING id INTO _supplier_return_line_id;

  v_move_key := 'RTV_OUT:'||_supplier_return_line_id::text;
  PERFORM scm.post_inventory_tx(_warehouse_id, _bin_id, _product_id, _lot_id, -v_qty_base, 'RETURN_TO_SUPP', 'SUPPLIER_RETURN_LINE', _supplier_return_line_id, v_move_key, _user_id);

  UPDATE supplier_return SET status = 'SHIPPED', updated_at = now(), updated_by = _user_id
  WHERE id = _supplier_return_id AND status = 'DRAFT';
END$$;
