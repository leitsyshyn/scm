SET search_path = scm, public, pg_catalog;

CREATE OR REPLACE VIEW v_product AS
SELECT
  p.id,
  p.sku,
  p.name,
  p.category_id,
  pc.name AS category_name,
  p.base_uom_id,
  u.code AS base_uom_code
FROM product p
LEFT JOIN product_category pc ON pc.id = p.category_id AND pc.is_deleted = false
LEFT JOIN unit_of_measure u ON u.id = p.base_uom_id
WHERE p.is_deleted = false;

CREATE OR REPLACE VIEW v_product_category_path AS
WITH RECURSIVE c AS (
  SELECT
    pc.id,
    pc.code,
    pc.name,
    pc.parent_id,
    pc.code::text AS path_code,
    pc.name::text AS path_name,
    0 AS depth
  FROM product_category pc
  WHERE pc.parent_id IS NULL AND pc.is_deleted = false
  UNION ALL
  SELECT
    ch.id,
    ch.code,
    ch.name,
    ch.parent_id,
    c.path_code || '/' || ch.code,
    c.path_name || '/' || ch.name,
    c.depth + 1
  FROM product_category ch
  JOIN c ON ch.parent_id = c.id
  WHERE ch.is_deleted = false
)
SELECT id, code, name, parent_id, path_code, path_name, depth
FROM c;

CREATE OR REPLACE VIEW v_lot AS
SELECT
  l.id,
  l.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  l.lot_code,
  l.expiry_date,
  l.status_id
FROM lot l
JOIN product p ON p.id = l.product_id
WHERE l.is_deleted = false AND p.is_deleted = false;

CREATE OR REPLACE VIEW v_inventory_bucket AS
SELECT
  i.id,
  i.warehouse_id,
  w.code AS warehouse_code,
  i.bin_id,
  b.code AS bin_code,
  i.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  i.lot_id,
  l.lot_code,
  i.qty_on_hand
FROM inventory i
JOIN warehouse w ON w.id = i.warehouse_id AND w.is_deleted = false
LEFT JOIN warehouse_bin b ON b.id = i.bin_id AND b.is_deleted = false
JOIN product p ON p.id = i.product_id AND p.is_deleted = false
LEFT JOIN lot l ON l.id = i.lot_id AND l.is_deleted = false
WHERE i.is_deleted = false;

CREATE OR REPLACE VIEW v_reservation_open AS
SELECT
  r.warehouse_id,
  r.bin_id,
  r.product_id,
  r.lot_id,
  SUM(r.qty_reserved - r.qty_picked) AS qty_reserved_open
FROM reservation r
WHERE r.is_deleted = false
  AND r.status IN ('OPEN','PICKED')
GROUP BY r.warehouse_id, r.bin_id, r.product_id, r.lot_id;

CREATE OR REPLACE VIEW v_inventory_available AS
SELECT
  ib.warehouse_id,
  ib.warehouse_code,
  ib.bin_id,
  ib.bin_code,
  ib.product_id,
  ib.product_sku,
  ib.product_name,
  ib.lot_id,
  ib.lot_code,
  ib.qty_on_hand,
  GREATEST(ib.qty_on_hand - COALESCE(ro.qty_reserved_open,0), 0) AS qty_available
FROM v_inventory_bucket ib
LEFT JOIN v_reservation_open ro
  ON ro.warehouse_id = ib.warehouse_id
 AND ro.product_id = ib.product_id
 AND (ro.bin_id IS NOT DISTINCT FROM ib.bin_id)
 AND (ro.lot_id IS NOT DISTINCT FROM ib.lot_id);

CREATE OR REPLACE VIEW v_po_line_open AS
SELECT
  pol.id,
  pol.purchase_order_id,
  po.po_number,
  po.supplier_id,
  s.name AS supplier_name,
  po.status AS po_status,
  po.order_date,
  po.expected_date,
  pol.line_no,
  pol.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  pol.uom_id,
  u.code AS uom_code,
  pol.qty_ordered,
  pol.qty_received,
  GREATEST(pol.qty_ordered - pol.qty_received, 0) AS qty_outstanding,
  pol.price_per_uom,
  GREATEST(pol.qty_ordered - pol.qty_received, 0) * pol.price_per_uom AS amount_outstanding
