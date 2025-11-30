import { Context, Effect, Layer } from "effect";
import { MongoClient, Db, Collection } from "mongodb";
import type { OrderFulfillmentDocument } from "../domain/aggregates/OrderFulfillmentDocument.js";

export interface MongoDb {
  readonly client: MongoClient;
  readonly db: Db;
  readonly orderFulfillment: () => Collection<OrderFulfillmentDocument>;
}

export const MongoDb = Context.GenericTag<MongoDb>("MongoDb");

export const MongoDbLive = Layer.scoped(
  MongoDb,
  Effect.gen(function* () {
    const uri = process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017";
    const dbName = process.env.MONGO_DB ?? "scm_nosql";

    const client = yield* Effect.acquireRelease(
      Effect.sync(() => new MongoClient(uri)),
      (client) =>
        Effect.promise(() => client.close()).pipe(
          Effect.catchAll(() => Effect.void)
        )
    );

    yield* Effect.promise(() => client.connect());

    const db = client.db(dbName);

    const orderFulfillment = () =>
      db.collection<OrderFulfillmentDocument>("order_fulfillment");

    return {
      client,
      db,
      orderFulfillment,
    };
  })
);
