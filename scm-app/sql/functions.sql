SET search_path = scm, public, pg_catalog;

CREATE OR REPLACE FUNCTION scm.convert_qty(_qty numeric, _from uuid, _to uuid)
RETURNS numeric
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
AS $$
DECLARE v_factor numeric;
BEGIN
  IF _from = _to THEN
    RETURN _qty;
  END IF;
  SELECT factor INTO v_factor
  FROM uom_conversion
  WHERE from_uom_id = _from AND to_uom_id = _to;
  IF v_factor IS NULL THEN
    RAISE EXCEPTION 'Missing UOM conversion from % to %', _from, _to;
  END IF;
  RETURN _qty * v_factor;
END$$;

CREATE OR REPLACE FUNCTION scm.ensure_inventory_row(_warehouse_id uuid, _bin_id uuid, _product_id uuid, _lot_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO inventory(warehouse_id, bin_id, product_id, lot_id, qty_on_hand, created_by, updated_at, updated_by)
  VALUES (_warehouse_id, _bin_id, _product_id, _lot_id, 0, _user_id, now(), _user_id)
  ON CONFLICT (warehouse_id, bin_id_norm, product_id, lot_id_norm)
  DO UPDATE SET updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_id;
  RETURN v_id;
END$$;

CREATE OR REPLACE FUNCTION scm.available_qty(_warehouse_id uuid, _bin_id uuid, _product_id uuid, _lot_id uuid)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE v_on_hand numeric := 0;
DECLARE v_reserved_open numeric := 0;
BEGIN
  SELECT COALESCE(SUM(qty_on_hand),0) INTO v_on_hand
  FROM inventory
  WHERE is_deleted = false
    AND warehouse_id = _warehouse_id
    AND product_id = _product_id
    AND (bin_id IS NOT DISTINCT FROM _bin_id)
    AND (lot_id IS NOT DISTINCT FROM _lot_id);

  SELECT COALESCE(SUM(qty_reserved - qty_picked),0) INTO v_reserved_open
  FROM reservation
  WHERE is_deleted = false
    AND status IN ('OPEN','PICKED')
    AND warehouse_id = _warehouse_id
    AND product_id = _product_id
    AND (bin_id IS NOT DISTINCT FROM _bin_id)
    AND (lot_id IS NOT DISTINCT FROM _lot_id);

  RETURN GREATEST(v_on_hand - v_reserved_open, 0);
END$$;

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

  RETURN v_tx_id;
END$$;