FROM purchase_order_line pol
JOIN purchase_order po ON po.id = pol.purchase_order_id AND po.is_deleted = false AND po.status IN ('DRAFT','APPROVED')
JOIN supplier s ON s.id = po.supplier_id AND s.is_deleted = false
JOIN product p ON p.id = pol.product_id AND p.is_deleted = false
JOIN unit_of_measure u ON u.id = pol.uom_id
WHERE pol.is_deleted = false
  AND GREATEST(pol.qty_ordered - pol.qty_received, 0) > 0;

CREATE OR REPLACE VIEW v_po_header_open AS
SELECT
  po.id,
  po.po_number,
  po.supplier_id,
  s.name AS supplier_name,
  po.status AS po_status,
  po.order_date,
  po.expected_date,
  SUM(GREATEST(pol.qty_ordered - pol.qty_received, 0)) AS total_qty_outstanding,
  SUM(GREATEST(pol.qty_ordered - pol.qty_received, 0) * pol.price_per_uom) AS total_amount_outstanding
FROM purchase_order po
JOIN supplier s ON s.id = po.supplier_id AND s.is_deleted = false
JOIN purchase_order_line pol ON pol.purchase_order_id = po.id AND pol.is_deleted = false
WHERE po.is_deleted = false AND po.status IN ('DRAFT','APPROVED')
GROUP BY po.id, po.po_number, po.supplier_id, s.name, po.status, po.order_date, po.expected_date
HAVING SUM(GREATEST(pol.qty_ordered - pol.qty_received, 0)) > 0;

CREATE OR REPLACE VIEW v_so_line_reservations AS
SELECT
  sol.id AS so_line_id,
  sol.sales_order_id,
  sol.line_no,
  sol.product_id,
  SUM(CASE WHEN r.is_deleted = false AND r.status IN ('OPEN','PICKED') THEN (r.qty_reserved - r.qty_picked) ELSE 0 END) AS qty_reserved_open,
  SUM(CASE WHEN r.is_deleted = false THEN r.qty_picked ELSE 0 END) AS qty_picked_total
FROM sales_order_line sol
LEFT JOIN reservation r ON r.so_line_id = sol.id
WHERE sol.is_deleted = false
GROUP BY sol.id, sol.sales_order_id, sol.line_no, sol.product_id;

CREATE OR REPLACE VIEW v_so_line_open AS
SELECT
  sol.id,
  sol.sales_order_id,
  so.so_number,
  so.customer_id,
  c.name AS customer_name,
  so.status AS so_status,
  so.order_date,
  sol.line_no,
  sol.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  sol.uom_id,
  u.code AS uom_code,
  sol.qty_ordered,
  COALESCE(r.qty_reserved_open,0) AS qty_reserved_open,
  GREATEST(sol.qty_ordered - COALESCE(r.qty_reserved_open,0), 0) AS qty_to_reserve
FROM sales_order_line sol
JOIN sales_order so ON so.id = sol.sales_order_id AND so.is_deleted = false AND so.status IN ('DRAFT','APPROVED','PART_SHIPPED')
JOIN customer c ON c.id = so.customer_id AND c.is_deleted = false
JOIN product p ON p.id = sol.product_id AND p.is_deleted = false
JOIN unit_of_measure u ON u.id = sol.uom_id
LEFT JOIN v_so_line_reservations r ON r.so_line_id = sol.id
WHERE sol.is_deleted = false
  AND GREATEST(sol.qty_ordered - COALESCE(r.qty_reserved_open,0), 0) > 0;

CREATE OR REPLACE VIEW v_picklist_detail AS
SELECT
  pi.id,
  pi.picklist_id,
  pl.warehouse_id,
  pl.status AS picklist_status,
  pi.reservation_id,
  pi.bin_id,
  wb.code AS bin_code,
  pi.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  pi.lot_id,
  l.lot_code,
  pi.qty_to_pick,
  pi.qty_picked,
  pi.status AS pick_item_status
