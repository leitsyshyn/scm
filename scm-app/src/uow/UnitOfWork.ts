import { Context, Effect, Layer } from "effect";
import { Sql } from "../db/SqlClient.js";

export interface UnitOfWork {
  readonly withTransaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
}

export const UnitOfWork = Context.GenericTag<UnitOfWork>("UnitOfWork");

export const make = Effect.gen(function* () {
  const sql = yield* Sql;

  return UnitOfWork.of({
    withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      sql.withTransaction(effect) as Effect.Effect<A, E, R>,
  });
});

export const UnitOfWorkLive = Layer.effect(UnitOfWork, make);
