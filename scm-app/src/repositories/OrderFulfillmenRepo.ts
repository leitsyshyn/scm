import { Context, Effect, Layer } from "effect";
import { Sql, queryView } from "../db/PgClient.js";
import { MongoDb } from "../db/MongoClient.js";
import type { DomainError } from "../domain/errors.js";
import type { UUID } from "../domain/types.js";
import type { OrderFulfillmentViewRow } from "../domain/aggregates/OrderFulfillmentViewRow.js";
import type { OrderFulfillmentDocument } from "../domain/aggregates/OrderFulfillmentDocument.js";

export interface OrderFulfillmentRepo {
  readonly getFromView: (
    salesOrderId: UUID
  ) => Effect.Effect<OrderFulfillmentViewRow, DomainError>;

  readonly getFromMongo: (
    salesOrderId: UUID
  ) => Effect.Effect<OrderFulfillmentDocument | null, DomainError>;

  readonly upsertToMongo: (
    doc: OrderFulfillmentDocument
  ) => Effect.Effect<void, DomainError>;
}

export const OrderFulfillmentRepo =
  Context.GenericTag<OrderFulfillmentRepo>("OrderFulfillmentReadRepo");

export const OrderFulfillmentRepoLive = Layer.effect(
  OrderFulfillmentRepo,
  Effect.gen(function* () {
    const sql = yield* Sql;
    const mongo = yield* MongoDb;
    const collection = mongo.orderFulfillment();

    return {
      getFromView: (salesOrderId) =>
        queryView<OrderFulfillmentViewRow>(
          sql,
          "scm.v_order_fulfillment_doc",
          "sales_order_id = $1",
          [salesOrderId]
        ).pipe(
          Effect.flatMap((rows) => {
            const row = rows[0];
            if (!row) {
              return Effect.fail<DomainError>({
                _tag: "InfrastructureError",
                message: `Order fulfillment not found: ${salesOrderId}`,
              } as DomainError);
            }
            return Effect.succeed(row);
          })
        ),

      getFromMongo: (salesOrderId) =>
        Effect.tryPromise({
          try: () => collection.findOne({ _id: salesOrderId }),
          catch: (error) =>
            ({
              _tag: "InfrastructureError",
              message: "MongoDB read failed",
              cause: error,
            }) as DomainError,
        }),

      upsertToMongo: (doc) =>
        Effect.tryPromise({
          try: () =>
            collection.updateOne(
              { _id: doc._id },
              { $set: doc },
              { upsert: true }
            ),
          catch: (error) =>
            ({
              _tag: "InfrastructureError",
              message: "MongoDB upsert failed",
              cause: error,
            }) as DomainError,
        }).pipe(Effect.asVoid),
    };
  })
);
