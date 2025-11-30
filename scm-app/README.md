# SQL + NoSQL: Order Fulfillment

## PostgreSQL

**Database:** `scm_dev`

**Tables:** `sales_order`, `sales_order_line`, `reservation`, `picklist`, `pick_item`, `shipment`, `shipment_item`, `customer`, `warehouse`, `carrier`, `product`, `unit_of_measure`

**Use case** `fulfillOrder`:
1. `sales_order` + `sales_order_line`
2. `reservation`
3. `picklist` + `pick_item`
4. `shipment` + `shipment_item`

**View:** `scm.v_order_fulfillment_doc` — агрегація всіх даних замовлення (JSON)

## MongoDB

**Database:** `scm_nosql`  

**Collection:** `order_fulfillment`

**Document:** `OrderFulfillmentDocument` (`domain/aggregates/`) — денормалізований документ з `_id = salesOrderId`, містить: `lines`, `reservations`, `picklist`, `shipment`

## Redis

**Keys:**
- `of:orders_by_customer:{customerId}` — лічильник замовлень
- `of:qty_by_customer:{customerId}` — загальна кількість
- `of:order_status:{orderId}` — статус

**Repo:** `OrderMetricsRepo` — `MULTI/EXEC`, `MGET`

## OrderFulfillmentRepo

**Unified repository** (`repositories/OrderFulfillmentRepo.ts`):
- `getFromView(id)` — читання з PostgreSQL view
- `getFromMongo(id)` — читання з MongoDB
- `upsertToMongo(doc)` — запис проєкції в MongoDB

## Проєкція SQL → Mongo

Після `fulfillOrder` (`utils/mappers.ts`):
1. `repo.getFromView(salesOrderId)`
2. Mapping → `OrderFulfillmentDocument`
3. `repo.upsertToMongo(doc)`

PostgreSQL — джерело істини (запис), MongoDB — read-model, Redis — метрики

## Benchmark

**Method:** `benchmarkOrderRead(orderId, 10_000)` + warmup

**Results:**
- PostgreSQL view: ~2.48 ms/call
- MongoDB doc: ~0.13 ms/call
- **Speedup: ~18×**
