import { Effect } from "effect";
import type { DomainError } from "../domain/errors.js";
import type {
  FulfillOrderInput,
  FulfillOrderOutput,
} from "../app/FulfillOrderUseCase.js";
import { OrderFulfillmentRepo } from "../repositories/OrderFulfillmenRepo.js";
import type { OrderFulfillmentDocument } from "../domain/aggregates/OrderFulfillmentDocument.js";

export const projectOrderToMongoFromView = (params: {
  input: FulfillOrderInput;
  result: FulfillOrderOutput;
}): Effect.Effect<void, DomainError, OrderFulfillmentRepo> =>
  Effect.gen(function* () {
    const repo = yield* OrderFulfillmentRepo;

    const row = yield* repo.getFromView(params.result.salesOrderId);

    const warehouseId = row.warehouseId ?? params.input.warehouseId;
    const currency = row.currency ?? params.input.currency;

    const picklist = row.picklist
      ? {
          picklistId: row.picklist.picklistId,
          warehouseId: row.picklist.warehouseId,
          status: row.picklist.status,
          items: row.picklist.items ?? [],
        }
      : null;

    const shipment = row.shipment
      ? {
          shipmentId: row.shipment.shipmentId,
          shipmentNumber: row.shipment.shipmentNumber,
          warehouseId: row.shipment.warehouseId,
          carrierId: row.shipment.carrierId,
          carrierName: row.shipment.carrierName,
          trackingNo: row.shipment.trackingNo,
          shipDate: row.shipment.shipDate
            ? new Date(row.shipment.shipDate)
            : null,
          items: row.shipment.items ?? [],
        }
      : null;

    const doc: OrderFulfillmentDocument = {
      _id: row.salesOrderId,
      salesOrderId: row.salesOrderId,
      soNumber: row.soNumber ?? null,
      customerId: row.customerId,
      customerName: row.customerName,
      warehouseId,
      warehouseCode: row.warehouseCode ?? null,
      carrierId: row.carrierId ?? null,
      carrierName: row.carrierName ?? null,
      trackingNo: row.trackingNo ?? null,
      orderDate: new Date(row.orderDate),
      dueDate: row.dueDate ? new Date(row.dueDate) : null,
      shipDate: row.shipDate ? new Date(row.shipDate) : null,
      currency,
      soStatus: row.soStatus,
      lines: row.lines ?? [],
      reservations: row.reservations ?? [],
      picklist,
      shipment,
      createdAt: new Date(),
      source: "order-fulfillment-demo",
    };

    yield* repo.upsertToMongo(doc);
  });