FROM pick_item pi
JOIN picklist pl ON pl.id = pi.picklist_id AND pl.is_deleted = false
JOIN product p ON p.id = pi.product_id AND p.is_deleted = false
LEFT JOIN warehouse_bin wb ON wb.id = pi.bin_id AND wb.is_deleted = false
LEFT JOIN lot l ON l.id = pi.lot_id AND l.is_deleted = false
WHERE pi.is_deleted = false;

CREATE OR REPLACE VIEW v_shipment_detail AS
SELECT
  s.id AS shipment_id,
  s.shipment_number,
  s.sales_order_id,
  so.so_number,
  s.warehouse_id,
  s.carrier_id,
  c.name AS carrier_name,
  s.tracking_no,
  s.ship_date,
  si.id AS shipment_item_id,
  si.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  si.lot_id,
  l.lot_code,
  si.qty_shipped
FROM shipment s
JOIN sales_order so ON so.id = s.sales_order_id AND so.is_deleted = false
LEFT JOIN carrier c ON c.id = s.carrier_id
JOIN shipment_item si ON si.shipment_id = s.id AND si.is_deleted = false
JOIN product p ON p.id = si.product_id AND p.is_deleted = false
LEFT JOIN lot l ON l.id = si.lot_id AND l.is_deleted = false
WHERE s.is_deleted = false;

CREATE OR REPLACE VIEW v_package_detail AS
SELECT
  pkg.id AS package_id,
  pkg.package_no,
  pkg.sales_order_id,
  so.so_number,
  pkg.warehouse_id,
  pkg.shipment_id,
  pkg.status AS package_status,
  pkg.weight_kg,
  pkg.dims,
  pgi.id AS package_item_id,
  pgi.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  pgi.lot_id,
  l.lot_code,
  pgi.qty
FROM package pkg
JOIN sales_order so ON so.id = pkg.sales_order_id AND so.is_deleted = false
JOIN package_item pgi ON pgi.package_id = pkg.id AND pgi.is_deleted = false
JOIN product p ON p.id = pgi.product_id AND p.is_deleted = false
LEFT JOIN lot l ON l.id = pgi.lot_id AND l.is_deleted = false
WHERE pkg.is_deleted = false;

CREATE OR REPLACE VIEW v_transfer_line_open AS
SELECT
  tol.id,
  tol.transfer_order_id,
  toh.transfer_number,
  toh.from_warehouse_id,
  toh.to_warehouse_id,
  toh.status AS transfer_status,
  toh.requested_at,
  tol.product_id,
  p.sku AS product_sku,
  p.name AS product_name,
  tol.lot_id,
  l.lot_code,
  tol.qty
FROM transfer_order_line tol
JOIN transfer_order toh ON toh.id = tol.transfer_order_id AND toh.is_deleted = false AND toh.status IN ('DRAFT','IN_TRANSIT')
JOIN product p ON p.id = tol.product_id AND p.is_deleted = false
LEFT JOIN lot l ON l.id = tol.lot_id AND l.is_deleted = false
WHERE tol.is_deleted = false;

