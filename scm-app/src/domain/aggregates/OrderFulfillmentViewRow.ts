import type { UUID } from "../../domain/types.js";

export interface OrderFulfillmentViewRow {
  salesOrderId: UUID;
  soNumber: string | null;
  customerId: UUID;
  customerName: string;
  soStatus: string;
  orderDate: string;
  dueDate: string | null;
  currency: string;
  warehouseId: UUID | null;
  warehouseCode: string | null;
  carrierId: UUID | null;
  carrierName: string | null;
  trackingNo: string | null;
  shipDate: string | null;
  lines: ReadonlyArray<{
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
  }>;
  reservations: ReadonlyArray<{
    id: UUID;
    soLineId: UUID;
    warehouseId: UUID;
    binId: UUID | null;
    productId: UUID;
    lotId: UUID | null;
    qtyReserved: number;
    qtyPicked: number;
    status: string;
  }> | null;
  picklist: {
    picklistId: UUID;
    warehouseId: UUID;
    status: string;
    items: ReadonlyArray<{
      id: UUID;
      reservationId: UUID;
      binId: UUID | null;
      productId: UUID;
      lotId: UUID | null;
      qtyToPick: number;
      qtyPicked: number;
      status: string;
    }>;
  } | null;
  shipment: {
    shipmentId: UUID;
    shipmentNumber: string | null;
    warehouseId: UUID;
    carrierId: UUID | null;
    carrierName: string | null;
    trackingNo: string | null;
    shipDate: string | null;
    items: ReadonlyArray<{
      id: UUID;
      productId: UUID;
      lotId: UUID | null;
      qtyShipped: number;
    }>;
  } | null;
}
