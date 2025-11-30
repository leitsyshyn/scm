import { Context, Effect, Layer } from "effect";
import { v4 as uuidv4 } from "uuid";
import { Sql, callProcedure, queryView } from "../db/PgClient.js";
import type { DomainError } from "../domain/errors.js";
import type {
  CreatePicklistInput,
  ConfirmPickInput,
  PickItemDetail,
  UUID,
} from "../domain/types.js";

export interface PickingRepo {
  readonly createPicklistForOrder: (
    input: CreatePicklistInput
  ) => Effect.Effect<UUID, DomainError>;
  readonly confirmPick: (
    input: ConfirmPickInput
  ) => Effect.Effect<void, DomainError>;
  readonly picklistDetail: (
    picklistId: UUID
  ) => Effect.Effect<ReadonlyArray<PickItemDetail>, DomainError>;
}

export const PickingRepo = Context.GenericTag<PickingRepo>("PickingRepo");

export const PickingRepoLive = Layer.effect(
  PickingRepo,
  Effect.gen(function* () {
    const sql = yield* Sql;

    return {
      createPicklistForOrder: (input: CreatePicklistInput) =>
        Effect.gen(function* () {
          const picklistId = input.picklistId ?? uuidv4();
          yield* callProcedure(sql, "scm.picklist_create_for_order", [
            input.salesOrderId,
            input.warehouseId,
            input.userId,
            picklistId,
          ]);

          return picklistId;
        }),

      confirmPick: (input: ConfirmPickInput) =>
        Effect.gen(function* () {
          yield* callProcedure(sql, "scm.pick_item_confirm", [
            input.pickItemId,
            input.qtyToConfirm,
            input.userId,
          ]);
        }),

      picklistDetail: (picklistId: UUID) =>
        Effect.gen(function* () {
          return yield* queryView<PickItemDetail>(
            sql,
            "scm.v_picklist_detail",
            "picklist_id = $1",
            [picklistId]
          );
        }),
    };
  })
);