CREATE OR REPLACE VIEW v_inventory_tx_running AS
SELECT
  t.id,
  t.ts,
  t.warehouse_id,
  t.bin_id,
  t.product_id,
  t.lot_id,
  t.reason,
  t.ref_type,
  t.ref_id,
  t.qty_delta,
  SUM(t.qty_delta) OVER (
    PARTITION BY t.warehouse_id, t.bin_id, t.product_id, t.lot_id
    ORDER BY t.ts, t.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_qty
FROM inventory_tx t;

CREATE OR REPLACE VIEW v_bom_active AS
SELECT
  b.id AS bom_id,
  b.parent_product_id,
  b.revision,
  b.effective_from,
  b.effective_to
FROM bom b
WHERE b.is_deleted = false
  AND (b.effective_from IS NULL OR b.effective_from <= CURRENT_DATE)
  AND (b.effective_to   IS NULL OR b.effective_to   >= CURRENT_DATE);

CREATE OR REPLACE VIEW v_bom_flat_active AS
WITH RECURSIVE active_boms AS (
  SELECT ba.bom_id, ba.parent_product_id FROM v_bom_active ba
),
expl AS (
  SELECT
    ab.bom_id AS root_bom_id,
    ab.parent_product_id AS root_product_id,
    bi.component_product_id,
    bi.qty_per::numeric(18,6) AS total_qty_per,
    1 AS lvl,
    ARRAY[ab.parent_product_id, bi.component_product_id] AS path
  FROM active_boms ab
  JOIN bom_item bi ON bi.bom_id = ab.bom_id
  UNION ALL
  SELECT
    expl.root_bom_id,
    expl.root_product_id,
    bi2.component_product_id,
    (expl.total_qty_per * bi2.qty_per)::numeric(18,6) AS total_qty_per,
    expl.lvl + 1 AS lvl,
    path || bi2.component_product_id
  FROM expl
  JOIN v_bom_active b2 ON b2.parent_product_id = expl.component_product_id
  JOIN bom_item bi2 ON bi2.bom_id = b2.bom_id
  WHERE NOT (bi2.component_product_id = ANY (expl.path))
)
SELECT
  root_bom_id AS bom_id,
  root_product_id AS parent_product_id,
  component_product_id,
  total_qty_per,
  lvl AS level
FROM expl;

CREATE OR REPLACE VIEW v_search_catalog AS
SELECT 'product'::text AS entity_type, p.id AS entity_id, (p.sku || ' ' || p.name) AS label, p.search_tsv
FROM product p WHERE p.is_deleted = false
UNION ALL
SELECT 'customer', c.id, c.name, c.search_tsv
FROM customer c WHERE c.is_deleted = false
UNION ALL
SELECT 'supplier', s.id, s.name, s.search_tsv
FROM supplier s WHERE s.is_deleted = false
UNION ALL
SELECT 'warehouse', w.id, (w.code || ' ' || w.name), w.search_tsv
FROM warehouse w WHERE w.is_deleted = false
UNION ALL
SELECT 'lot', l.id, l.lot_code, l.search_tsv
FROM lot l WHERE l.is_deleted = false
UNION ALL
SELECT 'address', a.id, coalesce(a.line1,'') || ' ' || coalesce(a.city,'') || ' ' || coalesce(a.postal_code,''), a.search_tsv
FROM address a;

CREATE OR REPLACE VIEW scm.v_order_fulfillment_doc AS
SELECT
  so.id AS sales_order_id,
  so.so_number,
  so.customer_id,
  c.name AS customer_name,
  so.status::text AS so_status,
  so.order_date,
  so.due_date,
  so.currency,
  COALESCE(res_wh.warehouse_id, ship_info.warehouse_id) AS warehouse_id,
  COALESCE(res_wh.warehouse_code, ship_info.warehouse_code) AS warehouse_code,
  ship_info.carrier_id,
  ship_info.carrier_name,
  ship_info.tracking_no,
  ship_info.ship_date,
  lines_json.lines,
  reservations_json.reservations,
  picklist_json.picklist,
  ship_info.shipment
FROM scm.sales_order so
JOIN scm.customer c
  ON c.id = so.customer_id
 AND c.is_deleted = false
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'lineId', sol.id,
        'lineNo', sol.line_no,
        'productId', sol.product_id,
        'productSku', p.sku,
        'productName', p.name,
        'uomId', sol.uom_id,
        'uomCode', u.code,
        'qtyOrdered', sol.qty_ordered::double precision,
        'qtyReservedOpen',
          GREATEST(
            COALESCE(r_tot.qty_reserved, 0) - COALESCE(r_tot.qty_picked, 0),
            0
          )::double precision,
        'qtyToReserve',
          GREATEST(
            sol.qty_ordered -
              GREATEST(
                COALESCE(r_tot.qty_reserved, 0) - COALESCE(r_tot.qty_picked, 0),
                0
              ),
            0
          )::double precision,
        'pricePerUom', sol.price_per_uom::double precision
      )
    ) AS lines
  FROM scm.sales_order_line sol
  JOIN scm.product p
    ON p.id = sol.product_id
   AND p.is_deleted = false
  JOIN scm.unit_of_measure u
    ON u.id = sol.uom_id
  LEFT JOIN LATERAL (
    SELECT
      SUM(r.qty_reserved) AS qty_reserved,
      SUM(r.qty_picked) AS qty_picked
    FROM scm.reservation r
    WHERE r.so_line_id = sol.id
      AND r.is_deleted = false
  ) AS r_tot ON true
  WHERE sol.sales_order_id = so.id
    AND sol.is_deleted = false
) AS lines_json ON true
LEFT JOIN LATERAL (
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'soLineId', r.so_line_id,
        'warehouseId', r.warehouse_id,
        'binId', r.bin_id,
        'productId', r.product_id,
        'lotId', r.lot_id,
        'qtyReserved', r.qty_reserved::double precision,
        'qtyPicked', r.qty_picked::double precision,
        'status', r.status::text
      )
    ) AS reservations
  FROM scm.reservation r
  JOIN scm.sales_order_line sol
    ON sol.id = r.so_line_id
   AND sol.sales_order_id = so.id
  WHERE r.is_deleted = false
) AS reservations_json ON true
LEFT JOIN LATERAL (
  SELECT
    r.warehouse_id,
    w.code AS warehouse_code
  FROM scm.reservation r
  JOIN scm.sales_order_line sol
    ON sol.id = r.so_line_id
   AND sol.sales_order_id = so.id
  JOIN scm.warehouse w
    ON w.id = r.warehouse_id
  WHERE r.is_deleted = false
  ORDER BY r.created_at
  LIMIT 1
) AS res_wh ON true
LEFT JOIN LATERAL (
  SELECT
    jsonb_build_object(
      'picklistId', pl.id,
      'warehouseId', pl.warehouse_id,
      'status', pl.status::text,
      'items',
        (
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', pi.id,
                     'reservationId', pi.reservation_id,
                     'binId', pi.bin_id,
                     'productId', pi.product_id,
                     'lotId', pi.lot_id,
                     'qtyToPick', pi.qty_to_pick::double precision,
                     'qtyPicked', pi.qty_picked::double precision,
                     'status', pi.status::text
                   )
                 )
          FROM scm.pick_item pi
          WHERE pi.picklist_id = pl.id
            AND pi.is_deleted = false
        )
    ) AS picklist
  FROM scm.picklist pl
  WHERE pl.id = (
    SELECT pi.picklist_id
    FROM scm.pick_item pi
    JOIN scm.reservation r ON r.id = pi.reservation_id
    JOIN scm.sales_order_line sol ON sol.id = r.so_line_id
    WHERE sol.sales_order_id = so.id
    LIMIT 1
  )
    AND pl.is_deleted = false
) AS picklist_json ON true
LEFT JOIN LATERAL (
  SELECT
    s.warehouse_id,
    w.code AS warehouse_code,
    s.carrier_id,
    carr.name AS carrier_name,
    s.tracking_no,
    s.ship_date,
    jsonb_build_object(
      'shipmentId', s.id,
      'shipmentNumber', s.shipment_number,
      'warehouseId', s.warehouse_id,
      'carrierId', s.carrier_id,
      'carrierName', carr.name,
      'trackingNo', s.tracking_no,
      'shipDate', s.ship_date,
      'items',
        (
          SELECT jsonb_agg(
                   jsonb_build_object(
                     'id', si.id,
                     'productId', si.product_id,
                     'lotId', si.lot_id,
                     'qtyShipped', si.qty_shipped::double precision
                   )
                 )
          FROM scm.shipment_item si
          WHERE si.shipment_id = s.id
            AND si.is_deleted = false
        )
    ) AS shipment
  FROM scm.shipment s
  JOIN scm.warehouse w
    ON w.id = s.warehouse_id
  LEFT JOIN scm.carrier carr
    ON carr.id = s.carrier_id
  WHERE s.sales_order_id = so.id
    AND s.is_deleted = false
  ORDER BY s.ship_date DESC, s.id DESC
  LIMIT 1
) AS ship_info ON true
WHERE so.is_deleted = false;
