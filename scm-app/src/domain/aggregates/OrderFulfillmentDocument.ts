import type { UUID } from "../types.js";

export interface OrderFulfillmentLine {
  lineId: UUID;
  lineNo: number;
  productId: UUID;
  productSku: string;
  productName: string;
  uomId: UUID;
  uomCode: string;
  qtyOrdered: number;
  qtyReservedOpen: number;
  qtyToReserve: number;
  pricePerUom: number;
}

export interface OrderFulfillmentReservation {
  id: UUID;
  soLineId: UUID;
  warehouseId: UUID;
  binId: UUID | null;
  productId: UUID;
  lotId: UUID | null;
  qtyReserved: number;
  qtyPicked: number;
  status: string;
}

export interface OrderFulfillmentPickItem {
  id: UUID;
  reservationId: UUID;
  binId: UUID | null;
  productId: UUID;
  lotId: UUID | null;
  qtyToPick: number;
  qtyPicked: number;
  status: string;
}

export interface OrderFulfillmentPicklist {
  picklistId: UUID;
  warehouseId: UUID;
  status: string;
  items: ReadonlyArray<OrderFulfillmentPickItem>;
}

export interface OrderFulfillmentShipmentItem {
  id: UUID;
  productId: UUID;
  lotId: UUID | null;
  qtyShipped: number;
}

export interface OrderFulfillmentShipment {
  shipmentId: UUID;
  shipmentNumber: string | null;
  warehouseId: UUID;
  carrierId: UUID | null;
  carrierName: string | null;
  trackingNo: string | null;
  shipDate: Date | null;
  items: ReadonlyArray<OrderFulfillmentShipmentItem>;
}

export interface OrderFulfillmentDocument {
  _id: UUID;
  salesOrderId: UUID;
  soNumber: string | null;
  customerId: UUID;
  customerName: string;
  warehouseId: UUID;
  warehouseCode: string | null;
  carrierId: UUID | null;
  carrierName: string | null;
  trackingNo: string | null;
  orderDate: Date;
  dueDate: Date | null;
  shipDate: Date | null;
  currency: string;
  soStatus: string;
  lines: ReadonlyArray<OrderFulfillmentLine>;
  reservations: ReadonlyArray<OrderFulfillmentReservation>;
  picklist: OrderFulfillmentPicklist | null;
  shipment: OrderFulfillmentShipment | null;
  createdAt: Date;
  source: string;
}
