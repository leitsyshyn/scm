import { config } from "dotenv";
import { Effect, Layer, Console } from "effect";
import { DbLive } from "./db/SqlClient.js";
import { UnitOfWorkLive } from "./uow/UnitOfWork.js";
import { SalesOrderRepoLive } from "./repositories/SalesOrderRepo.js";
import { ReservationRepoLive } from "./repositories/ReservationRepo.js";
import { PickingRepoLive } from "./repositories/PickingRepo.js";
import { ShipmentRepoLive } from "./repositories/ShipmentRepo.js";
import { fulfillOrder, type FulfillOrderInput } from "./app/FulfillOrderUseCase.js";
import { SEED_IDS } from "./testIds.js";

config();

const AppLive = Layer.provide(
  Layer.mergeAll(
    UnitOfWorkLive,
    SalesOrderRepoLive,
    ReservationRepoLive,
    PickingRepoLive,
    ShipmentRepoLive
  ),
  DbLive
);
const program = Effect.gen(function* () {
  yield* Console.log("Starting order fulfillment demo...");
  yield* Console.log("Using seeded test data (run `bun run scripts/seed.ts` if not already done)");

  const input: FulfillOrderInput = {
    customerId: SEED_IDS.CUSTOMER_ID,
    orderDate: new Date().toISOString().split("T")[0],
    dueDate: null,
    currency: "USD",
    lines: [
      {
        productId: SEED_IDS.PRODUCT_WIDGET_ID,
        uomId: SEED_IDS.UOM_EACH_ID,
        qtyOrdered: 10,
        pricePerUom: 100.0,
      },
    ],
    warehouseId: SEED_IDS.WAREHOUSE_ID,
    binId: SEED_IDS.BIN_ID,
    lotId: SEED_IDS.LOT_ID,
    carrierId: SEED_IDS.CARRIER_ID,
    trackingNo: "DEMO-" + Date.now(),
    shipDate: new Date().toISOString().split("T")[0],
    userId: SEED_IDS.USER_ID,
  };

  yield* Console.log("Order input:", input);

  const result = yield* fulfillOrder(input);

  yield* Console.log("Order fulfilled successfully!");
  yield* Console.log("Sales Order ID:", result.salesOrderId);
  yield* Console.log("Line IDs:", result.lineIds);
  yield* Console.log("Reservation IDs:", result.reservationIds);
  yield* Console.log("Picklist ID:", result.picklistId);
  yield* Console.log("Shipment ID:", result.shipmentId);

  return result;
});

const main = program.pipe(
  Effect.provide(AppLive),
  Effect.catchAll((error) =>
    Effect.gen(function* () {
      yield* Console.error("Error during order fulfillment:");
      yield* Console.error(error);
      return Effect.fail(error);
    })
  )
);

Effect.runPromise(main)
  .then((result) => {
    console.log("\n✓ Program completed successfully");
    console.log("Result:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Program failed");
    console.error(error);
    process.exit(1);
  });
