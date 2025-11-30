
import { Context, Effect, Layer } from "effect";
import { v4 as uuidv4 } from "uuid";
import { Sql, callProcedure, queryView } from "../db/PgClient.js";
import type { DomainError } from "../domain/errors.js";
import type {
  CreateShipmentInput,
  AddShipmentFromPicksInput,
  ShipmentDetail,
  UUID,
} from "../domain/types.js";

export interface ShipmentRepo {
  readonly createShipment: (
    input: CreateShipmentInput
  ) => Effect.Effect<UUID, DomainError>;
  readonly addFromPicks: (
    input: AddShipmentFromPicksInput
  ) => Effect.Effect<void, DomainError>;
  readonly shipmentDetail: (
    shipmentId: UUID
  ) => Effect.Effect<ReadonlyArray<ShipmentDetail>, DomainError>;
}

export const ShipmentRepo = Context.GenericTag<ShipmentRepo>("ShipmentRepo");

export const ShipmentRepoLive = Layer.effect(
  ShipmentRepo,
  Effect.gen(function* () {
    const sql = yield* Sql;

    return {
      createShipment: (input: CreateShipmentInput) =>
        Effect.gen(function* () {
          const shipmentId = input.shipmentId ?? uuidv4();
          yield* callProcedure(sql, "scm.shipment_create", [
            input.salesOrderId,
            input.warehouseId,
            input.carrierId ?? null,
            input.trackingNo ?? null,
            input.shipDate,
            input.userId,
            shipmentId,
          ]);

          return shipmentId;
        }),

      addFromPicks: (input: AddShipmentFromPicksInput) =>
        Effect.gen(function* () {
          yield* callProcedure(sql, "scm.shipment_add_from_picks", [
            input.shipmentId,
            input.userId,
          ]);
        }),

      shipmentDetail: (shipmentId: UUID) =>
        Effect.gen(function* () {
          return yield* queryView<ShipmentDetail>(
            sql,
            "scm.v_shipment_detail",
            "shipment_id = $1",
            [shipmentId]
          );
        }),
    };
  })
);
