import { Effect } from "effect";
import type { DomainError } from "../domain/errors.js";
import type { UUID } from "../domain/types.js";
import { UnitOfWork } from "../uow/UnitOfWork.js";
import { SalesOrderRepo } from "../repositories/SalesOrderRepo.js";
import { ReservationRepo } from "../repositories/ReservationRepo.js";
import { PickingRepo } from "../repositories/PickingRepo.js";
import { ShipmentRepo } from "../repositories/ShipmentRepo.js";

export interface FulfillOrderInput {
  readonly customerId: UUID;
  readonly orderDate: string;
  readonly dueDate?: string | null;
  readonly currency: string;

  readonly lines: ReadonlyArray<{
    readonly productId: UUID;
    readonly uomId: UUID;
    readonly qtyOrdered: number;
    readonly pricePerUom: number;
  }>;

  readonly warehouseId: UUID;
  readonly binId?: UUID | null; 
  readonly lotId?: UUID | null; 
  readonly carrierId?: UUID | null;
  readonly trackingNo?: string | null;
  readonly shipDate: string;

  readonly userId: UUID;
}

export interface FulfillOrderOutput {
  readonly salesOrderId: UUID;
  readonly lineIds: ReadonlyArray<UUID>;
  readonly reservationIds: ReadonlyArray<UUID>;
  readonly picklistId: UUID;
  readonly shipmentId: UUID;
}

export const fulfillOrder = (
  input: FulfillOrderInput
): Effect.Effect<
  FulfillOrderOutput,
  DomainError,
  UnitOfWork | SalesOrderRepo | ReservationRepo | PickingRepo | ShipmentRepo
> =>
  Effect.gen(function* () {
    const uow = yield* UnitOfWork;
    const soRepo = yield* SalesOrderRepo;
    const resRepo = yield* ReservationRepo;
    const pickRepo = yield* PickingRepo;
    const shipRepo = yield* ShipmentRepo;

    return yield* uow.withTransaction(
      Effect.gen(function* () {
        const salesOrderId = yield* soRepo.create({
          customerId: input.customerId,
          orderDate: input.orderDate,
          dueDate: input.dueDate,
          currency: input.currency,
          userId: input.userId,
        });

        const lineIds: UUID[] = [];
        for (const line of input.lines) {
          const lineId = yield* soRepo.addLine({
            soId: salesOrderId,
            productId: line.productId,
            uomId: line.uomId,
            qtyOrdered: line.qtyOrdered,
            pricePerUom: line.pricePerUom,
            userId: input.userId,
          });
          lineIds.push(lineId);
        }

        yield* soRepo.approve({
          soId: salesOrderId,
          userId: input.userId,
        });

        const openLines = yield* soRepo.findOpenLines(salesOrderId);

        const reservationIds: UUID[] = [];
        for (const line of openLines) {
          const reservationId = yield* resRepo.create({
            soLineId: line.id,
            warehouseId: input.warehouseId,
            binId: input.binId,
            productId: line.productId,
            lotId: input.lotId,
            qtyReserved: line.qtyToReserve,
            userId: input.userId,
          });
          reservationIds.push(reservationId);
        }

        const picklistId = yield* pickRepo.createPicklistForOrder({
          salesOrderId,
          warehouseId: input.warehouseId,
          userId: input.userId,
        });

        const pickItems = yield* pickRepo.picklistDetail(picklistId);

        for (const pickItem of pickItems) {
          yield* pickRepo.confirmPick({
            pickItemId: pickItem.id,
            qtyToConfirm: pickItem.qtyToPick,
            userId: input.userId,
          });
        }

        const shipmentId = yield* shipRepo.createShipment({
          salesOrderId,
          warehouseId: input.warehouseId,
          carrierId: input.carrierId,
          trackingNo: input.trackingNo,
          shipDate: input.shipDate,
          userId: input.userId,
        });

        yield* shipRepo.addFromPicks({
          shipmentId,
          userId: input.userId,
        });

        return {
          salesOrderId,
          lineIds,
          reservationIds,
          picklistId,
          shipmentId,
        };
      })
    );
  });
