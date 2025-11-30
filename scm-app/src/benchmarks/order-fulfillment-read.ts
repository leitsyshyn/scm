import { Effect, Console, Duration } from "effect";
import type { UUID } from "../domain/types.js";
import type { DomainError } from "../domain/errors.js";
import { OrderFulfillmentRepo } from "../repositories/OrderFulfillmenRepo.js";

export const benchmarkOrderRead = (
  orderId: UUID,
  iterations = 10_000
): Effect.Effect<void, DomainError, OrderFulfillmentRepo> =>
  Effect.gen(function* () {
    const repo = yield* OrderFulfillmentRepo;

    yield* Console.log(`Benchmarking orderId=${orderId}, iterations=${iterations}`);

    yield* Console.log("Warmup...");
    yield* repo.getFromView(orderId);
    yield* repo.getFromMongo(orderId);

    const bench = <R, E, A>(
      label: string,
      getEff: () => Effect.Effect<A, E, R>
    ): Effect.Effect<void, E, R> =>
      Effect.gen(function* () {
        const runIterations = Effect.gen(function* () {
          for (let i = 0; i < iterations; i++) {
            yield* getEff();
          }
        });

        const [duration, _] = yield* Effect.timed(runIterations);
        const totalMs = Duration.toMillis(duration);
        const avgMs = totalMs / iterations;

        yield* Console.log(
          `${label}: iterations=${iterations}, total_ms=${totalMs.toFixed(
            2
          )}, avg_ms=${avgMs.toFixed(4)}`
        );
      });

    yield* bench("Postgres view", () => repo.getFromView(orderId));
    yield* bench("Mongo doc", () => repo.getFromMongo(orderId));
  });
