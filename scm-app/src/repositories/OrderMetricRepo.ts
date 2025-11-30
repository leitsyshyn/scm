import { Context, Effect, Layer } from "effect";
import type { UUID } from "../domain/types.js";
import type { DomainError } from "../domain/errors.js";
import { Redis } from "../db/RedisClient.js";

export interface OrderMetrics {
  readonly customerId: UUID;
  readonly ordersCount: number;
  readonly totalQty: number;
}

export interface OrderMetricsRepo {
  readonly recordFulfilledOrder: (params: {
    orderId: UUID;
    customerId: UUID;
    totalQty: number;
  }) => Effect.Effect<void, DomainError>;

  readonly getCustomerMetrics: (
    customerId: UUID
  ) => Effect.Effect<OrderMetrics, DomainError>;
}

export const OrderMetricsRepo =
  Context.GenericTag<OrderMetricsRepo>("OrderMetricsRepo");

export const OrderMetricsRepoLive = Layer.effect(
  OrderMetricsRepo,
  Effect.gen(function* () {
    const { client } = yield* Redis;

    return {
      recordFulfilledOrder: (params) =>
        Effect.tryPromise({
          try: () =>
            client
              .multi()
              .incr(`of:orders_by_customer:${params.customerId}`)
              .incrByFloat(
                `of:qty_by_customer:${params.customerId}`,
                params.totalQty
              )
              .set(`of:order_status:${params.orderId}`, "SHIPPED")
              .exec()
              .then(() => {}),
          catch: (error) =>
            ({
              _tag: "InfrastructureError",
              message: "Redis write failed",
              cause: error,
            }) as DomainError,
        }).pipe(Effect.asVoid),

      getCustomerMetrics: (customerId) =>
        Effect.tryPromise({
          try: async () => {
            const [ordersCountRaw, totalQtyRaw] = await client.mGet([
              `of:orders_by_customer:${customerId}`,
              `of:qty_by_customer:${customerId}`,
            ]);

            return {
              customerId,
              ordersCount: Number(ordersCountRaw ?? "0"),
              totalQty: Number(totalQtyRaw ?? "0"),
            };
          },
          catch: (error) =>
            ({
              _tag: "InfrastructureError",
              message: "Redis read failed",
              cause: error,
            }) as DomainError,
        }),
    };
  })
);
