import { Config, Effect, Layer, Context } from "effect";
import { createClient } from "redis";

export interface Redis {
  readonly client: ReturnType<typeof createClient>;
}

export const Redis = Context.GenericTag<Redis>("Redis");

export const RedisLive = Layer.scoped(
  Redis,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const url = yield* Config.string("REDIS_URL");

      const client = yield* Effect.tryPromise({
        try: async () => {
          const c = createClient({ url });
          await c.connect();
          return c;
        },
        catch: (error) => error as Error,
      });

      return { client };
    }),
    (res) =>
      Effect.tryPromise({
        try: () => res.client.quit(),
        catch: (error) => error as Error,
      }).pipe(Effect.asVoid, Effect.orElseSucceed(() => undefined))
  )
);
