import { Context, Effect, Layer } from "effect";
import { v4 as uuidv4 } from "uuid";
import { Sql, callProcedure, queryView } from "../db/PgClient.js";
import type { DomainError } from "../domain/errors.js";
import type {
  CreateSalesOrderInput,
  AddSalesOrderLineInput,
  ApproveSalesOrderInput,
  SoLineOpen,
  UUID,
} from "../domain/types.js";

export interface SalesOrderRepo {
  readonly create: (
    input: CreateSalesOrderInput
  ) => Effect.Effect<UUID, DomainError>;
  readonly addLine: (
    input: AddSalesOrderLineInput
  ) => Effect.Effect<UUID, DomainError>;
  readonly approve: (
    input: ApproveSalesOrderInput
  ) => Effect.Effect<void, DomainError>;
  readonly findOpenLines: (
    soId: UUID
  ) => Effect.Effect<ReadonlyArray<SoLineOpen>, DomainError>;
}

export const SalesOrderRepo = Context.GenericTag<SalesOrderRepo>(
  "SalesOrderRepo"
);

export const SalesOrderRepoLive = Layer.effect(
  SalesOrderRepo,
  Effect.gen(function* () {
    const sql = yield* Sql;

    return {
      create: (input: CreateSalesOrderInput) =>
        Effect.gen(function* () {
          const soId = input.soId ?? uuidv4();
          yield* callProcedure(sql, "scm.so_create", [
            input.customerId,
            input.orderDate,
            input.dueDate ?? null,
            input.currency,
            input.userId,
            soId,
          ]);

          return soId;
        }),

      addLine: (input: AddSalesOrderLineInput) =>
        Effect.gen(function* () {
          const soLineId = input.soLineId ?? uuidv4();
          yield* callProcedure(sql, "scm.so_add_line", [
            input.soId,
            input.productId,
            input.uomId,
            input.qtyOrdered,
            input.pricePerUom,
            input.userId,
            soLineId,
          ]);

          return soLineId;
        }),

      approve: (input: ApproveSalesOrderInput) =>
        Effect.gen(function* () {
          yield* callProcedure(sql, "scm.so_approve", [
            input.soId,
            input.userId,
          ]);
        }),

      findOpenLines: (soId: UUID) =>
        Effect.gen(function* () {
          return yield* queryView<SoLineOpen>(
            sql,
            "scm.v_so_line_open",
            "sales_order_id = $1",
            [soId]
          );
        }),
    };
  })
);
