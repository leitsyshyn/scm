import { Context, Effect, Layer } from "effect";
import { v4 as uuidv4 } from "uuid";
import { Sql, callProcedure, queryView } from "../db/PgClient.js";
import type { DomainError } from "../domain/errors.js";
import type {
  CreateReservationInput,
  InventoryAvailable,
  InventoryFilter,
  UUID,
} from "../domain/types.js";

export interface ReservationRepo {
  readonly create: (
    input: CreateReservationInput
  ) => Effect.Effect<UUID, DomainError>;
  readonly inventoryAvailable: (
    filter: InventoryFilter
  ) => Effect.Effect<ReadonlyArray<InventoryAvailable>, DomainError>;
}

export const ReservationRepo = Context.GenericTag<ReservationRepo>(
  "ReservationRepo"
);

export const ReservationRepoLive = Layer.effect(
  ReservationRepo,
  Effect.gen(function* () {
    const sql = yield* Sql;

    return {
      create: (input: CreateReservationInput) =>
        Effect.gen(function* () {
          const reservationId = input.reservationId ?? uuidv4();
          yield* callProcedure(sql, "scm.reservation_create", [
            input.soLineId,
            input.warehouseId,
            input.binId ?? null,
            input.productId,
            input.lotId ?? null,
            input.qtyReserved,
            input.userId,
            reservationId,
          ]);

          return reservationId;
        }),

      inventoryAvailable: (filter: InventoryFilter) =>
        Effect.gen(function* () {
          const conditions: string[] = [
            "warehouse_id = $1",
            "product_id = $2",
          ];
          const params: unknown[] = [filter.warehouseId, filter.productId];

          if (filter.binId !== undefined) {
            conditions.push(
              filter.binId === null
                ? "bin_id IS NULL"
                : `bin_id = $${params.length + 1}`
            );
            if (filter.binId !== null) params.push(filter.binId);
          }

          if (filter.lotId !== undefined) {
            conditions.push(
              filter.lotId === null
                ? "lot_id IS NULL"
                : `lot_id = $${params.length + 1}`
            );
            if (filter.lotId !== null) params.push(filter.lotId);
          }

          return yield* queryView<InventoryAvailable>(
            sql,
            "scm.v_inventory_available",
            conditions.join(" AND "),
            params
          );
        }),
    };
  })
);
