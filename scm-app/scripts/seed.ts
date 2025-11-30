import { config } from "dotenv";
import { Effect, Console } from "effect";
import { DbLive, Sql } from "../src/db/PgClient.js";
import { SEED_IDS } from "../src/testIds.js";

config();

const seedProgram = Effect.gen(function* () {
  const sql = yield* Sql;

  yield* Console.log("🌱 Starting database seed...");

  yield* Console.log("Cleaning up existing test data...");
  
  const cleanup = [
    "DELETE FROM scm.shipment_item WHERE shipment_id IN (SELECT id FROM scm.shipment WHERE created_by = $1)",
    "DELETE FROM scm.shipment WHERE created_by = $1",
    "DELETE FROM scm.package_item WHERE package_id IN (SELECT id FROM scm.package WHERE created_by = $1)",
    "DELETE FROM scm.package WHERE created_by = $1",
    "DELETE FROM scm.pick_item WHERE created_by = $1",
    "DELETE FROM scm.picklist WHERE created_by = $1",
    "DELETE FROM scm.reservation WHERE created_by = $1",
    "DELETE FROM scm.sales_order_line WHERE sales_order_id IN (SELECT id FROM scm.sales_order WHERE created_by = $1)",
    "DELETE FROM scm.sales_order WHERE created_by = $1",
    "DELETE FROM scm.receipt_line WHERE receipt_id IN (SELECT id FROM scm.receipt WHERE created_by = $1)",
    "DELETE FROM scm.receipt WHERE created_by = $1",
    "DELETE FROM scm.purchase_order_line WHERE purchase_order_id IN (SELECT id FROM scm.purchase_order WHERE created_by = $1)",
    "DELETE FROM scm.purchase_order WHERE created_by = $1",
    "DELETE FROM scm.inventory WHERE created_by = $1",
    "DELETE FROM scm.inventory_tx WHERE created_by = $1",
    "DELETE FROM scm.lot WHERE id = $1",
    "DELETE FROM scm.product WHERE id IN ($1, $2)",
    "DELETE FROM scm.product_category WHERE id = $1",
    "DELETE FROM scm.warehouse_bin WHERE id = $1",
    "DELETE FROM scm.warehouse WHERE id = $1",
    "DELETE FROM scm.carrier WHERE id = $1",
    "DELETE FROM scm.customer WHERE id = $1",
    "DELETE FROM scm.app_user WHERE id = $1",
  ];

  for (const query of cleanup.slice(0, -8)) {
    yield* sql.unsafe(query, [SEED_IDS.USER_ID]).pipe(Effect.orDie);
  }
  
  yield* sql.unsafe(cleanup[cleanup.length - 8], [SEED_IDS.LOT_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 7], [SEED_IDS.PRODUCT_WIDGET_ID, SEED_IDS.PRODUCT_GADGET_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 6], [SEED_IDS.CATEGORY_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 5], [SEED_IDS.BIN_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 4], [SEED_IDS.WAREHOUSE_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 3], [SEED_IDS.CARRIER_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 2], [SEED_IDS.CUSTOMER_ID]).pipe(Effect.orDie);
  yield* sql.unsafe(cleanup[cleanup.length - 1], [SEED_IDS.USER_ID]).pipe(Effect.orDie);

  yield* Console.log("Seeding user...");
  yield* sql.unsafe(
    `INSERT INTO scm.app_user (id, username, full_name, email, created_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username`,
    [SEED_IDS.USER_ID, "demo_user", "Demo User", "demo@example.com"]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding customer...");
  yield* sql.unsafe(
    `INSERT INTO scm.customer (id, name, is_deleted, created_at, created_by)
     VALUES ($1, $2, false, now(), $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_deleted = false`,
    [SEED_IDS.CUSTOMER_ID, "ACME Corporation", SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding warehouse...");
  yield* sql.unsafe(
    `INSERT INTO scm.warehouse (id, code, name, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, false, now(), $4)
     ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name, is_deleted = false`,
    [SEED_IDS.WAREHOUSE_ID, "WH-MAIN", "Main Warehouse", SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding warehouse bin...");
  yield* sql.unsafe(
    `INSERT INTO scm.warehouse_bin (id, warehouse_id, code, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, false, now(), $4)
     ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, is_deleted = false`,
    [SEED_IDS.BIN_ID, SEED_IDS.WAREHOUSE_ID, "A-01-01", SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding unit of measure...");
  yield* sql.unsafe(
    `INSERT INTO scm.unit_of_measure (id, code, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code`,
    [SEED_IDS.UOM_EACH_ID, "EA", "Each"]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding product category...");
  yield* sql.unsafe(
    `INSERT INTO scm.product_category (id, name, code, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, false, now(), $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [SEED_IDS.CATEGORY_ID, "Electronics", "ELEC", SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding UOM conversion...");
  yield* sql.unsafe(
    `INSERT INTO scm.uom_conversion (from_uom_id, to_uom_id, factor)
     VALUES ($1, $2, $3)
     ON CONFLICT (from_uom_id, to_uom_id) DO UPDATE SET factor = EXCLUDED.factor`,
    [SEED_IDS.UOM_EACH_ID, SEED_IDS.UOM_EACH_ID, 1.0]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding products...");
  yield* sql.unsafe(
    `INSERT INTO scm.product (id, sku, name, category_id, base_uom_id, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, false, now(), $6)
     ON CONFLICT (id) DO UPDATE SET sku = EXCLUDED.sku, name = EXCLUDED.name, is_deleted = false, base_uom_id = EXCLUDED.base_uom_id`,
    [SEED_IDS.PRODUCT_WIDGET_ID, "WGT-001", "Super Widget", SEED_IDS.CATEGORY_ID, SEED_IDS.UOM_EACH_ID, SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* sql.unsafe(
    `INSERT INTO scm.product (id, sku, name, category_id, base_uom_id, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, false, now(), $6)
     ON CONFLICT (id) DO UPDATE SET sku = EXCLUDED.sku, name = EXCLUDED.name, is_deleted = false, base_uom_id = EXCLUDED.base_uom_id`,
    [SEED_IDS.PRODUCT_GADGET_ID, "GDG-001", "Mega Gadget", SEED_IDS.CATEGORY_ID, SEED_IDS.UOM_EACH_ID, SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding carrier...");
  yield* sql.unsafe(
    `INSERT INTO scm.carrier (id, name, scac)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [SEED_IDS.CARRIER_ID, "FastShip Express", "FSTX"]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding inventory status...");
  yield* sql.unsafe(
    `INSERT INTO scm.inventory_status (id, code)
     VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET id = EXCLUDED.id`,
    [SEED_IDS.STATUS_AVAILABLE_ID, "AVAILABLE"]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding lot...");
  yield* sql.unsafe(
    `INSERT INTO scm.lot (id, product_id, lot_code, expiry_date, status_id, is_deleted, created_at, created_by)
     VALUES ($1, $2, $3, $4, $5, false, now(), $6)
     ON CONFLICT (id) DO UPDATE SET lot_code = EXCLUDED.lot_code, is_deleted = false`,
    [SEED_IDS.LOT_ID, SEED_IDS.PRODUCT_WIDGET_ID, "LOT-2024-001", "2025-12-31", SEED_IDS.STATUS_AVAILABLE_ID, SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("Seeding inventory...");
  yield* sql.unsafe(
    `INSERT INTO scm.inventory (id, warehouse_id, bin_id, product_id, lot_id, qty_on_hand, created_at, created_by, updated_at, updated_by)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 1000, now(), $5, now(), $5)
     ON CONFLICT (warehouse_id, bin_id_norm, product_id, lot_id_norm) 
     DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand`,
    [SEED_IDS.WAREHOUSE_ID, SEED_IDS.BIN_ID, SEED_IDS.PRODUCT_WIDGET_ID, SEED_IDS.LOT_ID, SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* sql.unsafe(
    `INSERT INTO scm.inventory (id, warehouse_id, bin_id, product_id, qty_on_hand, created_at, created_by, updated_at, updated_by)
     VALUES (gen_random_uuid(), $1, $2, $3, 500, now(), $4, now(), $4)
     ON CONFLICT (warehouse_id, bin_id_norm, product_id, lot_id_norm) 
     DO UPDATE SET qty_on_hand = EXCLUDED.qty_on_hand`,
    [SEED_IDS.WAREHOUSE_ID, SEED_IDS.BIN_ID, SEED_IDS.PRODUCT_GADGET_ID, SEED_IDS.USER_ID]
  ).pipe(Effect.orDie);

  yield* Console.log("✅ Database seeded successfully!");
  yield* Console.log("\nSeeded IDs:");
  yield* Console.log("  User ID:     ", SEED_IDS.USER_ID);
  yield* Console.log("  Customer ID: ", SEED_IDS.CUSTOMER_ID);
  yield* Console.log("  Warehouse ID:", SEED_IDS.WAREHOUSE_ID);
  yield* Console.log("  Bin ID:      ", SEED_IDS.BIN_ID);
  yield* Console.log("  UOM (EA) ID: ", SEED_IDS.UOM_EACH_ID);
  yield* Console.log("  Product 1 ID:", SEED_IDS.PRODUCT_WIDGET_ID);
  yield* Console.log("  Product 2 ID:", SEED_IDS.PRODUCT_GADGET_ID);
  yield* Console.log("  Carrier ID:  ", SEED_IDS.CARRIER_ID);
  yield* Console.log("  Lot ID:      ", SEED_IDS.LOT_ID);
  yield* Console.log("\nInventory:");
  yield* Console.log("  Super Widget: 1000 EA in bin A-01-01");
  yield* Console.log("  Mega Gadget:  500 EA in bin A-01-01");
});

const main = seedProgram.pipe(Effect.provide(DbLive));

Effect.runPromise(main)
  .then(() => {
    console.log("\n✓ Seeding completed");
  })
  .catch((error) => {
    console.error("\n✗ Seeding failed:");
    console.error(error);
    throw error;
  });
